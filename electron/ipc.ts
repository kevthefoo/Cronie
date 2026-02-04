import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import { executeTask, Task, queryAll, queryOne, runSql, killProcess } from './executor';
import { rescheduleTask, pauseAll, resumeAll, isPaused } from './scheduler';
import { saveDb } from './db';

export function registerIpcHandlers() {
  // Window controls
  ipcMain.handle('window:minimize', (e) => { BrowserWindow.fromWebContents(e.sender)?.minimize(); });
  ipcMain.handle('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win?.isMaximized()) win.unmaximize(); else win?.maximize();
  });
  ipcMain.handle('window:close', (e) => { BrowserWindow.fromWebContents(e.sender)?.close(); });

  // Utilities
  ipcMain.handle('fs:validate-path', (_e, dirPath: string) => {
    try {
      const stat = fs.statSync(dirPath);
      return { valid: stat.isDirectory(), error: stat.isDirectory() ? null : 'Path is not a directory' };
    } catch {
      return { valid: false, error: 'Path does not exist' };
    }
  });

  // Tasks CRUD
  ipcMain.handle('tasks:list', () => queryAll('SELECT * FROM tasks ORDER BY created_at DESC'));

  ipcMain.handle('tasks:get', (_e, id: number) => queryOne('SELECT * FROM tasks WHERE id = ?', [id]));

  ipcMain.handle('tasks:create', (_e, task: Partial<Task>) => {
    runSql(
      `INSERT INTO tasks (name, description, cron_expression, task_type, config, enabled, tags, retry_count, retry_delay_ms, timeout_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [task.name, task.description || '', task.cron_expression, task.task_type,
       task.config || '{}', task.enabled ?? 1, task.tags || '',
       task.retry_count || 0, task.retry_delay_ms || 1000, task.timeout_ms || 30000]
    );
    const row = queryOne('SELECT MAX(id) as id FROM tasks');
    const newTask = queryOne('SELECT * FROM tasks WHERE id = ?', [row.id]);
    rescheduleTask(newTask.id);
    return newTask;
  });

  ipcMain.handle('tasks:update', (_e, id: number, updates: Partial<Task>) => {
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(updates)) {
      if (key === 'id' || key === 'created_at') continue;
      fields.push(`${key} = ?`);
      values.push(val);
    }
    fields.push("updated_at = datetime('now')");
    values.push(id);
    runSql(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
    rescheduleTask(id);
    return queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
  });

  ipcMain.handle('tasks:delete', (_e, id: number) => {
    runSql('DELETE FROM tasks WHERE id = ?', [id]);
    rescheduleTask(id);
    return { success: true };
  });

  ipcMain.handle('tasks:toggle', (_e, id: number) => {
    runSql("UPDATE tasks SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?", [id]);
    rescheduleTask(id);
    return queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
  });

  ipcMain.handle('tasks:run-now', async (_e, id: number) => {
    const task = queryOne('SELECT * FROM tasks WHERE id = ?', [id]) as Task | undefined;
    if (!task) return { error: 'Task not found' };
    return executeTask(task);
  });

  // Logs
  ipcMain.handle('logs:list', (_e, filters?: { taskId?: number; status?: string; search?: string; limit?: number; offset?: number }) => {
    let query = 'SELECT l.*, t.name as task_name FROM execution_logs l LEFT JOIN tasks t ON l.task_id = t.id WHERE 1=1';
    const params: any[] = [];

    if (filters?.taskId) { query += ' AND l.task_id = ?'; params.push(filters.taskId); }
    if (filters?.status) { query += ' AND l.status = ?'; params.push(filters.status); }
    if (filters?.search) {
      query += ' AND (l.stdout LIKE ? OR l.stderr LIKE ? OR l.error_message LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }
    query += ' ORDER BY l.start_time DESC';
    query += ` LIMIT ? OFFSET ?`;
    params.push(filters?.limit || 100, filters?.offset || 0);
    return queryAll(query, params);
  });

  ipcMain.handle('logs:count', () => queryOne('SELECT COUNT(*) as count FROM execution_logs'));

  ipcMain.handle('logs:stats', () => {
    const total = queryOne('SELECT COUNT(*) as count FROM execution_logs')?.count || 0;
    const success = queryOne("SELECT COUNT(*) as count FROM execution_logs WHERE status = 'success'")?.count || 0;
    const failure = queryOne("SELECT COUNT(*) as count FROM execution_logs WHERE status = 'failure'")?.count || 0;
    const timeout = queryOne("SELECT COUNT(*) as count FROM execution_logs WHERE status = 'timeout'")?.count || 0;
    const recent = queryAll('SELECT l.*, t.name as task_name FROM execution_logs l LEFT JOIN tasks t ON l.task_id = t.id ORDER BY l.start_time DESC LIMIT 10');
    const failingTasks = queryAll(`
      SELECT t.id, t.name, COUNT(*) as failure_count
      FROM execution_logs l JOIN tasks t ON l.task_id = t.id
      WHERE l.status = 'failure'
      GROUP BY t.id ORDER BY failure_count DESC LIMIT 5
    `);
    return { total, success, failure, timeout, recent, failingTasks };
  });

  ipcMain.handle('logs:export', (_e, format: 'json' | 'csv', filters?: { taskId?: number; status?: string }) => {
    let query = 'SELECT l.*, t.name as task_name FROM execution_logs l LEFT JOIN tasks t ON l.task_id = t.id WHERE 1=1';
    const params: any[] = [];
    if (filters?.taskId) { query += ' AND l.task_id = ?'; params.push(filters.taskId); }
    if (filters?.status) { query += ' AND l.status = ?'; params.push(filters.status); }
    query += ' ORDER BY l.start_time DESC';
    const rows = queryAll(query, params);

    if (format === 'json') return JSON.stringify(rows, null, 2);
    if (format === 'csv') {
      if (rows.length === 0) return '';
      const headers = Object.keys(rows[0]).join(',');
      const lines = rows.map((r: any) => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      return [headers, ...lines].join('\n');
    }
    return '';
  });

  ipcMain.handle('logs:delete', (_e, logId: number) => {
    runSql('DELETE FROM execution_logs WHERE id = ?', [logId]);
    return { success: true };
  });

  ipcMain.handle('logs:clear', (_e, taskId?: number) => {
    if (taskId) runSql('DELETE FROM execution_logs WHERE task_id = ?', [taskId]);
    else runSql('DELETE FROM execution_logs');
    return { success: true };
  });

  // Scheduler control
  ipcMain.handle('scheduler:pause', () => { pauseAll(); return { paused: true }; });
  ipcMain.handle('scheduler:resume', () => { resumeAll(); return { paused: false }; });
  ipcMain.handle('scheduler:status', () => ({ paused: isPaused() }));

  // Terminal
  ipcMain.handle('terminal:kill', (_e, sessionId: string) => {
    return { killed: killProcess(sessionId) };
  });

  // Settings
  ipcMain.handle('settings:get', (_e, key: string) => {
    const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? null;
  });

  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    runSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    return { success: true };
  });
}
