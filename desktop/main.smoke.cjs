const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const mainSource = readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');

const flush = () => new Promise((resolve) => setImmediate(resolve));

const createHarness = () => {
  const appHandlers = new Map();
  const windows = [];
  const errors = [];
  const calls = {
    quit: 0,
    fetch: [],
    spawn: null,
    protocol: null,
    readPaths: [],
  };
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.connected = true;
  child.send = (message) => {
    calls.shutdownMessage = message;
  };
  child.disconnect = () => {
    child.connected = false;
  };
  child.kill = () => {
    child.signalCode = 'SIGTERM';
    child.emit('exit', null, 'SIGTERM');
  };

  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.setWindowOpenHandler = (handler) => {
        this.openHandler = handler;
      };
      this.loaded = [];
      this.minimized = false;
      windows.push(this);
    }
    loadURL(url) {
      this.loaded.push(url);
      return Promise.resolve();
    }
    isMinimized() {
      return this.minimized;
    }
    restore() {
      this.minimized = false;
    }
    focus() {
      this.focused = true;
    }
    static getAllWindows() {
      return windows;
    }
  }

  const app = {
    isPackaged: false,
    whenReady: () => Promise.resolve(),
    getPath: () => '/user/profile/rls-simulator',
    requestSingleInstanceLock: () => true,
    on: (name, handler) => appHandlers.set(name, handler),
    quit: () => {
      calls.quit += 1;
    },
  };
  const protocol = {
    registerSchemesAsPrivileged: (schemes) => {
      calls.schemes = schemes;
    },
    handle: async (scheme, handler) => {
      calls.protocol = { scheme, handler };
    },
  };
  const electron = {
    app,
    BrowserWindow,
    Menu: { setApplicationMenu: () => {} },
    dialog: { showErrorBox: (...args) => errors.push(args) },
    protocol,
  };
  const fakeFetch = async (url, options) => {
    calls.fetch.push({ url, options });
    return new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const context = {
    AbortSignal,
    Headers,
    Response,
    URL,
    console: { error: () => {}, log: () => {} },
    fetch: fakeFetch,
    process: {
      env: {},
      execPath: '/opt/Electron/electron',
      platform: 'win32',
      resourcesPath: '/resources',
    },
    __dirname,
    setTimeout: (callback, duration) => setTimeout(callback, duration > 100 ? 20 : duration),
    clearTimeout,
    require: (name) => {
      if (name === 'electron') return electron;
      if (name === 'node:child_process')
        return {
          spawn: (...args) => {
            calls.spawn = args;
            return child;
          },
        };
      if (name === 'node:fs/promises')
        return {
          readFile: async (filePath) => {
            calls.readPaths.push(filePath);
            if (path.basename(filePath) === 'index.html') return Buffer.from('<!doctype html><html></html>');
            const error = new Error('not found');
            error.code = 'ENOENT';
            throw error;
          },
        };
      if (name === 'node:path') return path;
      throw new Error(`Unexpected module: ${name}`);
    },
  };

  vm.runInNewContext(mainSource, context, { filename: 'desktop/main.cjs' });
  return { appHandlers, calls, child, errors, windows };
};

