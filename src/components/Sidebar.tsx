import { LayoutDashboard, ListTodo, ScrollText, Settings, Clock, Terminal, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTerminal } from '../context/TerminalContext'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string, sessionId?: string) => void
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { sessions, activeSessionId, setActiveSessionId, clearSession, sidebarExpanded, setSidebarExpanded } = useTerminal()
  const entries = Array.from(sessions.entries())
  const isTerminalActive = currentPage === 'terminal'

  return (
    <div className="w-56 border-r bg-card flex flex-col">
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.slice(0, 3).map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              currentPage === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}

        {/* Terminal expandable section */}
        <button
          onClick={() => {
            setSidebarExpanded(!sidebarExpanded)
            if (entries.length > 0 && !sidebarExpanded) {
              onNavigate('terminal', activeSessionId || entries[entries.length - 1][0])
            }
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            isTerminalActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Terminal className="w-4 h-4" />
          <span className="flex-1 text-left">Terminal</span>
          {entries.length > 0 && (
            <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 leading-none">
              {entries.length}
            </span>
          )}
          <ChevronRight className={cn('w-3 h-3 transition-transform', sidebarExpanded && 'rotate-90')} />
        </button>

        {/* Terminal sessions sub-items */}
        {sidebarExpanded && (
          <div className="ml-3 pl-3 border-l border-border space-y-0.5">
            {entries.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground/60 italic">
                No sessions
              </div>
            ) : (
              entries.map(([id, session]) => {
                const isActive = isTerminalActive && activeSessionId === id
                const dotColor =
                  session.status === 'running' ? 'bg-amber-400' :
                  session.status === 'success' ? 'bg-green-400' :
                  'bg-red-400'
                const dotPulse = session.status === 'running' ? 'animate-pulse' : ''

                return (
                  <div
                    key={id}
                    onClick={() => {
                      setActiveSessionId(id)
                      onNavigate('terminal', id)
                    }}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors group',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor, dotPulse)} />
                    <span className="truncate flex-1">{session.taskName}</span>
                    {session.status !== 'running' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); clearSession(id) }}
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {navItems.slice(3).map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              currentPage === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Cronie v1.0.0</span>
        </div>
      </div>
    </div>
  )
}
