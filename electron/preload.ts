import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Tasks
  getTasks: () => ipcRenderer.invoke('tasks:list'),
  getTask: (id: number) => ipcRenderer.invoke('tasks:get', id),
  createTask: (task: any) => ipcRenderer.invoke('tasks:create', task),
  updateTask: (id: number, updates: any) => ipcRenderer.invoke('tasks:update', id, updates),
  deleteTask: (id: number) => ipcRenderer.invoke('tasks:delete', id),
  toggleTask: (id: number) => ipcRenderer.invoke('tasks:toggle', id),
  runTaskNow: (id: number) => ipcRenderer.invoke('tasks:run-now', id),
  reorderTasks: (taskIds: number[]) => ipcRenderer.invoke('tasks:reorder', taskIds),

  // Logs
  getLogs: (filters?: any) => ipcRenderer.invoke('logs:list', filters),
  deleteLog: (logId: number) => ipcRenderer.invoke('logs:delete', logId),
  getLogCount: () => ipcRenderer.invoke('logs:count'),
  getStats: () => ipcRenderer.invoke('logs:stats'),
  exportLogs: (format: string, filters?: any) => ipcRenderer.invoke('logs:export', format, filters),
  clearLogs: (taskId?: number) => ipcRenderer.invoke('logs:clear', taskId),

  // Scheduler
  pauseScheduler: () => ipcRenderer.invoke('scheduler:pause'),
  resumeScheduler: () => ipcRenderer.invoke('scheduler:resume'),
  getSchedulerStatus: () => ipcRenderer.invoke('scheduler:status'),

  // Utilities
  validatePath: (dirPath: string) => ipcRenderer.invoke('fs:validate-path', dirPath),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

  // Terminal
  onTerminalSessionStart: (callback: (data: { sessionId: string; taskName: string; command: string }) => void) => {
    ipcRenderer.on('terminal:session-start', (_event, data) => callback(data));
  },
  onTerminalStdout: (callback: (data: { sessionId: string; data: string }) => void) => {
    ipcRenderer.on('terminal:stdout', (_event, data) => callback(data));
  },
  onTerminalStderr: (callback: (data: { sessionId: string; data: string }) => void) => {
    ipcRenderer.on('terminal:stderr', (_event, data) => callback(data));
  },
  onTerminalExit: (callback: (data: { sessionId: string; code: number | null; status: string }) => void) => {
    ipcRenderer.on('terminal:exit', (_event, data) => callback(data));
  },
  removeTerminalListeners: () => {
    ipcRenderer.removeAllListeners('terminal:session-start');
    ipcRenderer.removeAllListeners('terminal:stdout');
    ipcRenderer.removeAllListeners('terminal:stderr');
    ipcRenderer.removeAllListeners('terminal:exit');
  },
  killTerminalSession: (sessionId: string) => ipcRenderer.invoke('terminal:kill', sessionId),
};

contextBridge.exposeInMainWorld('api', api);
