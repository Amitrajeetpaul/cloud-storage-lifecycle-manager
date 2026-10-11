import { useCallback, useEffect, useState } from 'react';
import { api, AuthError } from './api';
import Dashboard from './components/Dashboard.jsx';
import LoginForm from './components/LoginForm.jsx';

const POLL_INTERVAL_MS = 30_000;

export default function App() {
  const [authed, setAuthed] = useState(api.isAuthenticated());
  const [objects, setObjects] = useState([]);
  const [rules, setRules] = useState([]);
  const [engineState, setEngineState] = useState(null);
  const [history, setHistory] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastEvaluationSummary, setLastEvaluationSummary] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [providerComparison, setProviderComparison] = useState(null);
  const [ruleTemplates, setRuleTemplates] = useState([]);

  // Wraps an action so an expired/invalid session bounces back to the login
  // screen instead of surfacing "authentication required" as a generic error.
  const guard = useCallback((fn) => async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AuthError) {
        setAuthed(false);
        return;
      }
      throw e;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [objs, rls, state, hist, aud, opt, fc, cmp, tmpl] = await Promise.all([
        api.listObjects(),
        api.listRules(),
        api.getEngineState(),
        api.getHistory(),
        api.getAudit(),
        api.getOptimizationSuggestions(),
        api.getForecast(),
        api.getProviderComparison(),
        api.listRuleTemplates(),
      ]);
      setObjects(objs);
      setRules(rls);
      setEngineState(state);
      setHistory(hist);
      setAudit(aud);
      setOptimization(opt);
      setForecast(fc.forecast);
      setProviderComparison(cmp);
      setRuleTemplates(tmpl);
      setError(null);
    } catch (e) {
      if (e instanceof AuthError) {
        setAuthed(false);
        return;
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) refreshAll();
  }, [authed, refreshAll]);

  // The lifecycle engine now runs on a real background schedule (server-side
  // setInterval), not on manual clicks — poll periodically so transitions it
  // applies in the background still show up without a manual refresh.
  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(refreshAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [authed, refreshAll]);

  const handleLogin = useCallback(async (username, password) => {
    await api.login(username, password);
    setLoading(true);
    setAuthed(true);
  }, []);

  const handleLogout = useCallback(() => {
    api.logout();
    setAuthed(false);
  }, []);

  const handleApplyOptimization = useCallback(guard(async () => {
    const summary = await api.applyOptimization();
    await refreshAll();
    return summary;
  }), [refreshAll, guard]);

  const handleEvaluateNow = useCallback(guard(async () => {
    const summary = await api.evaluateNow();
    setLastEvaluationSummary(summary);
    await refreshAll();
    return summary;
  }), [refreshAll, guard]);

  const handleSeed = useCallback(guard(async (count) => {
    await api.seedObjects(count);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleCreateObject = useCallback(guard(async (payload) => {
    await api.createObject(payload);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleUploadObject = useCallback(guard(async (file, tier, name) => {
    await api.uploadObject(file, tier, name);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleDownloadObject = useCallback(guard(async (id, name) => {
    await api.downloadObject(id, name);
  }), [guard]);

  const handleSetTier = useCallback(guard(async (id, tier) => {
    await api.setObjectTier(id, tier);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleMarkAccessed = useCallback(guard(async (id) => {
    await api.markAccessed(id);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleDeleteObject = useCallback(guard(async (id) => {
    await api.deleteObject(id);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleCreateRule = useCallback(guard(async (payload) => {
    await api.createRule(payload);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleUpdateRule = useCallback(guard(async (id, payload) => {
    await api.updateRule(id, payload);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleReorderRules = useCallback(guard(async (order) => {
    await api.reorderRules(order);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleDeleteRule = useCallback(guard(async (id) => {
    await api.deleteRule(id);
    await refreshAll();
  }), [refreshAll, guard]);

  const handleApplyRuleTemplate = useCallback(guard(async (id) => {
    await api.applyRuleTemplate(id);
    await refreshAll();
  }), [refreshAll, guard]);

  if (!authed) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <Dashboard
      objects={objects}
      rules={rules}
      engineState={engineState}
      history={history}
      audit={audit}
      loading={loading}
      error={error}
      lastEvaluationSummary={lastEvaluationSummary}
      optimization={optimization}
      forecast={forecast}
      providerComparison={providerComparison}
      ruleTemplates={ruleTemplates}
      onApplyRuleTemplate={handleApplyRuleTemplate}
      onEvaluateNow={handleEvaluateNow}
      onApplyOptimization={handleApplyOptimization}
      onSeed={handleSeed}
      onCreateObject={handleCreateObject}
      onUploadObject={handleUploadObject}
      onDownloadObject={handleDownloadObject}
      onSetTier={handleSetTier}
      onMarkAccessed={handleMarkAccessed}
      onDeleteObject={handleDeleteObject}
      onCreateRule={handleCreateRule}
      onUpdateRule={handleUpdateRule}
      onReorderRules={handleReorderRules}
      onDeleteRule={handleDeleteRule}
      onLogout={handleLogout}
    />
  );
}
