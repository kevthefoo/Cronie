import { app, BrowserWindow, Tray, Menu, nativeImage, Notification } from 'electron';
import path from 'path';
import { initDb, closeDb } from './db';
import { startScheduler, stopScheduler, pauseAll, resumeAll, isPaused } from './scheduler';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

const isDev = !app.isPackaged;

function getIconPath(): string {
  if (isDev) {
    return path.join(app.getAppPath(), 'assets', 'Icon.png');
  }
  return path.join(process.resourcesPath, 'assets', 'Icon.png');
}

const appIcon = nativeImage.createFromPath(getIconPath());

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Cronie',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  const trayIcon = appIcon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('Cronie - Task Scheduler');

  updateTrayMenu();

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Cronie', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    {
      label: isPaused() ? 'Resume All Tasks' : 'Pause All Tasks',
      click: () => {
        if (isPaused()) resumeAll();
        else pauseAll();
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(async () => {
  // Initialize database
  await initDb();

  // Register IPC handlers
  registerIpcHandlers();

  // Create window and tray
  createWindow();
  createTray();

  // Start scheduler
  startScheduler();
});

app.on('window-all-closed', () => {
  // Don't quit on window close - keep running in tray
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  stopScheduler();
  closeDb();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});
