# Cronie

A modern, cross-platform task scheduler built with Electron.

![Cronie](assets/Icon.png)

## Features

- **Multiple Task Types**
  - Shell commands - Execute any shell/bash command
  - HTTP requests - Make GET, POST, PUT, DELETE requests with custom headers/body

- **Cron Scheduling** - Standard cron expressions for flexible scheduling

- **Execution Monitoring**
  - Real-time execution logs with stdout/stderr capture
  - Success/failure tracking with detailed error messages
  - Duration tracking for performance monitoring

- **Reliability**
  - Configurable retry logic with custom delay
  - Timeout settings per task
  - Pause/resume all tasks from system tray

- **System Tray** - Runs in background, accessible from system tray

- **Dashboard** - Overview with stats, recent executions, and failing tasks

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Electron, Node.js
- **Database**: SQL.js (SQLite)
- **Scheduling**: node-cron
- **Build**: Vite, electron-builder

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run electron:dev
```

This starts Vite dev server and launches Electron.

### Build

```bash
npm run electron:build
```

Builds the app for your platform (Windows NSIS installer, macOS, or Linux).

## Project Structure

```
├── electron/           # Electron main process
│   ├── main.ts         # App entry, window & tray management
│   ├── db.ts           # SQLite database with sql.js
│   ├── scheduler.ts    # Cron job scheduling
│   ├── executor.ts     # Task execution (shell/http)
│   ├── ipc.ts          # IPC handlers
│   └── preload.ts      # Context bridge
├── src/                # React frontend
│   ├── pages/          # Dashboard, TaskDetail, Settings
│   ├── components/     # UI components
│   └── types.ts        # TypeScript types
└── assets/             # App icons
```

## Usage

1. **Create a Task** - Click "New Task" and configure:
   - Name and description
   - Cron expression (e.g., `*/5 * * * *` for every 5 minutes)
   - Task type (Shell or HTTP)
   - Command or URL/method/headers/body
   - Timeout and retry settings

2. **Monitor** - Dashboard shows recent executions and failing tasks

3. **View Details** - Click a task to see execution history with full logs

4. **Run Manually** - Use "Run Now" button to execute immediately

## License

MIT
