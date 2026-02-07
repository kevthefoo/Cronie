import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { Plus, Play, Trash2, Eye, Terminal, Globe, Puzzle, CheckCircle2, X, Pencil, ArrowUpDown } from 'lucide-react'

function GripDots({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="6" r="1.5" />
      <circle cx="12" cy="6" r="1.5" />
      <circle cx="18" cy="6" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
      <circle cx="6" cy="18" r="1.5" />
      <circle cx="12" cy="18" r="1.5" />
      <circle cx="18" cy="18" r="1.5" />
    </svg>
  )
}
import { Task } from '@/types'
import TaskForm from '@/components/TaskForm'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const typeIcons = { shell: Terminal, http: Globe, plugin: Puzzle }

type SortMode = 'manual' | 'earliest' | 'latest'

// Parse cron expression to get minutes since midnight (for sorting)
// Returns null if the time is not specific (e.g., wildcards)
function parseCronTime(cronExpression: string): number | null {
  const parts = cronExpression.trim().split(/\s+/)
  if (parts.length < 2) return null

  const [minute, hour] = parts

  // Check if both minute and hour are specific numbers
  const minuteNum = parseInt(minute, 10)
  const hourNum = parseInt(hour, 10)

  if (isNaN(minuteNum) || isNaN(hourNum)) return null
  if (minute.includes('*') || minute.includes('/') || minute.includes(',') || minute.includes('-')) return null
  if (hour.includes('*') || hour.includes('/') || hour.includes(',') || hour.includes('-')) return null

  return hourNum * 60 + minuteNum
}

interface SortableTaskCardProps {
  task: Task
  running: Set<number>
  onToggle: (id: number) => void
  onRunNow: (id: number) => void
  onViewTask: (id: number) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  isDragDisabled?: boolean
}

function SortableTaskCard({ task, running, onToggle, onRunNow, onViewTask, onEdit, onDelete, isDragDisabled }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: isDragDisabled })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const Icon = typeIcons[task.task_type] || Terminal
  const tags = task.tags ? task.tags.split(',').filter(Boolean) : []

  return (
    <Card ref={setNodeRef} style={style} className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              {...attributes}
              {...listeners}
              className={`p-1 -ml-1 ${isDragDisabled ? 'cursor-not-allowed opacity-30' : 'cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground'}`}
              title={isDragDisabled ? 'Switch to Manual Order to drag' : 'Drag to reorder'}
            >
              <GripDots className="w-4 h-4" />
            </button>
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
            <Switch checked={!!task.enabled} onCheckedChange={() => onToggle(task.id)} title={task.enabled ? 'Disable task' : 'Enable task'} />
            <Button variant="ghost" size="icon" onClick={() => onRunNow(task.id)} disabled={running.has(task.id)} title="Run now">
              <Play className={`w-4 h-4 ${running.has(task.id) ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onViewTask(task.id)} title="View details">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(task)} title="Edit task">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(task)} title="Delete task">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface TasksProps {
  onViewTask: (id: number) => void
}

export default function Tasks({ onViewTask }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [running, setRunning] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ message: string; visible: boolean; isError: boolean }>({ message: '', visible: false, isError: false })
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('manual')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

  async function handleDelete(task: Task) {
    setDeleteConfirm(task)
  }

  async function confirmDelete() {
    if (deleteConfirm) {
      await window.api.deleteTask(deleteConfirm.id)
      setDeleteConfirm(null)
      loadTasks()
      showToast(`Task "${deleteConfirm.name}" deleted`)
    }
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex(t => t.id === active.id)
      const newIndex = tasks.findIndex(t => t.id === over.id)
      const newTasks = arrayMove(tasks, oldIndex, newIndex)
      setTasks(newTasks)
      await window.api.reorderTasks(newTasks.map(t => t.id))
    }
  }

  // Get sorted tasks based on sort mode
  function getSortedTasks(): Task[] {
    if (sortMode === 'manual') return tasks

    return [...tasks].sort((a, b) => {
      const timeA = parseCronTime(a.cron_expression)
      const timeB = parseCronTime(b.cron_expression)

      // Tasks without specific times go to the end
      if (timeA === null && timeB === null) return 0
      if (timeA === null) return 1
      if (timeB === null) return -1

      return sortMode === 'earliest' ? timeA - timeB : timeB - timeA
    })
  }

  const sortedTasks = getSortedTasks()
  const isDragDisabled = sortMode !== 'manual'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-muted-foreground text-sm">{tasks.length} scheduled tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <Select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="w-44"
            >
              <option value="manual">Manual Order</option>
              <option value="earliest">Earliest First</option>
              <option value="latest">Latest First</option>
            </Select>
          </div>
          <Button onClick={() => { setEditingTask(null); setShowForm(true) }}>
            <Plus className="w-4 h-4 mr-2" /> New Task
          </Button>
        </div>
      </div>

      {/* Task form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
          <Card className="w-full max-w-2xl mx-4">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-6">{editingTask ? 'Edit Task' : 'New Task'}</h2>
              <TaskForm
                task={editingTask}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditingTask(null) }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sortedTasks.map(task => (
              <SortableTaskCard
                key={task.id}
                task={task}
                running={running}
                onToggle={handleToggle}
                onRunNow={handleRunNow}
                onViewTask={onViewTask}
                onEdit={(t) => { setEditingTask(t); setShowForm(true) }}
                onDelete={handleDelete}
                isDragDisabled={isDragDisabled}
              />
            ))}
            {tasks.length === 0 && !showForm && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No tasks yet. Create your first scheduled task!</p>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-destructive/10">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <h2 className="text-lg font-semibold">Delete Task</h2>
              </div>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete <span className="font-medium text-foreground">"{deleteConfirm.name}"</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDelete}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
