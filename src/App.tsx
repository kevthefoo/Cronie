import { useState, useCallback } from 'react'
import './types'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import TerminalPage from './pages/Terminal'
import { TerminalProvider } from './context/TerminalContext'

type Page = 'dashboard' | 'tasks' | 'logs' | 'settings' | 'task-detail' | 'terminal'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)

  const navigate = (p: Page, taskId?: number) => {
    setPage(p)
    if (taskId !== undefined) setSelectedTaskId(taskId)
  }

  const handleTerminalSessionStart = useCallback(() => {
    setPage('terminal')
  }, [])

  return (
    <TerminalProvider onSessionStart={handleTerminalSessionStart}>
      <div className="h-screen flex flex-col bg-background dark">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar currentPage={page} onNavigate={(p) => navigate(p as Page)} />
          {page === 'terminal' ? (
            <main className="flex-1 overflow-hidden">
              <TerminalPage onClose={() => navigate('dashboard')} />
            </main>
          ) : (
            <main className="flex-1 overflow-auto p-6">
              {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
              {page === 'tasks' && <Tasks onViewTask={(id) => navigate('task-detail', id)} />}
              {page === 'task-detail' && selectedTaskId && (
                <TaskDetail taskId={selectedTaskId} onBack={() => navigate('tasks')} />
              )}
              {page === 'logs' && <Logs />}
              {page === 'settings' && <Settings />}
            </main>
          )}
        </div>
      </div>
    </TerminalProvider>
  )
}
