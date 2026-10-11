// Pre-built rule bundles mapped to common real-world retention/compliance
// patterns. Applying a template just creates these as normal, fully
// editable rules in the rules table — there's no special "template" state
// afterward, it's purely a one-click starting point.
export const RULE_TEMPLATES = [
  {
    id: 'gdpr-right-to-be-forgotten',
    name: 'GDPR — Right to be Forgotten',
    description:
      'EU GDPR does not fix a universal retention period, but a common practice is to purge ' +
      'inactive user-submitted data after a bounded idle period so it isn\'t held indefinitely ' +
      'without basis. Deletes idle "User Upload" objects after 90 days, regardless of tier.',
    rules: [
      { name: 'GDPR: delete idle user uploads', from_tier: 'Any', file_type: 'User Upload', condition_days: 90, action: 'delete', to_tier: null },
    ],
  },
  {
    id: 'financial-records-7yr',
    name: 'Financial Records Retention (7 years)',
    description:
      'A common requirement (e.g. US SOX, many tax authorities) is retaining financial/business ' +
      'records for 7 years, cheaply, then disposing of them. Tiers Documents down over time and ' +
      'expires them at 7 years.',
    rules: [
      { name: 'Financial: Hot to Warm', from_tier: 'Hot', file_type: 'Document', condition_days: 30, action: 'transition', to_tier: 'Warm' },
      { name: 'Financial: Warm to Cold', from_tier: 'Warm', file_type: 'Document', condition_days: 365, action: 'transition', to_tier: 'Cold' },
      { name: 'Financial: Cold to Archive', from_tier: 'Cold', file_type: 'Document', condition_days: 1095, action: 'transition', to_tier: 'Archive' },
      { name: 'Financial: 7-year expiry', from_tier: 'Archive', file_type: 'Document', condition_days: 2555, action: 'delete', to_tier: null },
    ],
  },
  {
    id: 'hipaa-medical-6yr',
    name: 'Healthcare Records Retention (6 years)',
    description:
      'US HIPAA requires most records be retained a minimum of 6 years. Keeps Documents and ' +
      'Backups cheaply archived and expires them at the 6-year mark.',
    rules: [
      { name: 'Medical: Cold after 180d', from_tier: 'Any', file_type: 'Document', condition_days: 180, action: 'transition', to_tier: 'Cold' },
      { name: 'Medical: Archive after 1yr', from_tier: 'Cold', file_type: 'Document', condition_days: 365, action: 'transition', to_tier: 'Archive' },
      { name: 'Medical: 6-year expiry', from_tier: 'Archive', file_type: 'Document', condition_days: 2190, action: 'delete', to_tier: null },
    ],
  },
  {
    id: 'log-retention-90d',
    name: 'Log Retention (90 days)',
    description:
      'A standard ops/security practice: keep logs quickly accessible for a short incident-response ' +
      'window, then cheaply archived, then gone. Moves Logs to Cold fast and deletes them at 90 days.',
    rules: [
      { name: 'Logs: Cold after 7d', from_tier: 'Any', file_type: 'Logs', condition_days: 7, action: 'transition', to_tier: 'Cold' },
      { name: 'Logs: 90-day expiry', from_tier: 'Cold', file_type: 'Logs', condition_days: 90, action: 'delete', to_tier: null },
    ],
  },
];

export function getTemplate(id) {
  return RULE_TEMPLATES.find((t) => t.id === id) ?? null;
}
