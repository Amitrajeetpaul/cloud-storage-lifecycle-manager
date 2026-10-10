import { useState } from 'react';

export default function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-200 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wider text-coral-600">ISM · MinIO-style ILM Simulation</p>
        <h1 className="mt-1 text-xl font-semibold text-navy-700">Cloud Storage Lifecycle Manager</h1>
        <p className="mt-1 text-sm text-navy-400">Sign in to access the dashboard.</p>

        <div className="mt-5 space-y-3">
          <div>
            <label htmlFor="login-username" className="mb-1 block text-xs font-medium text-navy-400">Username</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm text-navy-700 focus:border-coral-300"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-xs font-medium text-navy-400">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm text-navy-700 focus:border-coral-300"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-coral-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="focus-ring mt-5 w-full rounded-lg bg-coral-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-coral-600 active:bg-coral-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
