import { useState } from 'react';
import { TIER_ORDER } from '../tierConfig';
import { FILE_TYPES } from '../classification';

const emptyForm = { name: '', from_tier: 'Hot', to_tier: 'Warm', condition_days: 7, action: 'transition', file_type: '' };

function RuleRow({ rule, index, total, onUpdateRule, onDeleteRule, onMove }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(rule);

  const save = async () => {
    await onUpdateRule(rule.id, form);
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-coral-200 bg-coral-50/40 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="focus-ring col-span-2 rounded-lg border border-navy-100 px-2.5 py-2 text-sm sm:col-span-2"
            placeholder="Rule name"
          />
          <select
            value={form.from_tier}
            onChange={(e) => setForm((f) => ({ ...f, from_tier: e.target.value }))}
            className="focus-ring rounded-lg border border-navy-100 px-2.5 py-2 text-sm"
          >
            {['Any', ...TIER_ORDER].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="number"
            min="0"
            value={form.condition_days}
            onChange={(e) => setForm((f) => ({ ...f, condition_days: Number(e.target.value) }))}
            className="focus-ring rounded-lg border border-navy-100 px-2.5 py-2 text-sm"
            placeholder="Days"
          />
          <select
            value={form.action}
            onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
            className="focus-ring rounded-lg border border-navy-100 px-2.5 py-2 text-sm"
          >
            <option value="transition">Move to tier</option>
            <option value="delete">Delete</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {form.action === 'transition' && (
            <select
              value={form.to_tier ?? 'Warm'}
              onChange={(e) => setForm((f) => ({ ...f, to_tier: e.target.value }))}
              className="focus-ring w-full rounded-lg border border-navy-100 px-2.5 py-2 text-sm sm:w-48"
            >
              {TIER_ORDER.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <select
            value={form.file_type ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, file_type: e.target.value }))}
            className="focus-ring w-full rounded-lg border border-navy-100 px-2.5 py-2 text-sm sm:w-48"
          >
            <option value="">Any file type</option>
            {FILE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="focus-ring rounded-lg px-3 py-1.5 text-xs font-medium text-navy-400 hover:text-navy-600">Cancel</button>
          <button type="button" onClick={save} className="focus-ring rounded-lg bg-coral-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-coral-600">Save</button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-navy-50 bg-white p-3 shadow-soft">
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          aria-label="Move rule up"
          className="focus-ring h-5 w-5 rounded text-navy-300 hover:text-navy-600 disabled:opacity-20"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
          aria-label="Move rule down"
          className="focus-ring h-5 w-5 rounded text-navy-300 hover:text-navy-600 disabled:opacity-20"
        >
          ▼
        </button>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-navy-700">{rule.name}</p>
        <p className="text-xs text-navy-400">
          {rule.from_tier} → {rule.action === 'delete' ? 'Delete' : rule.to_tier} after{' '}
          <span className="font-medium text-navy-600">{rule.condition_days} days</span> idle
          {rule.file_type && <> · <span className="font-medium text-navy-600">{rule.file_type}</span> only</>}
        </p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="focus-ring rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-500 hover:border-coral-300 hover:text-coral-600">
        Edit
      </button>
      <button type="button" onClick={() => onDeleteRule(rule.id)} className="focus-ring rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-400 hover:border-coral-400 hover:text-coral-600">
        Delete
      </button>
    </li>
  );
}

function TemplateCard({ template, onApply }) {
  const [applying, setApplying] = useState(false);
  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(template.id);
    } finally {
      setApplying(false);
    }
  };
  return (
    <div className="rounded-xl border border-navy-50 bg-white p-3 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-navy-700">{template.name}</p>
          <p className="mt-0.5 text-xs text-navy-400">{template.description}</p>
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={applying}
          className="focus-ring shrink-0 rounded-lg border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-500 transition hover:border-coral-300 hover:text-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {applying ? 'Applying…' : `Apply (${template.rule_count} rule${template.rule_count === 1 ? '' : 's'})`}
        </button>
      </div>
    </div>
  );
}

export default function RuleBuilder({ rules, templates, onApplyTemplate, onCreateRule, onUpdateRule, onReorderRules, onDeleteRule }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const sorted = [...rules].sort((a, b) => a.sort_order - b.sort_order);

  const handleMove = (from, to) => {
    const order = sorted.map((r) => r.id);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    onReorderRules(order);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Rule name is required.');
      return;
    }
    setError(null);
    await onCreateRule(form);
    setForm(emptyForm);
  };

  return (
    <div className="space-y-5">
      {templates?.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <button
            type="button"
            onClick={() => setTemplatesOpen((v) => !v)}
            aria-expanded={templatesOpen}
            className="focus-ring flex w-full items-center justify-between text-left"
          >
            <span className="text-base font-semibold text-navy-700">📋 Compliance rule templates</span>
            <span className="text-navy-400">{templatesOpen ? '−' : '+'}</span>
          </button>
          {templatesOpen && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-navy-400">
                One-click starting points for common retention patterns — applies as normal, fully editable rules.
              </p>
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} onApply={onApplyTemplate} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="mb-1 text-base font-semibold text-navy-700">Lifecycle rules</h2>
        <p className="mb-4 text-xs text-navy-400">Evaluated top to bottom; the first match wins per object, per tick.</p>
        <ul className="space-y-2">
          {sorted.map((rule, index) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              index={index}
              total={sorted.length}
              onUpdateRule={onUpdateRule}
              onDeleteRule={onDeleteRule}
              onMove={handleMove}
            />
          ))}
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="h-fit rounded-2xl bg-white p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-navy-700">New rule</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-400">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Cold to Archive"
              className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm focus:border-coral-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-400">From tier</label>
              <select
                value={form.from_tier}
                onChange={(e) => setForm((f) => ({ ...f, from_tier: e.target.value }))}
                className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm focus:border-coral-300"
              >
                {['Any', ...TIER_ORDER].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-400">After idle (days)</label>
              <input
                type="number"
                min="0"
                value={form.condition_days}
                onChange={(e) => setForm((f) => ({ ...f, condition_days: Number(e.target.value) }))}
                className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm focus:border-coral-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-400">Action</label>
              <select
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm focus:border-coral-300"
              >
                <option value="transition">Move to tier</option>
                <option value="delete">Delete</option>
              </select>
            </div>
            {form.action === 'transition' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-navy-400">To tier</label>
                <select
                  value={form.to_tier}
                  onChange={(e) => setForm((f) => ({ ...f, to_tier: e.target.value }))}
                  className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm focus:border-coral-300"
                >
                  {TIER_ORDER.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-400">File type (optional)</label>
            <select
              value={form.file_type}
              onChange={(e) => setForm((f) => ({ ...f, file_type: e.target.value }))}
              className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm focus:border-coral-300"
            >
              <option value="">Any file type</option>
              {FILE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="mt-2 text-xs font-medium text-coral-600">{error}</p>}
        <button
          type="submit"
          className="focus-ring mt-4 w-full rounded-lg bg-coral-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-coral-600 active:bg-coral-700"
        >
          Add rule
        </button>
      </form>
      </div>
    </div>
  );
}
