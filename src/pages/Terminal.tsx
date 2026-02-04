import { useEffect, useRef } from 'react';
import { useTerminal, TerminalSession } from '../context/TerminalContext';
import { Square, Terminal as TerminalIcon, X } from 'lucide-react';

function TerminalOutput({ session }: { session: TerminalSession }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = () => {
      autoScrollRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    };
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    if (autoScrollRef.current && wrapperRef.current) {
      wrapperRef.current.scrollTop = wrapperRef.current.scrollHeight;
    }
  }, [session.lines.length]);

  return (
    <div
      ref={wrapperRef}
      className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#3b4261 #1a1b26',
      }}
    >
      <pre className="whitespace-pre-wrap break-all">
        {session.lines.map((line, i) => {
          const color =
            line.type === 'stderr' ? 'text-[#f7768e]' :
            line.type === 'info' ? 'text-[#7aa2f7] italic' :
            'text-[#a9b1d6]';
          return <span key={i} className={color}>{line.text}</span>;
        })}
      </pre>
    </div>
  );
}

function TerminalStatusBar({ session }: { session: TerminalSession }) {
  const { killSession } = useTerminal();

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#24283b] border-t border-[#3b4261] text-xs text-[#565f89] shrink-0">
      {session.status === 'running' ? (
        <>
          <span className="w-2 h-2 rounded-full bg-[#e0af68] animate-pulse" />
          <span>Running...</span>
          <span className="ml-2 text-[#3b4261]">|</span>
          <span className="text-[#565f89] truncate max-w-[400px]">{session.command}</span>
          <button
            onClick={() => killSession(session.sessionId)}
            className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded text-[#f7768e] hover:bg-[#f7768e]/10 transition-colors"
          >
            <Square size={10} />
            <span>Kill</span>
          </button>
        </>
      ) : session.status === 'success' ? (
        <>
          <span className="w-2 h-2 rounded-full bg-[#9ece6a]" />
          <span className="text-[#9ece6a]">Completed (exit code {session.exitCode})</span>
          <span className="ml-2 text-[#3b4261]">|</span>
          <span className="text-[#565f89] truncate max-w-[400px]">{session.command}</span>
        </>
      ) : session.status === 'timeout' ? (
        <>
          <span className="w-2 h-2 rounded-full bg-[#f7768e]" />
          <span className="text-[#f7768e]">Timed out (exit code {session.exitCode})</span>
          <span className="ml-2 text-[#3b4261]">|</span>
          <span className="text-[#565f89] truncate max-w-[400px]">{session.command}</span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-[#f7768e]" />
          <span className="text-[#f7768e]">Failed (exit code {session.exitCode})</span>
          <span className="ml-2 text-[#3b4261]">|</span>
          <span className="text-[#565f89] truncate max-w-[400px]">{session.command}</span>
        </>
      )}
    </div>
  );
}

function TerminalHeader({ session, onClose }: { session: TerminalSession; onClose: () => void }) {
  const { killSession, clearSession } = useTerminal();

  const handleClose = () => {
    if (session.status === 'running') {
      killSession(session.sessionId);
    }
    clearSession(session.sessionId);
    onClose();
  };

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 bg-[#24283b] border-b border-[#3b4261] shrink-0">
      <span className="text-[#7aa2f7] text-xs font-semibold">{session.taskName}</span>
      <span className="text-[#565f89] text-[11px] truncate ml-auto max-w-[50%]">{session.command}</span>
      <button
        onClick={handleClose}
        className="text-[#565f89] hover:text-[#a9b1d6] transition-colors ml-2 shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function TerminalPage({ onClose }: { onClose: () => void }) {
  const { sessions, activeSessionId } = useTerminal();
  const activeSession = activeSessionId ? sessions.get(activeSessionId) : undefined;

  return (
    <div className="h-full flex flex-col bg-[#1a1b26] overflow-hidden">
      {activeSession ? (
        <>
          <TerminalHeader session={activeSession} onClose={onClose} />
          <TerminalOutput session={activeSession} />
          <TerminalStatusBar session={activeSession} />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-[#565f89] gap-3">
          <TerminalIcon size={40} strokeWidth={1} />
          <span className="text-sm">No terminal sessions</span>
          <span className="text-xs">Run a task to see live output here</span>
        </div>
      )}
    </div>
  );
}
