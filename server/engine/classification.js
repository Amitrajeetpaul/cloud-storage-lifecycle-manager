import { TIER_ORDER } from './costEngine.js';

// Lightweight, deterministic pattern classification — not ML. Matches on
// filename keywords, same vocabulary as the seed generator's SAMPLE_NAMES.
const FILE_TYPE_PATTERNS = [
  { type: 'Logs', pattern: /log|telemetry/i },
  { type: 'Backup', pattern: /backup|snapshot|db-snapshot/i },
  { type: 'Media', pattern: /video|photo|audio|thumbnail|session-recording/i },
  { type: 'Document', pattern: /invoice|report|contract|presentation|email-export/i },
  { type: 'ML/Dataset', pattern: /ml-checkpoint|dataset/i },
  { type: 'Archive', pattern: /tarball|config-bundle|firmware/i },
  { type: 'User Upload', pattern: /user-upload/i },
];

// Fallback for real uploaded files, whose names won't generally contain the
// seed generator's keywords — classify by extension instead.
const EXTENSION_TYPE_MAP = {
  pdf: 'Document', doc: 'Document', docx: 'Document', txt: 'Document',
  xls: 'Document', xlsx: 'Document', ppt: 'Document', pptx: 'Document', csv: 'Document',
  jpg: 'Media', jpeg: 'Media', png: 'Media', gif: 'Media', webp: 'Media', svg: 'Media',
  mp4: 'Media', mov: 'Media', avi: 'Media', mkv: 'Media', mp3: 'Media', wav: 'Media',
  zip: 'Archive', tar: 'Archive', gz: 'Archive', rar: 'Archive', '7z': 'Archive',
  log: 'Logs',
  sql: 'Backup', bak: 'Backup', dump: 'Backup',
  json: 'ML/Dataset', parquet: 'ML/Dataset', npy: 'ML/Dataset',
};

export const FILE_TYPES = [...new Set(FILE_TYPE_PATTERNS.map((p) => p.type)), 'Other'];

export function classifyFileType(name) {
  const match = FILE_TYPE_PATTERNS.find((p) => p.pattern.test(name));
  if (match) return match.type;
  const ext = name.split('.').pop()?.toLowerCase();
  return EXTENSION_TYPE_MAP[ext] || 'Other';
}

// Rolling-window access frequency, derived from observed audit_log activity
// rather than a fixed admin-set threshold — the "access pattern" input to
// the optimizer below.
export function classifyAccessFrequency(accessCountInWindow) {
  if (accessCountInWindow >= 3) return 'Frequent';
  if (accessCountInWindow >= 1) return 'Occasional';
  return 'Rare';
}

// Retrieval-latency class per tier: Hot/Warm serve reads fast enough for
// frequently-touched data; Cold/Archive trade latency for cost and are only
// appropriate once real usage has actually gone quiet.
const RETRIEVAL_CLASS = { Hot: 'fast', Warm: 'fast', Cold: 'slow', Archive: 'slow' };

// Given how often an object is really being accessed, what's the cheapest
// tier that still respects its retrieval-latency needs? This is the
// optimizer's recommendation — independent of the rule engine's fixed idle
// thresholds, and it can suggest moving an object sooner than the rules
// would, based on observed behavior instead of a timer alone.
export function recommendTierForFrequency(frequency) {
  if (frequency === 'Frequent') return 'Hot';
  if (frequency === 'Occasional') return 'Warm';
  return 'Archive'; // Rare: no fast-retrieval need observed, go to the cheapest tier
}

export function isColderTier(a, b) {
  return TIER_ORDER.indexOf(a) > TIER_ORDER.indexOf(b);
}

export function retrievalClassFor(tier) {
  return RETRIEVAL_CLASS[tier];
}
