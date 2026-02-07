import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/StatusBadge'
import { Search, Download, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { ExecutionLog, Task } from '@/types'

function formatDuration(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  const totalSec = Math.floor(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const millis = ms % 1000
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  if (seconds >= 10) return `${seconds}s`
  return `${seconds}.${Math.floor(millis / 100)}s`
}

export default function Logs() {
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [taskFilter, setTaskFilter] = useState('')
  const [expandedLog, setExpandedLog] = useState<number | null>(null)

  useEffect(() => { loadTasks(); loadLogs() }, [])
  useEffect(() => { loadLogs() }, [search, statusFilter, taskFilter])

  async function loadTasks() {
    try { setTasks(await window.api.getTasks()) } catch {}
  }

  async function loadLogs() {
    try {
      setLogs(await window.api.getLogs({
        search: search || undefined,
        status: statusFilter || undefined,
        taskId: taskFilter ? Number(taskFilter) : undefined,
        limit: 200,
      }))
    } catch {}
  }

  async function handleExport(format: 'json' | 'csv') {
    const data = await window.api.exportLogs(format, {
      status: statusFilter || undefined,
      taskId: taskFilter ? Number(taskFilter) : undefined,
    })
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cronie-logs.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteLog(logId: number) {
    await window.api.deleteLog(logId)
    loadLogs()
  }

  async function handleClear() {
    await window.api.clearLogs(taskFilter ? Number(taskFilter) : undefined)
    loadLogs()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs</h1>
          <p className="text-muted-foreground text-sm">{logs.length} execution logs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
            <Download className="w-3 h-3 mr-1" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="w-3 h-3 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="timeout">Timeout</option>
          <option value="running">Running</option>
        </Select>
        <Select value={taskFilter} onChange={e => setTaskFilter(e.target.value)} className="w-48">
          <option value="">All Tasks</option>
          {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>

      {/* Log list */}
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No logs found</div>
          ) : (
            <div className="divide-y">
              {logs.map(log => (
                <div key={log.id}>
                  <div
                    className="flex items-center justify-between py-3 px-4 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedLog === log.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <StatusBadge status={log.status} />
                      <span className="text-sm font-medium">{log.task_name || `Task #${log.task_id}`}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {log.duration_ms != null && <span>{formatDuration(log.duration_ms)}</span>}
                      {log.exit_code != null && <span>Exit: {log.exit_code}</span>}
                      {log.http_status && <span>HTTP {log.http_status}</span>}
                      {log.retry_attempt > 0 && <Badge variant="outline" className="text-xs">Retry #{log.retry_attempt}</Badge>}
                      <span>{new Date(log.start_time).toLocaleString()}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id) }}
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {expandedLog === log.id && (
                    <div className="px-4 pb-3 space-y-2 text-xs font-mono bg-muted/20">
                      <div className="grid grid-cols-4 gap-2 pt-2 font-sans text-muted-foreground">
                        <div>Start: {new Date(log.start_time).toLocaleString()}</div>
                        {log.end_time && <div>End: {new Date(log.end_time).toLocaleString()}</div>}
                        <div>Duration: {formatDuration(log.duration_ms)}</div>
                        <div>Attempt: {log.retry_attempt}</div>
                      </div>
                      {log.stdout && (
                        <div className="p-2 bg-muted rounded">
                          <span className="text-green-500 font-sans text-xs font-medium">stdout</span>
                          <pre className="mt-1 whitespace-pre-wrap max-h-48 overflow-auto">{log.stdout}</pre>
                        </div>
                      )}
                      {log.stderr && (
                        <div className="p-2 bg-muted rounded">
                          <span className="text-yellow-500 font-sans text-xs font-medium">stderr</span>
                          <pre className="mt-1 whitespace-pre-wrap max-h-48 overflow-auto">{log.stderr}</pre>
                        </div>
                      )}
                      {log.error_message && (
                        <div className="p-2 bg-red-500/10 rounded">
                          <span className="text-red-500 font-sans text-xs font-medium">Error</span>
                          <pre className="mt-1 whitespace-pre-wrap">{log.error_message}</pre>
                          {log.error_stack && <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{log.error_stack}</pre>}
                        </div>
                      )}
                      {log.http_response_body && (
                        <div className="p-2 bg-muted rounded">
                          <span className="font-sans text-xs font-medium">HTTP Response ({log.http_status})</span>
                          <pre className="mt-1 whitespace-pre-wrap max-h-48 overflow-auto">{log.http_response_body}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
