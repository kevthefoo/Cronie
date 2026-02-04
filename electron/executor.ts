import { spawn, ChildProcess } from 'child_process';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { getDb, saveDb } from './db';
import { getMainWindow } from './main';

// Track active child processes for kill support
const activeProcesses = new Map<string, ChildProcess>();

export function killProcess(sessionId: string): boolean {
  const child = activeProcesses.get(sessionId);
  if (!child) return false;
  child.kill('SIGTERM');
  setTimeout(() => {
    try { child.kill('SIGKILL'); } catch (_) { /* already dead */ }
  }, 5000);
  return true;
}

function bashEscape(cmd: string): string {
  return "'" + cmd.replace(/'/g, "'\\''") + "'";
}

export interface TaskConfig {
  command?: string;
  workingDirectory?: string;
  envVars?: Record<string, string>;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  expectedStatus?: number;
}

export interface Task {
  id: number;
  name: string;
  description: string;
  cron_expression: string;
  task_type: 'shell' | 'http' | 'plugin';
  config: string;
  enabled: number;
  tags: string;
  retry_count: number;
  retry_delay_ms: number;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
}

export interface ExecutionResult {
  status: 'success' | 'failure' | 'timeout';
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  http_status?: number;
  http_response_body?: string;
  error_message?: string;
  error_stack?: string;
  duration_ms: number;
}

function queryAll(sql: string, params: any[] = []): any[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql: string, params: any[] = []): any | undefined {
  const rows = queryAll(sql, params);
  return rows[0];
}

function runSql(sql: string, params: any[] = []) {
  const db = getDb();
  db.run(sql, params);
  saveDb();
}

export { queryAll, queryOne, runSql };

export async function executeTask(task: Task, retryAttempt = 0): Promise<ExecutionResult> {
  const config: TaskConfig = JSON.parse(task.config);
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  runSql(
    `INSERT INTO execution_logs (task_id, start_time, status, retry_attempt) VALUES (?, ?, 'running', ?)`,
    [task.id, startTime, retryAttempt]
  );

  const lastRow = queryOne('SELECT MAX(id) as id FROM execution_logs');
  const logId = lastRow?.id;

  let result: ExecutionResult;

  try {
    if (task.task_type === 'shell') {
      result = await executeShell(config, task.timeout_ms, task.name, task.id);
    } else if (task.task_type === 'http') {
      result = await executeHttp(config, task.timeout_ms);
    } else {
      result = { status: 'failure', error_message: `Unknown task type: ${task.task_type}`, duration_ms: Date.now() - startMs };
    }
  } catch (err: any) {
    result = { status: 'failure', error_message: err.message, error_stack: err.stack, duration_ms: Date.now() - startMs };
  }

  result.duration_ms = Date.now() - startMs;
  const endTime = new Date().toISOString();

  runSql(`
    UPDATE execution_logs SET
      end_time = ?, duration_ms = ?, status = ?, exit_code = ?,
      stdout = ?, stderr = ?, http_status = ?, http_response_body = ?,
      error_message = ?, error_stack = ?
    WHERE id = ?
  `, [
    endTime, result.duration_ms, result.status, result.exit_code ?? null,
    result.stdout ?? '', result.stderr ?? '', result.http_status ?? null,
    result.http_response_body ?? null, result.error_message ?? null,
    result.error_stack ?? null, logId
  ]);

  if (result.status === 'failure' && retryAttempt < task.retry_count) {
    await new Promise(resolve => setTimeout(resolve, task.retry_delay_ms * (retryAttempt + 1)));
    return executeTask(task, retryAttempt + 1);
  }

  return result;
}

function executeShell(config: TaskConfig, timeoutMs: number, taskName: string, taskId: number): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const startMs = Date.now();
    const command = config.command || 'echo "no command"';
    const sessionId = `task-${taskId}-${Date.now()}`;
    const mainWin = getMainWindow();

    const sendToRenderer = (channel: string, data: any) => {
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send(channel, data);
      }
    };

    // Notify renderer of new terminal session
    sendToRenderer('terminal:session-start', { sessionId, taskName, command });

    // Spawn using stdbuf to force line-buffered output for real-time streaming
    const child = spawn('C:\\Program Files\\Git\\usr\\bin\\bash.exe', [
      '-c', `stdbuf -oL -eL bash -c ${bashEscape(command)}`
    ], {
      cwd: config.workingDirectory || undefined,
      env: { ...process.env, ...config.envVars, PYTHONUNBUFFERED: '1' },
    });

    // Track process for kill support
    activeProcesses.set(sessionId, child);

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let processExited = false;

    // Set up timeout
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (processExited) return;
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          try { child.kill('SIGKILL'); } catch (_) { /* already dead */ }
        }, 5000);
      }, timeoutMs);
    }

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      sendToRenderer('terminal:stdout', { sessionId, data: text });
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      sendToRenderer('terminal:stderr', { sessionId, data: text });
    });

    child.on('close', (code: number | null) => {
      processExited = true;
      activeProcesses.delete(sessionId);
      if (timer) clearTimeout(timer);
      const duration_ms = Date.now() - startMs;
      const exitCode = code ?? 0;

      let result: ExecutionResult;
      if (timedOut) {
        result = { status: 'timeout', exit_code: exitCode, stdout, stderr, error_message: 'Task timed out', duration_ms };
      } else if (exitCode !== 0) {
        result = { status: 'failure', exit_code: exitCode, stdout, stderr, error_message: `Process exited with code ${exitCode}`, duration_ms };
      } else {
        result = { status: 'success', exit_code: 0, stdout, stderr, duration_ms };
      }

      sendToRenderer('terminal:exit', { sessionId, code: exitCode, status: result.status });
      resolve(result);
    });

    child.on('error', (err: Error) => {
      activeProcesses.delete(sessionId);
      if (timer) clearTimeout(timer);
      const duration_ms = Date.now() - startMs;
      const result: ExecutionResult = { status: 'failure', error_message: err.message, error_stack: err.stack, duration_ms };
      sendToRenderer('terminal:exit', { sessionId, code: null, status: 'failure' });
      resolve(result);
    });
  });
}

function executeHttp(config: TaskConfig, timeoutMs: number): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const startMs = Date.now();
    const url = new URL(config.url || 'https://example.com');
    const protocol = url.protocol === 'https:' ? https : http;
    const options: any = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method: (config.method || 'GET').toUpperCase(),
      headers: config.headers || {}, timeout: timeoutMs,
    };

    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        const duration_ms = Date.now() - startMs;
        const httpStatus = res.statusCode || 0;
        const expected = config.expectedStatus || 200;
        const isSuccess = httpStatus >= 200 && httpStatus < 400 && (!config.expectedStatus || httpStatus === expected);
        resolve({ status: isSuccess ? 'success' : 'failure', http_status: httpStatus, http_response_body: body.substring(0, 10000), duration_ms, error_message: isSuccess ? undefined : `HTTP ${httpStatus} (expected ${expected})` });
      });
    });

    req.on('error', (err: Error) => { resolve({ status: 'failure', error_message: err.message, duration_ms: Date.now() - startMs }); });
    req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout', error_message: 'HTTP request timed out', duration_ms: Date.now() - startMs }); });
    if (config.body) req.write(config.body);
    req.end();
  });
}
