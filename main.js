const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

let mainWindow;

// Путь к папке Downloads в корне проекта
const downloadsPath = path.join(__dirname, 'Downloads');
if (!fs.existsSync(downloadsPath)) {
  fs.mkdirSync(downloadsPath);
}

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

  // Обработчик для чтения папок (реальные файлы)
  ipcMain.handle('list-files', async (event, dirPath) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(dirPath, entry.name)
      }));
    } catch (err) {
      return [];
    }
  });

  // Обработчик для поиска игр
  ipcMain.handle('get-games', async () => {
    function findGamesInFolder(folderPath) {
      const results = [];
      try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subPath = path.join(folderPath, entry.name);
            try {
              const files = fs.readdirSync(subPath);
              for (const file of files) {
                if (file.toLowerCase().endsWith('.exe')) {
                  results.push({ name: entry.name, path: path.join(subPath, file) });
                  break;
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
      return results;
    }
    const searchPaths = [
      'C:/Program Files (x86)/Steam/steamapps/common',
      'C:/Program Files/Epic Games',
      'C:/Program Files (x86)/Epic Games',
      'C:/GOG Games',
      'C:/Program Files',
      'C:/Program Files (x86)'
    ];
    let allGames = [];
    for (const p of searchPaths) {
      allGames = allGames.concat(findGamesInFolder(p));
    }
    const unique = [];
    const seen = new Set();
    for (const game of allGames) {
      if (!seen.has(game.path)) {
        seen.add(game.path);
        unique.push(game);
      }
    }
    return unique;
  });

  ipcMain.handle('launch-game', async (event, gamePath) => {
    try {
      await require('electron').shell.openPath(gamePath);
      return true;
    } catch (e) {
      return false;
    }
  });

  // Обработчик скачивания файлов (сохраняет в Downloads)
  ipcMain.handle('download-file', async (event, fileInfo) => {
    try {
      const { url, fileName } = fileInfo;
      const destPath = path.join(downloadsPath, fileName);
      const response = await require('electron').net.fetch(url);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(destPath, Buffer.from(buffer));
      const stats = fs.statSync(destPath);
      return { success: true, size: stats.size, path: destPath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Отправка списка файлов в Downloads
  ipcMain.handle('get-downloads', async () => {
    try {
      const files = fs.readdirSync(downloadsPath, { withFileTypes: true });
      return files.filter(f => !f.isDirectory()).map(f => ({
        name: f.name,
        path: path.join(downloadsPath, f.name),
        size: fs.statSync(path.join(downloadsPath, f.name)).size
      }));
    } catch (e) {
      return [];
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});