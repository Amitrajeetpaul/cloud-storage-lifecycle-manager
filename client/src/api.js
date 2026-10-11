const BASE = '/api';
const TOKEN_KEY = 'cslm_token';

export class AuthError extends Error {}

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage unavailable (private browsing, etc.) — session just won't persist across reloads.
  }
}

async function request(path, options = {}) {
  const token = getToken();
  // FormData requests (file uploads) must NOT set Content-Type manually —
  // the browser needs to add its own multipart boundary parameter.
  const isFormData = options.body instanceof FormData;
  const headers = { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    setToken(null);
    const body = await res.json().catch(() => ({}));
    throw new AuthError(body.error || 'authentication required');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function downloadFile(path, suggestedName) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (res.status === 401) {
    setToken(null);
    throw new AuthError('authentication required');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(url);
}

export const api = {
  // auth
  login: async (username, password) => {
    const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    setToken(result.token);
    return result;
  },
  logout: () => setToken(null),
  isAuthenticated: () => Boolean(getToken()),

  // objects
  listObjects: () => request('/objects'),
  createObject: (payload) => request('/objects', { method: 'POST', body: JSON.stringify(payload) }),
  uploadObject: (file, tier, name) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tier', tier);
    if (name) formData.append('name', name);
    return request('/objects/upload', { method: 'POST', body: formData });
  },
  downloadObject: (id, name) => downloadFile(`/objects/${id}/download`, name),
  seedObjects: (count = 20) => request('/objects/seed', { method: 'POST', body: JSON.stringify({ count }) }),
  setObjectTier: (id, tier) => request(`/objects/${id}/tier`, { method: 'PATCH', body: JSON.stringify({ tier }) }),
  markAccessed: (id) => request(`/objects/${id}/access`, { method: 'PATCH' }),
  deleteObject: (id) => request(`/objects/${id}`, { method: 'DELETE' }),

  // rules
  listRules: () => request('/rules'),
  createRule: (payload) => request('/rules', { method: 'POST', body: JSON.stringify(payload) }),
  updateRule: (id, payload) => request(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  reorderRules: (order) => request('/rules/reorder', { method: 'POST', body: JSON.stringify({ order }) }),
  deleteRule: (id) => request(`/rules/${id}`, { method: 'DELETE' }),
  listRuleTemplates: () => request('/rules/templates'),
  applyRuleTemplate: (id) => request(`/rules/templates/${id}/apply`, { method: 'POST' }),

  // simulation
  evaluateNow: () => request('/simulation/evaluate', { method: 'POST' }),
  getEngineState: () => request('/simulation/state'),
  getHistory: () => request('/simulation/history'),
  getOptimizationSuggestions: () => request('/simulation/optimize'),
  applyOptimization: () => request('/simulation/optimize/apply', { method: 'POST' }),
  getForecast: () => request('/simulation/forecast'),
  getProviderComparison: () => request('/simulation/provider-comparison'),

  // audit
  getAudit: () => request('/audit'),
};
