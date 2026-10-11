import { formatCurrency } from '../tierConfig';

export default function ProviderComparison({ comparison }) {
  if (!comparison) return null;
  const { providers, labels, note } = comparison;
  const order = ['app', 'aws', 'azure', 'gcp'];
  const maxTotal = Math.max(...order.map((p) => providers[p]?.total ?? 0), 0.01);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-navy-300">Cross-provider cost comparison</p>
      <p className="mt-1 text-sm text-navy-500">
        Your exact current storage layout (same objects, same sizes, same tiers), priced against
        approximate real-world list rates.
      </p>

      <div className="mt-4 space-y-3">
        {order.map((provider) => {
          const total = providers[provider]?.total ?? 0;
          const widthPct = Math.max((total / maxTotal) * 100, 2);
          const isApp = provider === 'app';
          return (
            <div key={provider}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={isApp ? 'font-semibold text-navy-700' : 'text-navy-500'}>{labels[provider]}</span>
                <span className={isApp ? 'font-semibold text-navy-700' : 'text-navy-500'}>{formatCurrency(total)}/day</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream-300">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${widthPct}%`, backgroundColor: isApp ? '#FF5A5F' : '#9494B0' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {note && <p className="mt-4 text-[11px] leading-relaxed text-navy-300">⚠ {note} This app's own rates are intentionally stylized for visible demo contrast, not tuned to match real-world pricing — compare tier-to-tier ratios here, not absolute totals.</p>}
    </div>
  );
}
