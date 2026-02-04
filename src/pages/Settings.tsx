import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Pause, Play } from 'lucide-react'

export default function Settings() {
  const [paused, setPaused] = useState(false)

  useEffect(() => { loadStatus() }, [])

  async function loadStatus() {
    try {
      const s = await window.api.getSchedulerStatus()
      setPaused(s.paused)
    } catch {}
  }

  async function togglePause() {
    if (paused) {
      await window.api.resumeScheduler()
    } else {
      await window.api.pauseScheduler()
    }
    setPaused(!paused)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Configure Cronie</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scheduler</CardTitle>
          <CardDescription>Control the task scheduler</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Scheduler Status</p>
              <p className="text-xs text-muted-foreground">
                {paused ? 'All tasks are paused' : 'Scheduler is running normally'}
              </p>
            </div>
            <Button variant={paused ? 'default' : 'outline'} onClick={togglePause}>
              {paused ? <><Play className="w-4 h-4 mr-2" /> Resume All</> : <><Pause className="w-4 h-4 mr-2" /> Pause All</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Cronie v1.0.0 — Custom Task Scheduler</p>
          <p>Electron + React + SQLite</p>
        </CardContent>
      </Card>
    </div>
  )
}
