import { useState, useEffect } from 'react';
import { Key, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { storage } from '../services/storage';
import './Settings.css';

export default function Settings() {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const config = storage.getAIConfig();
    if (config) {
      setProvider(config.provider || 'gemini');
      setApiKey(config.apiKey || '');
      setModel(config.model || '');
      setEndpoint(config.endpoint || '');
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    setError('');

    const defaultModel =
      provider === 'gemini' ? 'gemini-2.0-flash' :
      provider === 'openai' ? 'gpt-4o-mini' : model || 'gpt-4o-mini';

    storage.saveAIConfig({
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || defaultModel,
      endpoint: endpoint.trim() || undefined,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClearData = () => {
    if (confirm('This will delete ALL exams, attempts, and results. This cannot be undone.')) {
      storage.clearAll();
      window.location.reload();
    }
  };

  return (
    <div className="settings-page container animate-fade-in">
      <h1>Settings</h1>
      <p className="settings-subtitle">Configure your AI provider and application preferences</p>

      {/* AI Provider */}
      <div className="settings-section">
        <h2><Key size={18} /> AI Provider Configuration</h2>
        <p className="settings-desc">
          Your API key is stored locally in your browser and never sent to our servers.
          All AI calls go directly from your browser to the provider.
        </p>

        {error && (
          <div className="error-banner" style={{ marginBottom: 'var(--sp-4)' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {saved && (
          <div className="success-banner">
            <CheckCircle2 size={14} /> Configuration saved successfully
          </div>
        )}

        <div className="form-group">
          <label className="label">Provider</label>
          <select className="select" value={provider} onChange={e => setProvider(e.target.value)}>
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="custom">Custom (OpenAI-compatible)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="label">API Key</label>
          <input
            type="password"
            className="input"
            placeholder={provider === 'gemini' ? 'AIza...' : 'sk-...'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <span className="input-hint">
            {provider === 'gemini' && 'Get a free API key from aistudio.google.com'}
            {provider === 'openai' && 'Get your key from platform.openai.com'}
            {provider === 'custom' && 'Enter your API key'}
          </span>
        </div>

        <div className="form-group">
          <label className="label">Model (optional)</label>
          <input
            type="text"
            className="input"
            placeholder={provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'}
            value={model}
            onChange={e => setModel(e.target.value)}
          />
        </div>

        {provider === 'custom' && (
          <div className="form-group">
            <label className="label">API Endpoint</label>
            <input
              type="text"
              className="input"
              placeholder="https://api.example.com/v1/chat/completions"
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
            />
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={16} /> Save Configuration
        </button>
      </div>

      {/* Data */}
      <div className="settings-section danger-section">
        <h2><Trash2 size={18} /> Data Management</h2>
        <p className="settings-desc">
          All data is stored locally in your browser.
        </p>
        <button className="btn btn-danger" onClick={handleClearData}>
          <Trash2 size={16} /> Clear All Data
        </button>
      </div>
    </div>
  );
}
