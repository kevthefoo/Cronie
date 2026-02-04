import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface CronInputProps {
  value: string
  onChange: (value: string) => void
}

type Frequency = 'minute' | 'hour' | 'day' | 'week' | 'month'

const DAYS_OF_WEEK = [
  { label: 'Monday', value: '1' },
  { label: 'Tuesday', value: '2' },
  { label: 'Wednesday', value: '3' },
  { label: 'Thursday', value: '4' },
  { label: 'Friday', value: '5' },
  { label: 'Saturday', value: '6' },
  { label: 'Sunday', value: '0' },
]

function parseCron(cron: string): { frequency: Frequency; interval: number; minute: number; hour: number; dayOfWeek: string; dayOfMonth: number } {
  const parts = cron.split(' ')
  while (parts.length < 5) parts.push('*')
  const [min, hr, dom, , dow] = parts

  // Every N minutes
  if (min.startsWith('*/') && hr === '*' && dom === '*' && dow === '*') {
    return { frequency: 'minute', interval: parseInt(min.slice(2)) || 1, minute: 0, hour: 0, dayOfWeek: '1', dayOfMonth: 1 }
  }
  // Every N hours
  if (!min.startsWith('*') && (hr === '*' || hr.startsWith('*/')) && dom === '*' && dow === '*') {
    return { frequency: 'hour', interval: hr.startsWith('*/') ? parseInt(hr.slice(2)) || 1 : 1, minute: parseInt(min) || 0, hour: 0, dayOfWeek: '1', dayOfMonth: 1 }
  }
  // Weekly
  if (!min.startsWith('*') && !hr.startsWith('*') && dom === '*' && dow !== '*') {
    return { frequency: 'week', interval: 1, minute: parseInt(min) || 0, hour: parseInt(hr) || 0, dayOfWeek: dow, dayOfMonth: 1 }
  }
  // Monthly
  if (!min.startsWith('*') && !hr.startsWith('*') && dom !== '*' && dow === '*') {
    return { frequency: 'month', interval: 1, minute: parseInt(min) || 0, hour: parseInt(hr) || 0, dayOfWeek: '1', dayOfMonth: parseInt(dom) || 1 }
  }
  // Daily (default)
  if (!min.startsWith('*') && !hr.startsWith('*') && dom === '*' && dow === '*') {
    return { frequency: 'day', interval: 1, minute: parseInt(min) || 0, hour: parseInt(hr) || 0, dayOfWeek: '1', dayOfMonth: 1 }
  }

  return { frequency: 'day', interval: 1, minute: 0, hour: 0, dayOfWeek: '1', dayOfMonth: 1 }
}

function buildCron(frequency: Frequency, interval: number, minute: number, hour: number, dayOfWeek: string, dayOfMonth: number): string {
  switch (frequency) {
    case 'minute':
      return `*/${interval} * * * *`
    case 'hour':
      return `${minute} */${interval} * * *`
    case 'day':
      return `${minute} ${hour} * * *`
    case 'week':
      return `${minute} ${hour} * * ${dayOfWeek}`
    case 'month':
      return `${minute} ${hour} ${dayOfMonth} * *`
  }
}

function describeCron(frequency: Frequency, interval: number, minute: number, hour: number, dayOfWeek: string, dayOfMonth: number): string {
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const dayName = DAYS_OF_WEEK.find(d => d.value === dayOfWeek)?.label || 'Monday'

  switch (frequency) {
    case 'minute':
      return interval === 1 ? 'Runs every minute' : `Runs every ${interval} minutes`
    case 'hour':
      return interval === 1
        ? `Runs every hour at minute ${minute}`
        : `Runs every ${interval} hours at minute ${minute}`
    case 'day':
      return `Runs daily at ${time}`
    case 'week':
      return `Runs every ${dayName} at ${time}`
    case 'month':
      return `Runs on day ${dayOfMonth} of every month at ${time}`
  }
}

export default function CronInput({ value, onChange }: CronInputProps) {
  const [mode, setMode] = useState<'simple' | 'raw'>('simple')
  const parsed = parseCron(value)
  const [frequency, setFrequency] = useState<Frequency>(parsed.frequency)
  const [interval, setInterval_] = useState(parsed.interval)
  const [minute, setMinute] = useState(parsed.minute)
  const [hour, setHour] = useState(parsed.hour)
  const [dayOfWeek, setDayOfWeek] = useState(parsed.dayOfWeek)
  const [dayOfMonth, setDayOfMonth] = useState(parsed.dayOfMonth)

  useEffect(() => {
    if (mode === 'simple') {
      onChange(buildCron(frequency, interval, minute, hour, dayOfWeek, dayOfMonth))
    }
  }, [frequency, interval, minute, hour, dayOfWeek, dayOfMonth, mode])

  const description = describeCron(frequency, interval, minute, hour, dayOfWeek, dayOfMonth)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <Button type="button" variant={mode === 'simple' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode('simple')}>
          Simple
        </Button>
        <Button type="button" variant={mode === 'raw' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode('raw')}>
          Advanced
        </Button>
      </div>

      {mode === 'raw' ? (
        <div className="space-y-1">
          <Input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="* * * * *"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">Cron format: minute hour day month weekday</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">Run every</span>
            {(frequency === 'minute' || frequency === 'hour') && (
              <Input
                type="number"
                min={1}
                max={frequency === 'minute' ? 59 : 23}
                value={interval}
                onChange={e => setInterval_(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 text-center"
              />
            )}
            <Select value={frequency} onChange={e => setFrequency(e.target.value as Frequency)} className="w-auto">
              <option value="minute">minute(s)</option>
              <option value="hour">hour(s)</option>
              <option value="day">day</option>
              <option value="week">week</option>
              <option value="month">month</option>
            </Select>
          </div>

          {/* Time picker for hour/day/week/month */}
          {(frequency === 'day' || frequency === 'week' || frequency === 'month') && (
            <div className="flex items-center gap-2">
              <span className="text-sm">at</span>
              <Input
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={e => setHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-16 text-center"
              />
              <span className="text-sm">:</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={minute}
                onChange={e => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-16 text-center"
              />
            </div>
          )}

          {/* Minute picker for hourly */}
          {frequency === 'hour' && (
            <div className="flex items-center gap-2">
              <span className="text-sm">at minute</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={minute}
                onChange={e => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-16 text-center"
              />
            </div>
          )}

          {/* Day of week picker */}
          {frequency === 'week' && (
            <div className="flex items-center gap-2">
              <span className="text-sm">on</span>
              <Select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} className="w-auto">
                {DAYS_OF_WEEK.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </Select>
            </div>
          )}

          {/* Day of month picker */}
          {frequency === 'month' && (
            <div className="flex items-center gap-2">
              <span className="text-sm">on day</span>
              <Input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={e => setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-16 text-center"
              />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{mode === 'simple' ? description : value}</p>
    </div>
  )
}
