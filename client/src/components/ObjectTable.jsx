import { useMemo, useState } from 'react';
import { TIER_ORDER, TIERS, formatSize, formatElapsed } from '../tierConfig';
import { ACCESS_FREQUENCY_STYLES } from '../classification';

function TierBadge({ tier }) {
  const config = TIERS[tier];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: config.accent }}
      aria-label={`Tier: ${tier}`}
    >
      {tier}
    </span>
  );
}

function AccessBadge({ frequency, count }) {
  const style = ACCESS_FREQUENCY_STYLES[frequency] ?? ACCESS_FREQUENCY_STYLES.Rare;
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ color: style.color, backgroundColor: style.bg }}
      title={`${count} access${count === 1 ? '' : 'es'} in the last 30 days`}
    >
      {frequency}
    </span>
  );
}

export default function ObjectTable({ objects, onSetTier, onMarkAccessed, onDeleteObject, onDownloadObject }) {
  const [tierFilter, setTierFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('age');
  const [sortDir, setSortDir] = useState('desc');

  const active = objects.filter((o) => o.status === 'active');
  const now = Date.now();

  const filtered = useMemo(() => {
    let rows = tierFilter === 'All' ? active : active.filter((o) => o.tier === tierFilter);
    const query = search.trim().toLowerCase();
    if (query) rows = rows.filter((o) => o.name.toLowerCase().includes(query));
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'size') cmp = a.size_mb - b.size_mb;
      else if (sortBy === 'age') cmp = (now - a.created_at) - (now - b.created_at);
      else if (sortBy === 'idle') cmp = (now - a.last_accessed_at) - (now - b.last_accessed_at);
      else if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [active, tierFilter, search, sortBy, sortDir, now]);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const promote = (obj) => {
    const idx = TIER_ORDER.indexOf(obj.tier);
    if (idx > 0) onSetTier(obj.id, TIER_ORDER[idx - 1]);
  };
  const demote = (obj) => {
    const idx = TIER_ORDER.indexOf(obj.tier);
    if (idx < TIER_ORDER.length - 1) onSetTier(obj.id, TIER_ORDER[idx + 1]);
  };

  const SortHeader = ({ field, children }) => (
    <th
      scope="col"
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-navy-300 hover:text-navy-500"
      onClick={() => toggleSort(field)}
    >
      {children}
      {sortBy === field && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-navy-700">Objects ({filtered.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search objects by name"
            className="focus-ring w-40 rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-1.5 text-xs text-navy-700 placeholder:text-navy-300 focus:border-coral-300 sm:w-52"
          />
          <div className="flex items-center gap-1 rounded-lg bg-cream-300 p-1" role="tablist" aria-label="Filter by tier">
            {['All', ...TIER_ORDER].map((tier) => (
              <button
                key={tier}
                type="button"
                role="tab"
                aria-selected={tierFilter === tier}
                onClick={() => setTierFilter(tier)}
                className={`focus-ring rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  tierFilter === tier ? 'bg-white text-navy-700 shadow-soft' : 'text-navy-400 hover:text-navy-600'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-navy-100">
              <SortHeader field="name">Name</SortHeader>
              <SortHeader field="size">Size</SortHeader>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-navy-300">Tier</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-navy-300">Access</th>
              <SortHeader field="age">Created</SortHeader>
              <SortHeader field="idle">Idle since access</SortHeader>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-navy-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((obj) => (
              <tr key={obj.id} className="border-b border-navy-50 transition hover:bg-cream-200/60">
                <td className="px-3 py-2.5">
                  <p className="text-sm font-medium text-navy-700">{obj.name}</p>
                  {obj.file_type && <p className="text-xs text-navy-300">{obj.file_type}</p>}
                </td>
                <td className="px-3 py-2.5 text-sm text-navy-500">{formatSize(obj.size_mb)}</td>
                <td className="px-3 py-2.5"><TierBadge tier={obj.tier} /></td>
                <td className="px-3 py-2.5">
                  {obj.access_frequency && <AccessBadge frequency={obj.access_frequency} count={obj.access_count_30d} />}
                </td>
                <td className="px-3 py-2.5 text-sm text-navy-500">{formatElapsed(now - obj.created_at)} ago</td>
                <td className="px-3 py-2.5 text-sm text-navy-500">{formatElapsed(now - obj.last_accessed_at)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {obj.is_real_upload ? (
                      <button
                        type="button"
                        onClick={() => onDownloadObject(obj.id, obj.name)}
                        title="Download the real file"
                        aria-label={`Download ${obj.name}`}
                        className="focus-ring rounded-md border border-navy-100 px-2 py-1 text-xs font-medium text-navy-500 transition hover:border-coral-300 hover:text-coral-600"
                      >
                        ⬇
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onMarkAccessed(obj.id)}
                      title="Mark as accessed (resets idle clock)"
                      aria-label={`Mark ${obj.name} as accessed`}
                      className="focus-ring rounded-md border border-navy-100 px-2 py-1 text-xs font-medium text-navy-500 transition hover:border-teal-300 hover:text-teal-600"
                    >
                      👁
                    </button>
                    <button
                      type="button"
                      onClick={() => promote(obj)}
                      disabled={obj.tier === 'Hot'}
                      title="Promote to hotter tier"
                      aria-label={`Promote ${obj.name} to a hotter tier`}
                      className="focus-ring rounded-md border border-navy-100 px-2 py-1 text-xs font-medium text-navy-500 transition hover:border-coral-300 hover:text-coral-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => demote(obj)}
                      disabled={obj.tier === 'Archive'}
                      title="Demote to colder tier"
                      aria-label={`Demote ${obj.name} to a colder tier`}
                      className="focus-ring rounded-md border border-navy-100 px-2 py-1 text-xs font-medium text-navy-500 transition hover:border-teal-300 hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteObject(obj.id)}
                      title="Delete object"
                      aria-label={`Delete ${obj.name}`}
                      className="focus-ring rounded-md border border-navy-100 px-2 py-1 text-xs font-medium text-navy-400 transition hover:border-coral-400 hover:bg-coral-50 hover:text-coral-600"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-navy-300">
                  {search ? 'No objects match your search.' : 'No objects in this tier yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
