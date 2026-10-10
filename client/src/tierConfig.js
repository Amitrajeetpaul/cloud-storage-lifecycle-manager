export const TIER_ORDER = ['Hot', 'Warm', 'Cold', 'Archive'];

export const TIERS = {
  Hot: {
    costPerGbPerDay: 4.0,
    retrievalDelay: 'instant',
    accent: '#FF5A5F',
    accentSoft: '#FFE1E2',
    wash: 'linear-gradient(180deg, rgba(255,90,95,0.10) 0%, rgba(255,248,243,0) 60%)',
  },
  Warm: {
    costPerGbPerDay: 1.5,
    retrievalDelay: 'seconds',
    accent: '#E0A200',
    accentSoft: '#FFEFC7',
    wash: 'linear-gradient(180deg, rgba(255,201,77,0.14) 0%, rgba(255,248,243,0) 60%)',
  },
  Cold: {
    costPerGbPerDay: 0.4,
    retrievalDelay: 'minutes',
    accent: '#22A196',
    accentSoft: '#C7F4EF',
    wash: 'linear-gradient(180deg, rgba(46,196,182,0.14) 0%, rgba(255,248,243,0) 60%)',
  },
  Archive: {
    costPerGbPerDay: 0.05,
    retrievalDelay: 'hours',
    accent: '#565676',
    accentSoft: '#DEDEE8',
    wash: 'linear-gradient(180deg, rgba(34,34,59,0.10) 0%, rgba(255,248,243,0) 60%)',
  },
};

export function formatCurrency(value) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export function formatSize(sizeMb) {
  if (sizeMb >= 1024) return `${(sizeMb / 1024).toFixed(2)} GB`;
  return `${sizeMb.toFixed(1)} MB`;
}

// Formats a real elapsed millisecond duration as a compact human string
// (e.g. "3h", "2d 4h") — used for object age/idle time now that the clock
// is real wall-clock time rather than a simulated day counter.
export function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function elapsedDays(ms) {
  return ms / (24 * 60 * 60 * 1000);
}
