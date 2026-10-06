const { app, BrowserWindow, Menu, dialog, protocol } = require('electron');
const { spawn } = require('node:child_process');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const SCHEME = 'app';
const APP_HOST = 'rls.local';
const ORIGIN = `${SCHEME}://${APP_HOST}`;
const TITLE = 'Тренажёр оператора РЛС · Центр 2401';
const START_TIMEOUT_MS = 15_000;
const STOP_TIMEOUT_MS = 2_000;
const serverEntry = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'dist-desktop', 'index.cjs')
    : path.join(__dirname, '..', 'server', 'dist-desktop', 'index.cjs');

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

/** @type {import('node:child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {number | null} */
let serverPort = null;
let stopPromise = null;
let allowQuit = false;
let shutdownStarted = false;

const clientDirectory = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'client-dist')
    : path.join(__dirname, '..', 'client', 'dist');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://server.arcgisonline.com",
  "font-src 'self' data:",
  "connect-src 'self' https://server.arcgisonline.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const response = (body, status = 200, headers = {}) =>
  new Response([204, 205, 304].includes(status) ? null : body, {
    status,
    headers,
  });

const serveRendererFile = async (requestUrl, method) => {
  const url = new URL(requestUrl);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return response('Bad request', 400);
  }
  if (pathname.includes('\\') || pathname.split('/').some((part) => part === '..')) {
    return response('Not found', 404);
  }

  const root = path.resolve(clientDirectory());
  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  let filePath = path.resolve(root, requestedPath);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== root) return response('Not found', 404);

  try {
    const bytes = await readFile(filePath);
    const headers = {
      'content-type': mimeTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    };
    if (path.basename(filePath) === 'index.html') headers['content-security-policy'] = contentSecurityPolicy;
    return response(method === 'HEAD' ? null : bytes, 200, headers);
  } catch (error) {
    if (path.extname(filePath)) return response('Not found', 404);
    filePath = path.join(root, 'index.html');
    try {
      const bytes = await readFile(filePath);
      return response(method === 'HEAD' ? null : bytes, 200, {
        'content-type': mimeTypes['.html'],
        'content-security-policy': contentSecurityPolicy,
      });
    } catch {
      console.error('[desktop] renderer files are missing', error);
      return response('Application files are missing', 500);
    }
  }
};

const proxyApiRequest = async (request) => {
  if (serverPort === null) return response('Server is not ready', 503);
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith('/api/')) return response('Not found', 404);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  const method = request.method.toUpperCase();
  try {
    const upstream = await fetch(`http://127.0.0.1:${serverPort}${incoming.pathname}${incoming.search}`, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('connection');
    responseHeaders.delete('content-length');
    return response(await upstream.arrayBuffer(), upstream.status, responseHeaders);
  } catch (error) {
    console.error('[desktop] API request failed', error);
    return response(JSON.stringify({ message: 'Сервер приложения недоступен' }), 502, {
      'content-type': 'application/json; charset=utf-8',
    });
  }
};

const registerApplicationProtocol = async () => {
  await protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.hostname !== APP_HOST) return response('Not found', 404);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return proxyApiRequest(request);
    if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) return response('Method not allowed', 405);
    return serveRendererFile(request.url, request.method.toUpperCase());
  });
};

const serverEnvironment = () => ({
  ...process.env,
  PORT: '0',
  HOST: '127.0.0.1',
  RLS_DATA_DIR: path.join(app.getPath('userData'), 'data'),
  RLS_CLIENT_DIR: clientDirectory(),
  ELECTRON_RUN_AS_NODE: '1',
});

const startServer = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverEntry()], {
      env: serverEnvironment(),
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    serverProcess = child;
    let settled = false;
    const finish = (error, port) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener('message', onMessage);
      child.removeListener('error', onError);
      child.removeListener('exit', onExit);
      if (error) reject(error);
      else resolve(port);
    };
    const onMessage = (message) => {
      if (message?.type !== 'server-ready') return;
      if (
        message.host !== '127.0.0.1' ||
        !Number.isInteger(message.port) ||
        message.port < 1 ||
        message.port > 65535
      ) {
        finish(new Error('Server sent an invalid ready address'));
        return;
      }
      serverPort = message.port;
      child.on('error', (error) => {
        if (shutdownStarted || serverProcess !== child) return;
        serverPort = null;
        console.error('[desktop] server process failed', error);
        dialog.showErrorBox(TITLE, 'Не удалось продолжить работу сервера приложения. Тренажёр будет закрыт.');
        app.quit();
      });
      child.on('exit', (code, signal) => {
        if (shutdownStarted || serverProcess !== child) return;
        serverPort = null;
        console.error(`[desktop] server exited unexpectedly (code=${code}, signal=${signal})`);
        dialog.showErrorBox(TITLE, 'Сервер приложения завершил работу. Тренажёр будет закрыт.');
        app.quit();
      });
      finish(null, message.port);
    };
    const onError = (error) => finish(error);
    const onExit = (code, signal) =>
      finish(new Error(`Server exited before becoming ready (code=${code}, signal=${signal})`));
    const timeout = setTimeout(() => finish(new Error('Server startup timed out')), START_TIMEOUT_MS);
    child.on('message', onMessage);
    child.on('error', onError);
    child.on('exit', onExit);
  });

const stopServer = () => {
  if (stopPromise) return stopPromise;
  if (!serverProcess) return Promise.resolve();
  const child = serverProcess;
  shutdownStarted = true;
  serverProcess = null;
  serverPort = null;
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  stopPromise = new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      child.removeListener('exit', finish);
      if (child.connected) child.disconnect();
      stopPromise = null;
      resolve();
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish();
    }, STOP_TIMEOUT_MS);
    child.once('exit', finish);
    try {
      if (child.connected)
        child.send({ type: 'shutdown' }, (error) => {
          if (error) child.kill();
        });
      else child.kill();
    } catch {
      child.kill();
    }
  });
  return stopPromise;
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0d1b2a',
    title: TITLE,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    const url = new URL(target);
    const isApplicationPage =
      url.protocol === `${SCHEME}:` &&
      url.hostname === APP_HOST &&
      !url.port &&
      !url.username &&
      !url.password;
    if (!isApplicationPage) event.preventDefault();
  });
  void window
    .loadURL(`${ORIGIN}/`)
    .catch((error) => console.error('[desktop] failed to load application', error));
  return window;
};

const main = async () => {
  if (!process.env.RLS_DEVTOOLS) Menu.setApplicationMenu(null);
  try {
    await registerApplicationProtocol();
    await startServer();
    createWindow();
  } catch (error) {
    console.error('[desktop] startup failed', error);
    dialog.showErrorBox(TITLE, 'Не удалось запустить приложение. Перезапустите тренажёр.');
    await stopServer();
    app.quit();
  }
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverPort !== null) createWindow();
  });
  void app.whenReady().then(main);
}

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;
  void stopServer().then(() => app.quit());
});
app.on('before-quit', (event) => {
  if (allowQuit) return;
  event.preventDefault();
  void stopServer().then(() => {
    allowQuit = true;
    app.quit();
  });
});