test('starts only after child IPC reports its bound port and serves a stable app origin', async () => {
  const harness = createHarness();
  await flush();

  assert.equal(harness.calls.spawn[1][0], path.join(__dirname, '..', 'server', 'dist-desktop', 'index.cjs'));
  assert.equal(harness.calls.spawn[2].env.PORT, '0');
  assert.equal(harness.calls.spawn[2].env.RLS_DATA_DIR, path.join('/user/profile/rls-simulator', 'data'));
  assert.equal(
    JSON.stringify(harness.calls.schemes[0].privileges),
    JSON.stringify({
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    }),
  );
  assert.equal(harness.windows.length, 0);

  harness.child.emit('message', {
    type: 'server-ready',
    host: '127.0.0.1',
    port: 42_321,
  });
  await flush();
  assert.deepEqual(harness.windows[0].loaded, ['app://rls.local/']);
  assert.equal(harness.windows[0].options.webPreferences.nodeIntegration, false);
  assert.equal(harness.windows[0].options.webPreferences.contextIsolation, true);
  assert.equal(harness.windows[0].options.webPreferences.sandbox, true);
  assert.equal(JSON.stringify(harness.windows[0].openHandler()), JSON.stringify({ action: 'deny' }));

  const renderer = await harness.calls.protocol.handler({
    url: 'app://rls.local/profile?from=history',
    method: 'GET',
    headers: new Headers(),
  });
  assert.equal(renderer.status, 200);
  assert.match(
    renderer.headers.get('content-security-policy'),
    /img-src 'self' data: blob: https:\/\/server\.arcgisonline\.com/,
  );
  assert.match(renderer.headers.get('content-security-policy'), /font-src 'self' data:/);
  assert.match(
    renderer.headers.get('content-security-policy'),
    /connect-src 'self' https:\/\/server\.arcgisonline\.com/,
  );
  const readsBeforeTraversal = harness.calls.readPaths.length;
  const traversal = await harness.calls.protocol.handler({
    url: 'app://rls.local/%5c..%5cpackage.json',
    method: 'GET',
    headers: new Headers(),
  });
  assert.equal(traversal.status, 404);
  assert.equal(harness.calls.readPaths.length, readsBeforeTraversal);
  const foreignHost = await harness.calls.protocol.handler({
    url: 'app://elsewhere.local/',
    method: 'GET',
    headers: new Headers(),
  });
  assert.equal(foreignHost.status, 404);

  const api = await harness.calls.protocol.handler({
    url: 'app://rls.local/api/health?ready=1',
    method: 'GET',
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(0),
    signal: new AbortController().signal,
  });
  assert.equal(api.status, 200);
  assert.equal(harness.calls.fetch[0].url, 'http://127.0.0.1:42321/api/health?ready=1');
  assert.equal(harness.calls.fetch.length, 1);

  let sameOriginBlocked = false;
  harness.windows[0].webContents.emit(
    'will-navigate',
    {
      preventDefault: () => {
        sameOriginBlocked = true;
      },
    },
    'app://rls.local/profile?tab=history',
  );
  assert.equal(sameOriginBlocked, false);
  assert.equal(new URL('app://rls.local/profile').origin, 'null');
  let nonDefaultPortBlocked = false;
  harness.windows[0].webContents.emit(
    'will-navigate',
    {
      preventDefault: () => {
        nonDefaultPortBlocked = true;
      },
    },
    'app://rls.local:3000/profile',
  );
  assert.equal(nonDefaultPortBlocked, true);

  let navigationBlocked = false;
  harness.windows[0].webContents.emit(
    'will-navigate',
    {
      preventDefault: () => {
        navigationBlocked = true;
      },
    },
    'https://example.com/',
  );
  assert.equal(navigationBlocked, true);
});

test('reports child exit before readiness and does not accept another process as the server', async () => {
  const harness = createHarness();
  await flush();
  harness.child.exitCode = 1;
  harness.child.emit('exit', 1, null);
  await flush();

  assert.equal(harness.windows.length, 0);
  assert.equal(harness.calls.fetch.length, 0);
  assert.equal(harness.errors.length, 1);
  assert.equal(harness.calls.quit, 1);
});

test('times out startup, kills the child, and reports a backend crash after readiness', async () => {
  const timedOut = createHarness();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(timedOut.windows.length, 0);
  assert.equal(timedOut.errors.length, 1);
  if (process.platform !== 'win32') {
    assert.strictEqual(child.signalCode, 'SIGTERM');
  }

  assert.equal(timedOut.calls.quit, 1);

  const crashed = createHarness();
  await flush();
  crashed.child.emit('message', {
    type: 'server-ready',
    host: '127.0.0.1',
    port: 42_323,
  });
  await flush();
  crashed.child.exitCode = 1;
  crashed.child.emit('exit', 1, null);
  await flush();
  assert.equal(crashed.windows.length, 1);
  assert.equal(crashed.errors.length, 1);
  assert.equal(crashed.calls.quit, 1);

  const errored = createHarness();
  await flush();
  errored.child.emit('message', {
    type: 'server-ready',
    host: '127.0.0.1',
    port: 42_324,
  });
  await flush();
  errored.child.emit('error', new Error('unexpected child failure'));
  await flush();
  assert.equal(errored.errors.length, 1);
  assert.equal(errored.calls.quit, 1);
});

test('rejects an invalid port announcement and shuts down the owned child on quit', async () => {
  const harness = createHarness();
  await flush();
  harness.child.emit('message', {
    type: 'server-ready',
    host: '127.0.0.1',
    port: 65_536,
  });
  await flush();
  assert.equal(harness.windows.length, 0);
  assert.equal(harness.errors.length, 1);

  harness.child.exitCode = 1;
  harness.child.emit('exit', 1, null);
  await flush();

  const second = createHarness();
  await flush();
  second.child.emit('message', {
    type: 'server-ready',
    host: '127.0.0.1',
    port: 42_322,
  });
  await flush();
  let prevented = false;
  second.appHandlers.get('before-quit')({
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(JSON.stringify(second.calls.shutdownMessage), JSON.stringify({ type: 'shutdown' }));
  second.child.emit('exit', 0, null);
  await flush();
  assert.equal(second.calls.quit, 1);
});
