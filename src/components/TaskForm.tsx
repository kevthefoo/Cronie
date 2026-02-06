import { useState, useCallback } from 'react'
import { CheckCircle2, XCircle, FolderCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Task } from '@/types'
import CronInput from './CronInput'

interface TaskFormProps {
  task: Task | null
  onSave: (task: Partial<Task>) => void
  onCancel: () => void
}

export default function TaskForm({ task, onSave, onCancel }: TaskFormProps) {
  const config = task ? JSON.parse(task.config) : {}
  const [name, setName] = useState(task?.name || '')
  const [description, setDescription] = useState(task?.description || '')
  const [cronExpression, setCronExpression] = useState(task?.cron_expression || '* * * * *')
  const [taskType, setTaskType] = useState<string>(task?.task_type || 'shell')
  const [tags, setTags] = useState(task?.tags || '')
  const [retryCount, setRetryCount] = useState(task?.retry_count || 0)
  const [retryDelay, setRetryDelay] = useState(task?.retry_delay_ms || 1000)
  // Store timeout in minutes for UI, convert to/from ms when loading/saving
  const [timeoutMinutes, setTimeoutMinutes] = useState(task?.timeout_ms ? task.timeout_ms / 60000 : 1)

  // Shell config
  const [command, setCommand] = useState(config.command || '')
  const [workingDir, setWorkingDir] = useState(config.workingDirectory || '')

  const [pathStatus, setPathStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [pathError, setPathError] = useState('')

  const validatePath = useCallback(async () => {
    if (!workingDir.trim()) { setPathStatus('invalid'); setPathError('Path is empty'); return }
    const result = await window.api.validatePath(workingDir)
    if (result.valid) { setPathStatus('valid'); setPathError('') }
    else { setPathStatus('invalid'); setPathError(result.error || 'Invalid path') }
  }, [workingDir])

  // HTTP config
  const [url, setUrl] = useState(config.url || '')
  const [method, setMethod] = useState(config.method || 'GET')
  const [headers, setHeaders] = useState(config.headers ? JSON.stringify(config.headers, null, 2) : '')
  const [body, setBody] = useState(config.body || '')
  const [expectedStatus, setExpectedStatus] = useState(config.expectedStatus || 200)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let configObj: any = {}
    if (taskType === 'shell') {
      configObj = { command, workingDirectory: workingDir || undefined }
    } else if (taskType === 'http') {
      configObj = { url, method, expectedStatus }
      if (headers) try { configObj.headers = JSON.parse(headers) } catch {}
      if (body) configObj.body = body
    }

    onSave({
      name, description, cron_expression: cronExpression,
      task_type: taskType as any,
      config: JSON.stringify(configObj),
      tags, retry_count: retryCount, retry_delay_ms: retryDelay, timeout_ms: timeoutMinutes * 60000,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">{task ? 'Edit Task' : 'New Task'}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Task name" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Type</label>
          <Select value={taskType} onChange={e => setTaskType(e.target.value)}>
            <option value="shell">Git Bash</option>
            <option value="http">HTTP Request</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Description</label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Cron Expression</label>
        <CronInput value={cronExpression} onChange={setCronExpression} />
      </div>

      {/* Task type specific config */}
      {taskType === 'shell' && (
        <div className="space-y-3 p-4 border rounded-md bg-muted/30">
          <h4 className="text-sm font-medium">Shell Configuration</h4>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Command</label>
            <Textarea value={command} onChange={e => setCommand(e.target.value)} placeholder='echo "hello world"' className="font-mono text-sm" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Working Directory</label>
            <div className="flex gap-2 items-center">
              <Input value={workingDir} onChange={e => { setWorkingDir(e.target.value); setPathStatus('idle') }} placeholder="C:\Users\..." className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={validatePath} className="shrink-0">
                <FolderCheck className="w-4 h-4 mr-1" /> Validate
              </Button>
              {pathStatus === 'valid' && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
              {pathStatus === 'invalid' && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
            </div>
            {pathStatus === 'invalid' && <p className="text-xs text-red-500">{pathError}</p>}
          </div>
        </div>
      )}

      {taskType === 'http' && (
        <div className="space-y-3 p-4 border rounded-md bg-muted/30">
          <h4 className="text-sm font-medium">HTTP Configuration</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-muted-foreground">URL</label>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.example.com/health" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Method</label>
              <Select value={method} onChange={e => setMethod(e.target.value)}>
                <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Headers (JSON)</label>
            <Textarea value={headers} onChange={e => setHeaders(e.target.value)} placeholder='{"Content-Type": "application/json"}' className="font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Body</label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Request body..." className="font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Expected Status Code</label>
            <Input type="number" value={expectedStatus} onChange={e => setExpectedStatus(Number(e.target.value))} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Tags</label>
          <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="backup,important" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Retries</label>
          <Input type="number" min={0} value={retryCount} onChange={e => setRetryCount(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Timeout (min)</label>
          <Input type="number" min={0.1} step={0.1} value={timeoutMinutes} onChange={e => setTimeoutMinutes(Number(e.target.value))} />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{task ? 'Update Task' : 'Create Task'}</Button>
      </div>
    </form>
  )
}
