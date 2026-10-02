import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, ShieldCheck, ChevronDown, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AccountMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!user) return null;

  const initial = (user.displayName || user.email || 'U')[0].toUpperCase();

  return (
    <div className="account-menu-container" ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="account-pill-btn"
        aria-label="Account menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.25rem 0.65rem 0.25rem 0.35rem',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '9999px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #06B6D4, #6366F1)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {initial}
          </div>
        )}
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f1f5f9', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Scholar'}
        </span>
        <ChevronDown size={13} style={{ color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </button>

      {isOpen && (
        <div
          className="account-dropdown surface-elevated animate-scale-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '240px',
            background: '#0d0f16',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--r-xl)',
            padding: '1rem',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {/* User Info Header */}
          <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.displayName || 'CBT.AI User'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email || ''}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.6875rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.08)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
              <ShieldCheck size={11} />
              <span>Cloud Sync Active</span>
            </div>
          </div>

          {/* Links */}
          <Link
            to="/my-exams"
            onClick={() => setIsOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#cbd5e1',
              padding: '0.45rem 0.5rem',
              borderRadius: 'var(--r-md)',
              transition: 'background 0.2s ease',
            }}
          >
            <BookOpen size={15} style={{ color: '#38bdf8' }} />
            <span>My Examinations</span>
          </Link>

          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#cbd5e1',
              padding: '0.45rem 0.5rem',
              borderRadius: 'var(--r-md)',
              transition: 'background 0.2s ease',
            }}
          >
            <UserIcon size={15} style={{ color: '#818cf8' }} />
            <span>Preferences</span>
          </Link>

          {/* Sign Out */}
          <button
            onClick={async () => {
              setIsOpen(false);
              await logout();
              navigate('/');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#f43f5e',
              padding: '0.45rem 0.5rem',
              borderRadius: 'var(--r-md)',
              cursor: 'pointer',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: '0.75rem',
              marginTop: '0.25rem',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
