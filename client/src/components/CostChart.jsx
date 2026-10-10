import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { TIER_ORDER, TIERS, formatCurrency } from '../tierConfig';

function buildSeries(history) {
  const byRun = new Map();
  for (const row of history) {
    if (!byRun.has(row.recorded_at)) {
      byRun.set(row.recorded_at, { recorded_at: row.recorded_at, total: 0, hotEquivalent: 0 });
    }
    const entry = byRun.get(row.recorded_at);
    entry.total += row.total_cost;
    entry.hotEquivalent += row.hot_equivalent_cost;
  }
  return [...byRun.values()].sort((a, b) => a.recorded_at - b.recorded_at);
}

function formatTick(ms) {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const COLORS = {
  Hot: TIERS.Hot.accent,
  Warm: TIERS.Warm.accent,
  Cold: TIERS.Cold.accent,
  Archive: TIERS.Archive.accent,
};

export default function CostChart({ history, objects }) {
  const series = useMemo(() => buildSeries(history), [history]);

  const latestByTier = useMemo(() => {
    const totals = { Hot: 0, Warm: 0, Cold: 0, Archive: 0 };
    for (const obj of objects) {
      if (obj.status !== 'active') continue;
      const rate = TIERS[obj.tier]?.costPerGbPerDay ?? 0;
      totals[obj.tier] += (obj.size_mb / 1024) * rate;
    }
    return totals;
  }, [objects]);

  const pieData = TIER_ORDER.map((tier) => ({ name: tier, value: latestByTier[tier] })).filter((d) => d.value > 0);
  const currentTotal = Object.values(latestByTier).reduce((a, b) => a + b, 0);
  const currentHotEquivalent = series.length ? series[series.length - 1].hotEquivalent : 0;
  const savings = currentHotEquivalent - currentTotal;
  const savingsPct = currentHotEquivalent > 0 ? (savings / currentHotEquivalent) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-card">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-navy-300">Daily storage cost</p>
        <p className="text-3xl font-semibold text-navy-700">{formatCurrency(currentTotal)}</p>
        {currentHotEquivalent > 0 && (
          <p className="mt-1 text-sm font-medium text-teal-500">
            {formatCurrency(savings)} saved/day ({savingsPct.toFixed(0)}%) vs. all-Hot
          </p>
        )}
      </div>

      <div className="h-56 w-full">
        {series.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-navy-100 text-center text-sm text-navy-300">
            No cost history yet — run an evaluation to see the trend.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE7E0" />
              <XAxis
                dataKey="recorded_at"
                tickFormatter={formatTick}
                tick={{ fontSize: 11, fill: '#6A6A8C' }}
                tickLine={false}
                axisLine={{ stroke: '#EDE7E0' }}
              />
              <YAxis tick={{ fontSize: 11, fill: '#6A6A8C' }} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(ms) => formatTick(ms)}
                contentStyle={{ borderRadius: 12, border: '1px solid #EDE7E0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="hotEquivalent" name="If all stayed Hot" stroke="#FF5A5F" strokeWidth={2} dot={false} strokeDasharray="4 3" />
              <Line type="monotone" dataKey="total" name="Actual cost" stroke="#2EC4B6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy-300">Cost by tier (today)</p>
        <div className="flex items-center gap-4">
          <div className="h-32 w-32 shrink-0">
            {pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-full border border-dashed border-navy-100 text-center text-[11px] text-navy-300">
                No objects
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={COLORS[d.name]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="flex-1 space-y-1.5">
            {TIER_ORDER.map((tier) => (
              <li key={tier} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-navy-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[tier] }} />
                  {tier}
                </span>
                <span className="font-medium text-navy-700">{formatCurrency(latestByTier[tier])}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
