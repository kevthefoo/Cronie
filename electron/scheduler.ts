import * as cron from 'node-cron';
import { executeTask, Task, queryAll, queryOne, runSql } from './executor';

const scheduledJobs: Map<number, cron.ScheduledTask> = new Map();
let paused = false;

// Clean up stale "running" tasks on startup (tasks stuck from previous crashes)
function cleanupStaleRunningTasks() {
  // Mark any tasks that have been "running" for more than 1 hour as failed
  runSql(`
    UPDATE execution_logs
    SET status = 'failure',
        error_message = 'Task was interrupted (app crash or restart)',
        end_time = datetime('now'),
        duration_ms = CAST((julianday('now') - julianday(start_time)) * 86400000 AS INTEGER)
    WHERE status = 'running'
    AND datetime(start_time) < datetime('now', '-1 hour')
  `);
}

export function startScheduler() {
  cleanupStaleRunningTasks();
  const tasks = queryAll('SELECT * FROM tasks WHERE enabled = 1') as Task[];
  for (const task of tasks) {
    scheduleTask(task);
  }
}

export function scheduleTask(task: Task) {
  unscheduleTask(task.id);
  if (!task.enabled || !cron.validate(task.cron_expression)) return;

  const job = cron.schedule(task.cron_expression, async () => {
    if (paused) return;
    try { await executeTask(task); } catch (err) { console.error(`Task ${task.id} error:`, err); }
  });
  scheduledJobs.set(task.id, job);
}

export function unscheduleTask(taskId: number) {
  const existing = scheduledJobs.get(taskId);
  if (existing) { existing.stop(); scheduledJobs.delete(taskId); }
}

export function rescheduleTask(taskId: number) {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]) as Task | undefined;
  if (task) scheduleTask(task);
  else unscheduleTask(taskId);
}

export function pauseAll() { paused = true; }
export function resumeAll() { paused = false; }
export function isPaused() { return paused; }

export function stopScheduler() {
  for (const [, job] of scheduledJobs) job.stop();
  scheduledJobs.clear();
}
