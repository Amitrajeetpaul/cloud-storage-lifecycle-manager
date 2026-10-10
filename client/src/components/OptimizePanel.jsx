import { useState } from 'react';
import { TIERS, formatCurrency } from '../tierConfig';

export default function OptimizePanel({ optimization, onApplyOptimization }) {
  const [applying, setApplying] = useState(false);
  const [open, setOpen] = useState(false);

  const suggestions = optimization?.suggestions ?? [];
  if (suggestions.length === 0) return null;

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApplyOptimization();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gold-200 bg-gold-50 p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-700">
            💡 {suggestions.length} object{suggestions.length === 1 ? '' : 's'} could save{' '}
            <span className="text-teal-600">{formatCurrency(optimization.total_potential_savings_per_day)}/day</span>
          </p>
          <p className="text-xs text-navy-400">
            Based on real access activity in the last 30 days, not just idle time — rarely-touched objects are
            sitting in a warmer (more expensive) tier than their actual usage needs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="focus-ring rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-xs font-medium text-navy-500 transition hover:border-coral-300 hover:text-coral-600"
          >
            {open ? 'Hide details' : 'Show details'}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            className="focus-ring rounded-lg bg-coral-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-coral-600 active:bg-coral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applying ? 'Applying…' : 'Apply optimization'}
          </button>
        </div>
      </div>

      {open && (
        <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto border-t border-gold-200 pt-3">
          {suggestions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-navy-700">{s.name}</span>
              <span className="text-navy-400">
                {s.access_frequency} ({s.access_count_30d} accesses) ·{' '}
                <span style={{ color: TIERS[s.current_tier]?.accent }}>{s.current_tier}</span>
                {' → '}
                <span style={{ color: TIERS[s.recommended_tier]?.accent }}>{s.recommended_tier}</span>
                {' · '}
                <span className="font-medium text-teal-600">{formatCurrency(s.potential_savings_per_day)}/day</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
