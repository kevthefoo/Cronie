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

function createAppIcon(size: number): Electron.NativeImage {
  const buf = Buffer.alloc(size * size * 4, 0);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;

      if (dist <= r) {
        // Purple circle background (#7C3AED)
        buf[i] = 124;     // R
        buf[i + 1] = 58;  // G
        buf[i + 2] = 237; // B
        buf[i + 3] = 255; // A

        // Anti-alias edge
        if (dist > r - 1.5) {
          buf[i + 3] = Math.round(255 * (r - dist) / 1.5);
        }
      }

      // Clock hands (white)
      // Hour hand: pointing up-right (~2 o'clock)
      const hourLen = r * 0.5;
      const hourAngle = -Math.PI / 6; // 1 o'clock
      const hourEndX = cx + Math.sin(hourAngle) * hourLen;
      const hourEndY = cy - Math.cos(hourAngle) * hourLen;
      if (dist <= r - 2 && distToSegment(x, y, cx, cy, hourEndX, hourEndY) < 1.8) {
        buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255;
      }

      // Minute hand: pointing right (~15 min)
      const minLen = r * 0.7;
      const minAngle = Math.PI / 2; // 3 o'clock
      const minEndX = cx + Math.sin(minAngle) * minLen;
      const minEndY = cy - Math.cos(minAngle) * minLen;
      if (dist <= r - 2 && distToSegment(x, y, cx, cy, minEndX, minEndY) < 1.2) {
        buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255;
      }

      // Center dot
      if (dist < 2) {
        buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255;
      }
    }
  }

  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Cronie',
    icon: createAppIcon(256),
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
  const icon = createAppIcon(16);
  tray = new Tray(icon);
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
