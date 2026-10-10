import { useEffect, useState } from 'react';

function formatRelative(ms) {
  if (ms == null) return '—';
  const abs = Math.abs(ms);
  const seconds = Math.round(abs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export default function EngineStatus({ engineState, onEvaluateNow, onSeed, busy }) {
  const [now, setNow] = useState(Date.now());
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const lastEvaluatedAt = engineState?.last_evaluated_at;
  const nextEvaluationAt = engineState?.next_evaluation_at;

  const handleRunNow = async () => {
    setRunning(true);
    try {
      await onEvaluateNow();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-navy-700 px-6 py-5 shadow-lifted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gold-300 text-navy-800 shadow-soft"
          aria-hidden="true"
        >
          <span className="text-2xl">⚙</span>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-cream-300/70">Lifecycle Engine</p>
          <p className="text-sm text-white">
            Last run: <span className="font-semibold text-gold-300">{lastEvaluatedAt ? `${formatRelative(now - lastEvaluatedAt)} ago` : 'never'}</span>
            <span className="mx-2 text-white/30">·</span>
            Next: <span className="font-semibold text-gold-300">{nextEvaluationAt ? `in ${formatRelative(nextEvaluationAt - now)}` : '—'}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Simulation controls">
        <button
          type="button"
          onClick={() => onSeed(20)}
          disabled={busy}
          className="focus-ring rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 active:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Generate 20 objects
        </button>
        <div className="mx-1 h-6 w-px bg-white/10" aria-hidden="true" />
        <button
          type="button"
          onClick={handleRunNow}
          disabled={busy || running}
          className="focus-ring rounded-lg bg-coral-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-coral-600 active:bg-coral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? 'Running…' : '▶ Run evaluation now'}
        </button>
      </div>
    </div>
  );
}
