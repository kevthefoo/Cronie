# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development (starts Vite + Electron concurrently)
npm run electron:dev

# Build for production
npm run electron:build

# Vite-only dev server (frontend only, no Electron)
npm run dev
```

The app runs on `localhost:5173` (Vite dev server). Electron waits for Vite to be ready before launching.

## Architecture

Cronie is an Electron app with a React frontend for scheduling and running shell commands or HTTP requests.

### Process Separation

**Main Process** (`electron/`):
- `main.ts` - App lifecycle, window management, system tray
- `db.ts` - SQL.js (SQLite in-memory with file persistence) at `%APPDATA%/cronie/cronie.db`
- `scheduler.ts` - Manages cron jobs using node-cron, maintains `Map<taskId, ScheduledTask>`
- `executor.ts` - Runs shell commands (via Git Bash) or HTTP requests, streams output to renderer
- `ipc.ts` - All IPC handlers for CRUD, logs, scheduler control
- `preload.ts` - Context bridge exposing `window.api`

**Renderer Process** (`src/`):
- `App.tsx` - Main router with pages: Dashboard, Tasks, TaskDetail, Logs, Settings, Terminal
- `types.ts` - Shared TypeScript interfaces + `window.api` type declarations
- `context/TerminalContext.tsx` - Real-time terminal output streaming

### Data Flow

1. **Task Creation**: Renderer → IPC `tasks:create` → SQLite insert → `rescheduleTask()` → cron job registered
2. **Task Execution**: Cron triggers → `executeTask()` → spawns bash/http → streams stdout/stderr via IPC → logs to `execution_logs` table
3. **Real-time Output**: Main process sends `terminal:stdout`/`terminal:stderr` events → renderer's TerminalContext updates UI

### Database Schema

Two main tables:
- `tasks` - Task definitions (name, cron_expression, task_type, config JSON, retry settings)
- `execution_logs` - Execution history with stdout/stderr capture, duration, status

### Shell Execution

Shell commands spawn via `C:\Program Files\Git\usr\bin\bash.exe` with `stdbuf` for line-buffered output. The `config` JSON field stores `{ command, workingDirectory?, envVars? }`.

### IPC Channels

All API methods in `window.api` map to IPC handlers prefixed by domain:
- `tasks:*` - CRUD operations
- `logs:*` - Query, export, clear logs
- `scheduler:*` - Pause/resume all tasks
- `terminal:*` - Real-time output streaming and process kill
- `window:*` - Minimize/maximize/close

## Key Files to Understand

- `electron/executor.ts:87` - `executeTask()` is the core execution logic with retry handling
- `electron/ipc.ts` - Complete list of all available IPC handlers
- `src/types.ts:59` - `window.api` interface defining all renderer-callable methods
