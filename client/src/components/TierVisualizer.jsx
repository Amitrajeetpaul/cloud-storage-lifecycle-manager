import { TIER_ORDER, TIERS, formatSize, formatElapsed } from '../tierConfig';

function ObjectCard({ obj }) {
  const idle = formatElapsed(Date.now() - obj.last_accessed_at);
  return (
    <div
      key={obj.id}
      className="animate-tier-in rounded-lg border border-navy-100 bg-white/90 px-3 py-2.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
    >
      <p className="truncate text-sm font-medium text-navy-700" title={obj.name}>
        {obj.name}
      </p>
      <div className="mt-1 flex items-center justify-between text-xs text-navy-400">
        <span>{formatSize(obj.size_mb)}</span>
        <span>{idle} idle</span>
      </div>
    </div>
  );
}

export default function TierVisualizer({ objects }) {
  const active = objects.filter((o) => o.status === 'active');
  const grouped = TIER_ORDER.reduce((acc, tier) => {
    acc[tier] = active.filter((o) => o.tier === tier);
    return acc;
  }, {});

  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
      {TIER_ORDER.map((tier) => {
        const tierObjects = grouped[tier];
        const config = TIERS[tier];
        const totalGb = tierObjects.reduce((s, o) => s + o.size_mb, 0) / 1024;
        return (
          <div
            key={tier}
            className="flex max-h-[520px] min-w-[80%] shrink-0 snap-start flex-col rounded-2xl border border-navy-100/60 shadow-card sm:min-w-0 sm:shrink"
            style={{ background: `${config.wash}, #FFFFFF` }}
          >
            <div className="flex items-center justify-between rounded-t-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: config.accent }}
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold text-navy-700">{tier}</h3>
              </div>
              <span
                className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: config.accent }}
                aria-label={`${tierObjects.length} objects in ${tier} tier`}
              >
                {tierObjects.length}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 pb-2 text-xs text-navy-400">
              <span>{totalGb.toFixed(2)} GB</span>
              <span>₹{config.costPerGbPerDay.toFixed(2)}/GB/day</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {tierObjects.length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-navy-300">No objects</p>
              )}
              {tierObjects.map((obj) => (
                <ObjectCard key={obj.id} obj={obj} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
