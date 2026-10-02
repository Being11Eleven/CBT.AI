/* ============================================================
   CBT.AI — User Preferences & Account Settings
   Focused exclusively on student settings, account sync,
   motion preferences, and privacy. Internal infrastructure
   is kept private on the server.
   ============================================================ */

import { useState, useEffect } from 'react';
import { Shield, Trash2, CheckCircle2, User as UserIcon, LogIn, LogOut, Sliders, Moon, Sparkles, Cloud } from 'lucide-react';
import { storage } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import './Settings.css';

export default function Settings() {
  const { user, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);

  // User preferences
  const [reducedMotion, setReducedMotion] = useState(() => {
    return localStorage.getItem('cbtai_reduced_motion') === 'true';
  });

  const [defaultMode, setDefaultMode] = useState<'serious' | 'practice'>(() => {
    return (localStorage.getItem('cbtai_default_mode') as 'serious' | 'practice') || 'serious';
  });

  const [autoAdvance, setAutoAdvance] = useState(() => {
    return localStorage.getItem('cbtai_auto_advance') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('cbtai_reduced_motion', String(reducedMotion));
    if (reducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }
  }, [reducedMotion]);

  useEffect(() => {
    localStorage.setItem('cbtai_default_mode', defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    localStorage.setItem('cbtai_auto_advance', String(autoAdvance));
  }, [autoAdvance]);

  const handleClearData = () => {
    if (window.confirm('This will clear all local examination drafts and cached results on this device. Your cloud-synced account data will remain safe. Continue?')) {
      storage.clearAll();
      setClearedNotice(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div className="settings-page container animate-fade-in">
      <div className="settings-header">
        <h1>Preferences & Account</h1>
        <p className="settings-subtitle">Manage your account identity, examination behavior, and interface preferences.</p>
      </div>

      {clearedNotice && (
        <div className="success-banner">
          <CheckCircle2 size={16} /> Local browser examination cache has been cleared.
        </div>
      )}

      {/* Account & Sync Section */}
      <div className="settings-section">
        <div className="settings-section-title">
          <UserIcon size={20} className="section-icon" />
          <div>
            <h2>Account & Cloud Persistence</h2>
            <p>Access your examinations, question reviews, and performance analytics across all devices.</p>
          </div>
        </div>

        {user ? (
          <div className="account-card">
            <div className="account-card-left">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="account-avatar-img" />
              ) : (
                <div className="account-avatar-fallback">
                  {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                </div>
              )}
              <div className="account-info">
                <div className="account-name">{user.displayName || 'Google Account'}</div>
                <div className="account-email">{user.email}</div>
                <div className="account-sync-tag">
                  <Cloud size={13} />
                  <span>Cloud persistence active</span>
                </div>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => logout()}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        ) : (
          <div className="guest-card">
            <div className="guest-info">
              <div className="guest-title">Guest Session (Local Storage Only)</div>
              <p className="guest-desc">Your examinations are currently saved in this browser only. Sign in with Google to sync them securely across your devices.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAuthModal(true)}>
              <LogIn size={15} /> Sign in with Google
            </button>
          </div>
        )}
      </div>

      {/* Examination Preferences */}
      <div className="settings-section">
        <div className="settings-section-title">
          <Sliders size={20} className="section-icon" />
          <div>
            <h2>Examination Environment</h2>
            <p>Customize the default behavior of your computer-based tests.</p>
          </div>
        </div>

        <div className="preference-group">
          <div className="preference-item">
            <div className="pref-text">
              <label htmlFor="pref-default-mode" className="pref-label">Default Examination Mode</label>
              <span className="pref-subtext">Choose your default mode when opening generated examinations.</span>
            </div>
            <div className="segmented-control">
              <button
                type="button"
                className={`segment-btn ${defaultMode === 'serious' ? 'active' : ''}`}
                onClick={() => setDefaultMode('serious')}
              >
                Strict Mode
              </button>
              <button
                type="button"
                className={`segment-btn ${defaultMode === 'practice' ? 'active' : ''}`}
                onClick={() => setDefaultMode('practice')}
              >
                Practice Mode
              </button>
            </div>
          </div>

          <div className="preference-item">
            <div className="pref-text">
              <label htmlFor="pref-reduced-motion" className="pref-label">Reduced Motion</label>
              <span className="pref-subtext">Minimize ambient particles, animated backgrounds, and cinematic transitions.</span>
            </div>
            <label className="toggle-switch">
              <input
                id="pref-reduced-motion"
                type="checkbox"
                checked={reducedMotion}
                onChange={e => setReducedMotion(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="preference-item">
            <div className="pref-text">
              <label htmlFor="pref-auto-advance" className="pref-label">Auto-Advance on MCQ Selection</label>
              <span className="pref-subtext">Automatically jump to the next question after answering a single-choice question.</span>
            </div>
            <label className="toggle-switch">
              <input
                id="pref-auto-advance"
                type="checkbox"
                checked={autoAdvance}
                onChange={e => setAutoAdvance(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>

      {/* Privacy & Security Guarantees */}
      <div className="settings-section">
        <div className="settings-section-title">
          <Shield size={20} className="section-icon" />
          <div>
            <h2>Privacy & Document Protection</h2>
            <p>Zero-retention standards for student data and uploaded study material.</p>
          </div>
        </div>

        <div className="privacy-list">
          <div className="privacy-item">
            <div className="privacy-dot" />
            <div>
              <strong>Ephemeral Document Processing:</strong> Uploaded textbooks, syllabus files, and reference notes are held temporarily in-memory during question generation and never indexed or shared publicly.
            </div>
          </div>
          <div className="privacy-item">
            <div className="privacy-dot" />
            <div>
              <strong>User-Scoped Isolation:</strong> Each authenticated student has isolated, private database storage protected by server-side security rules.
            </div>
          </div>
          <div className="privacy-item">
            <div className="privacy-dot" />
            <div>
              <strong>Secure Client Session:</strong> No confidential API keys, model credentials, or generation endpoints are ever exposed to the client browser.
            </div>
          </div>
        </div>
      </div>

      {/* Local Storage & Cache */}
      <div className="settings-section danger-section">
        <div className="settings-section-title">
          <Trash2 size={20} className="section-icon danger" />
          <div>
            <h2>Local Device Cache</h2>
            <p>Clear temporary offline drafts and cached attempt logs stored on this machine.</p>
          </div>
        </div>

        <div className="danger-content">
          <p className="danger-text">
            Clearing local storage removes offline drafts on this browser. It does not affect examinations stored on your cloud account.
          </p>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleClearData}
          >
            <Trash2 size={15} /> Clear Local Cache
          </button>
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
