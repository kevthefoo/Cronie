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

export interface ExecutionLog {
  id: number;
  task_id: number;
  task_name?: string;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  status: 'running' | 'success' | 'failure' | 'timeout' | 'skipped';
  exit_code: number | null;
  stdout: string;
  stderr: string;
  http_status: number | null;
  http_response_body: string | null;
  error_message: string | null;
  error_stack: string | null;
  retry_attempt: number;
  created_at: string;
}

export interface Stats {
  total: number;
  success: number;
  failure: number;
  timeout: number;
  recent: ExecutionLog[];
  failingTasks: { id: number; name: string; failure_count: number }[];
}

export interface ShellConfig {
  command: string;
  workingDirectory?: string;
  envVars?: Record<string, string>;
}

export interface HttpConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  expectedStatus?: number;
}

declare global {
  interface Window {
    api: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      getTasks: () => Promise<Task[]>;
      getTask: (id: number) => Promise<Task>;
      createTask: (task: Partial<Task>) => Promise<Task>;
      updateTask: (id: number, updates: Partial<Task>) => Promise<Task>;
      deleteTask: (id: number) => Promise<{ success: boolean }>;
      toggleTask: (id: number) => Promise<Task>;
      runTaskNow: (id: number) => Promise<any>;
      getLogs: (filters?: any) => Promise<ExecutionLog[]>;
      getLogCount: () => Promise<{ count: number }>;
      getStats: () => Promise<Stats>;
      exportLogs: (format: string, filters?: any) => Promise<string>;
      clearLogs: (taskId?: number) => Promise<{ success: boolean }>;
      pauseScheduler: () => Promise<{ paused: boolean }>;
      resumeScheduler: () => Promise<{ paused: boolean }>;
      getSchedulerStatus: () => Promise<{ paused: boolean }>;
      getSetting: (key: string) => Promise<string | null>;
      setSetting: (key: string, value: string) => Promise<{ success: boolean }>;
      validatePath: (dirPath: string) => Promise<{ valid: boolean; error: string | null }>;
      // Terminal
      onTerminalSessionStart: (callback: (data: { sessionId: string; taskName: string; command: string }) => void) => void;
      onTerminalStdout: (callback: (data: { sessionId: string; data: string }) => void) => void;
      onTerminalStderr: (callback: (data: { sessionId: string; data: string }) => void) => void;
      onTerminalExit: (callback: (data: { sessionId: string; code: number | null; status: string }) => void) => void;
      removeTerminalListeners: () => void;
      killTerminalSession: (sessionId: string) => Promise<{ killed: boolean }>;
    };
  }
}
