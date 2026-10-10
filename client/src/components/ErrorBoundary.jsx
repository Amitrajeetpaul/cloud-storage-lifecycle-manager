import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Dashboard crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-200 px-4">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-card">
          <p className="text-base font-semibold text-navy-700">Something went wrong.</p>
          <p className="mt-1 text-sm text-navy-400">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="focus-ring mt-4 rounded-lg bg-coral-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral-600"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
