import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  const isElectron = typeof window !== 'undefined' && window.api

  return (
    <div className="h-10 bg-background border-b flex items-center justify-between px-4 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-foreground">Cronie</span>
      </div>
      {isElectron && (
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button onClick={() => window.api.minimize()} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => window.api.maximize()} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
            <Square className="w-3 h-3" />
          </button>
          <button onClick={() => window.api.close()} className="p-1.5 hover:bg-destructive/80 hover:text-white rounded text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
