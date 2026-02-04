import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

export interface TerminalLine {
  type: 'stdout' | 'stderr' | 'info';
  text: string;
}

export interface TerminalSession {
  sessionId: string;
  taskName: string;
  command: string;
  lines: TerminalLine[];
  status: 'running' | 'success' | 'failure' | 'timeout';
  exitCode: number | null;
}

interface TerminalContextValue {
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
  sidebarExpanded: boolean;
  setActiveSessionId: (id: string) => void;
  setSidebarExpanded: (expanded: boolean) => void;
  killSession: (sessionId: string) => void;
  clearSession: (sessionId: string) => void;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

const MAX_LINES = 5000;

interface TerminalProviderProps {
  children: ReactNode;
  onSessionStart?: () => void;
}

export function TerminalProvider({ children, onSessionStart }: TerminalProviderProps) {
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const onSessionStartRef = useRef(onSessionStart);
  onSessionStartRef.current = onSessionStart;

  useEffect(() => {
    const api = window.api;
    if (!api?.onTerminalSessionStart) return;

    api.onTerminalSessionStart(({ sessionId, taskName, command }) => {
      setSessions(prev => {
        const next = new Map(prev);
        next.set(sessionId, {
          sessionId,
          taskName,
          command,
          lines: [{ type: 'info', text: `$ ${command}\n` }],
          status: 'running',
          exitCode: null,
        });
        return next;
      });
      setActiveSessionId(sessionId);
      setSidebarExpanded(true);
      onSessionStartRef.current?.();
    });

    api.onTerminalStdout(({ sessionId, data }) => {
      setSessions(prev => {
        const session = prev.get(sessionId);
        if (!session) return prev;
        const next = new Map(prev);
        const lines = [...session.lines, { type: 'stdout' as const, text: data }];
        next.set(sessionId, {
          ...session,
          lines: lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines,
        });
        return next;
      });
    });

    api.onTerminalStderr(({ sessionId, data }) => {
      setSessions(prev => {
        const session = prev.get(sessionId);
        if (!session) return prev;
        const next = new Map(prev);
        const lines = [...session.lines, { type: 'stderr' as const, text: data }];
        next.set(sessionId, {
          ...session,
          lines: lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines,
        });
        return next;
      });
    });

    api.onTerminalExit(({ sessionId, code, status }) => {
      setSessions(prev => {
        const session = prev.get(sessionId);
        if (!session) return prev;
        const next = new Map(prev);
        next.set(sessionId, {
          ...session,
          status: status as TerminalSession['status'],
          exitCode: code,
        });
        return next;
      });
    });

    return () => {
      api.removeTerminalListeners();
    };
  }, []);

  const killSession = useCallback((sessionId: string) => {
    window.api.killTerminalSession(sessionId);
  }, []);

  const clearSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
    if (activeSessionId === sessionId) {
      setSessions(prev => {
        const keys = Array.from(prev.keys());
        setActiveSessionId(keys.length > 0 ? keys[keys.length - 1] : null);
        return prev;
      });
    }
  }, [activeSessionId]);

  return (
    <TerminalContext.Provider
      value={{
        sessions,
        activeSessionId,
        sidebarExpanded,
        setActiveSessionId,
        setSidebarExpanded,
        killSession,
        clearSession,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error('useTerminal must be used within TerminalProvider');
  return ctx;
}
