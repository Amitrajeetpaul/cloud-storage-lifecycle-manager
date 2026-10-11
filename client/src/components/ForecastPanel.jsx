import { useState } from 'react';
import { TIERS } from '../tierConfig';

const TREND_STYLES = {
  Rising: { color: '#1A7E76', bg: '#E9FBF9', icon: '↑' },
  Declining: { color: '#C22429', bg: '#FFF1F1', icon: '↓' },
  Stable: { color: '#6A6A8C', bg: '#F2F2F6', icon: '→' },
};

function TrendBadge({ trend }) {
  const style = TREND_STYLES[trend] ?? TREND_STYLES.Stable;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      {style.icon} {trend}
    </span>
  );
}

export default function ForecastPanel({ forecast }) {
  const [open, setOpen] = useState(false);
  const entries = forecast ?? [];

  return (
    <div className="rounded-2xl bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-navy-700">
          📅 Upcoming transitions
          <span className="rounded-full bg-cream-300 px-2 py-0.5 text-xs font-medium text-navy-500">{entries.length}</span>
        </span>
        <span className="text-navy-400">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-navy-50 px-5 pb-4">
          <p className="py-3 text-xs text-navy-400">
            Forecast of when each object will next cross a lifecycle rule threshold, based on real
            elapsed idle time, plus whether its real access activity is rising or declining over the
            last 30 days.
          </p>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-300">No upcoming transitions — nothing is approaching a rule threshold yet.</p>
          ) : (
            <ul className="divide-y divide-navy-50">
              {entries.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-navy-700">{f.name}</span>
                    <TrendBadge trend={f.access_trend} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-navy-500">
                    <span style={{ color: TIERS[f.tier]?.accent }}>{f.tier}</span>
                    <span className="text-navy-300">→</span>
                    <span style={{ color: f.next_action === 'delete' ? '#C22429' : TIERS[f.next_tier]?.accent }}>
                      {f.next_action === 'delete' ? 'Delete' : f.next_tier}
                    </span>
                    <span className="ml-2 rounded-full bg-cream-300 px-2 py-0.5 font-medium text-navy-600">
                      in {f.days_until_threshold}d
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
