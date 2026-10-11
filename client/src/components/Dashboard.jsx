import { useState } from 'react';
import EngineStatus from './EngineStatus.jsx';
import TierVisualizer from './TierVisualizer.jsx';
import CostChart from './CostChart.jsx';
import ObjectForm from './ObjectForm.jsx';
import ObjectTable from './ObjectTable.jsx';
import RuleBuilder from './RuleBuilder.jsx';
import AuditLog from './AuditLog.jsx';
import OptimizePanel from './OptimizePanel.jsx';
import ForecastPanel from './ForecastPanel.jsx';
import ProviderComparison from './ProviderComparison.jsx';

export default function Dashboard(props) {
  const {
    objects, rules, engineState, history, audit, loading, error, optimization,
    forecast, providerComparison, ruleTemplates, onApplyRuleTemplate,
    onEvaluateNow, onApplyOptimization, onSeed, onCreateObject, onUploadObject, onDownloadObject,
    onSetTier, onMarkAccessed, onDeleteObject,
    onCreateRule, onUpdateRule, onReorderRules, onDeleteRule, onLogout,
  } = props;
  const [tab, setTab] = useState('objects');
  const activeCount = objects.filter((o) => o.status === 'active').length;

  return (
    <div className="min-h-screen bg-cream-200 pb-24 sm:pb-8">
      <header className="border-b border-navy-100/60 bg-cream-200/80 px-4 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-coral-600">ISM · MinIO-style ILM Simulation</p>
            <h1 className="text-2xl font-semibold text-navy-700 sm:text-3xl">Cloud Storage Lifecycle Manager</h1>
            <p className="mt-1 text-sm text-navy-400">{activeCount} active objects across Hot → Warm → Cold → Archive tiers</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="focus-ring shrink-0 rounded-lg border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-500 transition hover:border-coral-300 hover:text-coral-600"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
        {error && (
          <div className="rounded-xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700">
            Couldn't reach the server: {error}. Is the backend running on port 4000?
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="hidden sm:block">
              <EngineStatus engineState={engineState} onEvaluateNow={onEvaluateNow} onSeed={onSeed} busy={loading} />
            </div>

            <OptimizePanel optimization={optimization} onApplyOptimization={onApplyOptimization} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
              <section aria-label="Tier visualizer">
                <TierVisualizer objects={objects} />
              </section>
              <aside aria-label="Cost overview" className="space-y-5">
                <CostChart history={history} objects={objects} />
                <ProviderComparison comparison={providerComparison} />
              </aside>
            </div>

            <section>
              <div className="mb-4 flex items-center gap-1 rounded-lg bg-cream-300 p-1 sm:w-fit" role="tablist">
                <button
                  role="tab"
                  aria-selected={tab === 'objects'}
                  onClick={() => setTab('objects')}
                  className={`focus-ring rounded-md px-4 py-2 text-sm font-medium transition ${
                    tab === 'objects' ? 'bg-white text-navy-700 shadow-soft' : 'text-navy-400 hover:text-navy-600'
                  }`}
                >
                  Objects
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'rules'}
                  onClick={() => setTab('rules')}
                  className={`focus-ring rounded-md px-4 py-2 text-sm font-medium transition ${
                    tab === 'rules' ? 'bg-white text-navy-700 shadow-soft' : 'text-navy-400 hover:text-navy-600'
                  }`}
                >
                  Rules
                </button>
              </div>

              {tab === 'objects' ? (
                <div className="space-y-5">
                  <ObjectForm onCreateObject={onCreateObject} onUploadObject={onUploadObject} />
                  <ObjectTable
                    objects={objects}
                    onSetTier={onSetTier}
                    onMarkAccessed={onMarkAccessed}
                    onDeleteObject={onDeleteObject}
                    onDownloadObject={onDownloadObject}
                  />
                </div>
              ) : (
                <RuleBuilder
                  rules={rules}
                  templates={ruleTemplates}
                  onApplyTemplate={onApplyRuleTemplate}
                  onCreateRule={onCreateRule}
                  onUpdateRule={onUpdateRule}
                  onReorderRules={onReorderRules}
                  onDeleteRule={onDeleteRule}
                />
              )}
            </section>

            <ForecastPanel forecast={forecast} />
            <AuditLog audit={audit} />
          </>
        )}
      </main>

      {!loading && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-100 bg-navy-700/95 px-3 py-3 backdrop-blur sm:hidden">
          <EngineStatus engineState={engineState} onEvaluateNow={onEvaluateNow} onSeed={onSeed} busy={loading} />
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-24 rounded-2xl bg-navy-100/40" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="h-64 rounded-2xl bg-navy-100/40" />
        <div className="h-64 rounded-2xl bg-navy-100/40" />
      </div>
      <div className="h-48 rounded-2xl bg-navy-100/40" />
    </div>
  );
}
