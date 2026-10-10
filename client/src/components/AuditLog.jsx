import { useState } from 'react';
import { TIERS } from '../tierConfig';

function TierChip({ tier }) {
  if (!tier) return <span className="text-navy-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: TIERS[tier]?.accent }}>
      {tier}
    </span>
  );
}

function exportCsv(audit) {
  const header = ['created_at', 'object_name', 'from_tier', 'to_tier', 'action', 'reason'];
  const rows = audit.map((entry) =>
    header.map((key) => {
      const value = key === 'created_at' ? new Date(entry.created_at).toISOString() : entry[key] ?? '';
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',')
  );
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'audit-log.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditLog({ audit }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-white shadow-card">
      <div className="flex w-full items-center justify-between rounded-2xl px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="focus-ring flex flex-1 items-center gap-2 text-left text-base font-semibold text-navy-700"
        >
          Audit log
          <span className="rounded-full bg-cream-300 px-2 py-0.5 text-xs font-medium text-navy-500">{audit.length}</span>
          <span className="text-navy-400">{open ? '−' : '+'}</span>
        </button>
        {audit.length > 0 && (
          <button
            type="button"
            onClick={() => exportCsv(audit)}
            className="focus-ring rounded-lg border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-500 transition hover:border-coral-300 hover:text-coral-600"
          >
            Export CSV
          </button>
        )}
      </div>
      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-navy-50 px-5 pb-4">
          {audit.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-300">No transitions yet — run an evaluation to see activity.</p>
          ) : (
            <ul className="divide-y divide-navy-50">
              {audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-navy-50 px-1.5 py-0.5 text-xs font-mono text-navy-400">
                      {new Date(entry.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-medium text-navy-700">{entry.object_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {entry.action === 'access' ? (
                      <span className="font-medium text-teal-600">👁 Accessed in <TierChip tier={entry.from_tier} /></span>
                    ) : (
                      <>
                        <TierChip tier={entry.from_tier} />
                        <span className="text-navy-300">→</span>
                        {entry.action === 'delete' ? (
                          <span className="font-medium text-coral-600">Deleted</span>
                        ) : (
                          <TierChip tier={entry.to_tier} />
                        )}
                      </>
                    )}
                    <span className="ml-2 rounded-full bg-cream-300 px-2 py-0.5 text-navy-500">{entry.reason}</span>
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
