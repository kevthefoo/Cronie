import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/StatusBadge'
import { ArrowLeft, Play, Terminal, Globe } from 'lucide-react'
import { Task, ExecutionLog } from '@/types'

interface TaskDetailProps {
  taskId: number
  onBack: () => void
}

export default function TaskDetail({ taskId, onBack }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => { load() }, [taskId])

  async function load() {
    try {
      const [t, l] = await Promise.all([
        window.api.getTask(taskId),
        window.api.getLogs({ taskId, limit: 50 }),
      ])
      setTask(t)
      setLogs(l)
    } catch {}
  }

  async function handleRunNow() {
    setRunning(true)
    await window.api.runTaskNow(taskId)
    setRunning(false)
    load()
  }

  if (!task) return <div className="text-muted-foreground">Loading...</div>

  const config = JSON.parse(task.config)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{task.name}</h1>
            <Badge variant={task.enabled ? 'success' : 'secondary'}>
              {task.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
        </div>
        <Button onClick={handleRunNow} disabled={running}>
          <Play className="w-4 h-4 mr-2" /> Run Now
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="flex items-center gap-1">{task.task_type === 'shell' ? <Terminal className="w-3 h-3" /> : <Globe className="w-3 h-3" />}{task.task_type}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Schedule</span><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{task.cron_expression}</code></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Timeout</span><span>{(task.timeout_ms / 60000).toFixed(1)} min</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Retries</span><span>{task.retry_count}</span></div>
            {task.task_type === 'shell' && config.command && (
              <div className="mt-2 p-2 bg-muted rounded font-mono text-xs whitespace-pre-wrap">{config.command}</div>
            )}
            {task.task_type === 'http' && config.url && (
              <div className="mt-2 p-2 bg-muted rounded text-xs"><span className="font-bold">{config.method}</span> {config.url}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Quick Stats</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Runs</span><span>{logs.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Successes</span><span className="text-green-500">{logs.filter(l => l.status === 'success').length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Failures</span><span className="text-red-500">{logs.filter(l => l.status === 'failure').length}</span></div>
            {logs[0] && <div className="flex justify-between"><span className="text-muted-foreground">Last Run</span><span>{new Date(logs[0].start_time).toLocaleString()}</span></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">Execution History</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No execution history</p>
          ) : (
            <div className="space-y-1">
              {logs.map(log => (
                <div key={log.id}>
                  <div
                    className="flex items-center justify-between py-2 px-2 hover:bg-muted/50 rounded cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={log.status} />
                      <span className="text-sm">{new Date(log.start_time).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {log.duration_ms != null && <span>{log.duration_ms}ms</span>}
                      {log.exit_code != null && <span>Exit: {log.exit_code}</span>}
                      {log.retry_attempt > 0 && <Badge variant="outline">Retry #{log.retry_attempt}</Badge>}
                    </div>
                  </div>
                  {expandedLog === log.id && (
                    <div className="mx-2 mb-2 p-3 bg-muted/50 rounded-md space-y-2 text-xs font-mono">
                      {log.stdout && <div><span className="text-green-500 font-sans font-medium">stdout:</span><pre className="mt-1 whitespace-pre-wrap">{log.stdout}</pre></div>}
                      {log.stderr && <div><span className="text-red-500 font-sans font-medium">stderr:</span><pre className="mt-1 whitespace-pre-wrap">{log.stderr}</pre></div>}
                      {log.error_message && <div><span className="text-red-500 font-sans font-medium">Error:</span><pre className="mt-1 whitespace-pre-wrap">{log.error_message}</pre></div>}
                      {log.http_status && <div><span className="font-sans font-medium">HTTP Status:</span> {log.http_status}</div>}
                      {log.http_response_body && <div><span className="font-sans font-medium">Response:</span><pre className="mt-1 whitespace-pre-wrap max-h-48 overflow-auto">{log.http_response_body}</pre></div>}
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
