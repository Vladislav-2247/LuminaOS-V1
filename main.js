const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    },
    icon: path.join(__dirname, 'icon/icon_pusk.jpg')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  ipcMain.on('close-window', () => mainWindow.close());
  ipcMain.on('minimize-window', () => mainWindow.minimize());
  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });

  mainWindow.on('enter-fullscreen', () => mainWindow.webContents.send('fullscreen-changed', true));
  mainWindow.on('leave-fullscreen', () => mainWindow.webContents.send('fullscreen-changed', false));

  // Обработчик изменения громкости (реальная громкость Windows)
  ipcMain.on('set-volume', (event, volume) => {
    // Обход ограничений: используем shell для вызова утилиты nircmd или меняем громкость приложения
    // Но чтобы менять системную громкость, нужен внешний модуль, поэтому мы управляем громкостью Electron
    mainWindow.webContents.setVolume(volume / 100);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});