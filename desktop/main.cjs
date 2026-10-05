// desktop/main.cjs
// Десктопная оболочка (п.2.1, п.2.2 ТЗ): поднимает API-сервер, который отдаёт
// собранный клиент, и открывает его в окне Electron.
const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = Number(process.env.PORT ?? 3001);
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const SERVER_ENTRY = path.join(__dirname, '..', 'server', 'dist', 'index.js');

let serverProcess = null;

const startServer = () => {
  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    env: { ...process.env, PORT: String(PORT), ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });

  serverProcess.on('exit', (code) => {
    if (code) console.error('[desktop] сервер завершился с кодом', code);
  });
};

const waitForServer = async (attempts = 80) => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) return true;
    } catch {
      // сервер ещё поднимается
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0d1b2a',
    title: 'Тренажёр оператора РЛС · Центр 2401',
    autoHideMenuBar: true,
  });

  window.loadURL(`http://localhost:${PORT}/`);
  return window;
};

const stopServer = () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  serverProcess = null;
};

app.whenReady().then(async () => {
  startServer();

  if (!(await waitForServer())) {
    console.error('[desktop] сервер не ответил, окно откроется без данных');
  }

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('before-quit', stopServer);
