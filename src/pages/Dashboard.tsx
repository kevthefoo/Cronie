import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/StatusBadge'
import { Activity, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { Stats } from '@/types'

interface DashboardProps {
  onNavigate: (page: string, taskId?: number) => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

  async function loadStats() {
    try {
      const data = await window.api.getStats()
      setStats(data)
    } catch {
      // API not available in browser dev mode
    }
    setLoading(false)
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  const s = stats || { total: 0, success: 0, failure: 0, timeout: 0, recent: [], failingTasks: [] }
  const successRate = s.total > 0 ? Math.round((s.success / s.total) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your scheduled tasks</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Runs</p>
                <p className="text-2xl font-bold">{s.total}</p>
              </div>
              <Activity className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-green-500">{s.success}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-500">{s.failure}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{successRate}%</p>
              </div>
              <Clock className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent executions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent Executions</CardTitle>
          </CardHeader>
          <CardContent>
            {s.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No executions yet</p>
            ) : (
              <div className="space-y-2">
                {s.recent.map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{log.task_name || `Task #${log.task_id}`}</p>
                      <p className="text-xs text-muted-foreground">{new Date(log.start_time).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.duration_ms != null && (
                        <span className="text-xs text-muted-foreground">{log.duration_ms}ms</span>
                      )}
                      <StatusBadge status={log.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Most failing tasks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Most Failing Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s.failingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failures recorded</p>
            ) : (
              <div className="space-y-2">
                {s.failingTasks.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 px-2 -mx-2 rounded"
                    onClick={() => onNavigate('task-detail', t.id)}
                  >
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant="destructive">{t.failure_count} failures</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
