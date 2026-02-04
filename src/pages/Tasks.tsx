import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Play, Trash2, Eye, Terminal, Globe, Puzzle, CheckCircle2, X } from 'lucide-react'
import { Task } from '@/types'
import TaskForm from '@/components/TaskForm'

const typeIcons = { shell: Terminal, http: Globe, plugin: Puzzle }

interface TasksProps {
  onViewTask: (id: number) => void
}

export default function Tasks({ onViewTask }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [running, setRunning] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ message: string; visible: boolean; isError: boolean }>({ message: '', visible: false, isError: false })

  function showToast(message: string, isError = false) {
    setToast({ message, visible: true, isError })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000)
  }

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    try { setTasks(await window.api.getTasks()) } catch {}
  }

  async function handleToggle(id: number) {
    await window.api.toggleTask(id)
    loadTasks()
  }

  async function handleDelete(id: number) {
    await window.api.deleteTask(id)
    loadTasks()
  }

  async function handleRunNow(id: number) {
    setRunning(prev => new Set(prev).add(id))
    await window.api.runTaskNow(id)
    setRunning(prev => { const s = new Set(prev); s.delete(id); return s })
    loadTasks()
  }

  async function handleSave(task: Partial<Task>) {
    try {
      if (editingTask) {
        await window.api.updateTask(editingTask.id, task)
        showToast(`Task "${task.name}" updated successfully`)
      } else {
        await window.api.createTask(task)
        showToast(`Task "${task.name}" created successfully`)
      }
      setShowForm(false)
      setEditingTask(null)
      loadTasks()
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Failed to save task'}`, true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm">{tasks.length} scheduled tasks</p>
        </div>
        <Button onClick={() => { setEditingTask(null); setShowForm(true) }}>
          <Plus className="w-4 h-4 mr-2" /> New Task
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-6">
            <TaskForm
              task={editingTask}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingTask(null) }}
            />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {tasks.map(task => {
          const Icon = typeIcons[task.task_type] || Terminal
          const tags = task.tags ? task.tags.split(',').filter(Boolean) : []
          return (
            <Card key={task.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{task.name}</h3>
                        {tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{task.cron_expression}</code>
                        {task.description && <span className="truncate max-w-xs">{task.description}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!task.enabled} onCheckedChange={() => handleToggle(task.id)} title={task.enabled ? 'Disable task' : 'Enable task'} />
                    <Button variant="ghost" size="icon" onClick={() => handleRunNow(task.id)} disabled={running.has(task.id)} title="Run now">
                      <Play className={`w-4 h-4 ${running.has(task.id) ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onViewTask(task.id)} title="View details">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingTask(task); setShowForm(true) }} title="Edit task">
                      <Terminal className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)} title="Delete task">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {tasks.length === 0 && !showForm && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No tasks yet. Create your first scheduled task!</p>
          </div>
        )}
      </div>

      {/* Toast notification */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className={`flex items-center gap-3 text-white px-4 py-3 rounded-lg shadow-lg ${toast.isError ? 'bg-red-600' : 'bg-green-600'}`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(t => ({ ...t, visible: false }))} className={`ml-2 rounded p-0.5 ${toast.isError ? 'hover:bg-red-700' : 'hover:bg-green-700'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
