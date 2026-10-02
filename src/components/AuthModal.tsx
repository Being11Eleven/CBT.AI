import { useState } from 'react';
import { X, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CbtLogo from './CbtLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  title = 'Sign in to CBT.AI',
  subtitle = 'Save your examinations and access your results across any device.',
}: AuthModalProps) {
  const { loginWithGoogle, error, clearError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    clearError();
    try {
      await loginWithGoogle();
      onClose();
    } catch {
      // error handled in context
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div
      className="modal-overlay animate-fade-in"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 6, 8, 0.82)',
        backdropFilter: 'blur(16px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="auth-modal-dialog surface-elevated animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#0d0f16',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 'var(--r-2xl)',
          padding: '2.5rem 2rem',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          position: 'relative',
          textAlign: 'center',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            color: '#64748b',
            padding: '0.4rem',
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
          }}
        >
          <X size={18} />
        </button>

        {/* Emblem */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <CbtLogo size={48} />
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          {title}
        </h2>

        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '2rem' }}>
          {subtitle}
        </p>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: 'var(--r-lg)',
              color: '#fb7185',
              fontSize: '0.8125rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Google Primary Button */}
        <button
          className="btn btn-primary btn-lg"
          onClick={handleGoogleSignIn}
          disabled={signingIn}
          style={{
            width: '100%',
            padding: '0.95rem 1.5rem',
            borderRadius: 'var(--r-xl)',
            fontSize: '0.9375rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 20px rgba(255, 255, 255, 0.15)',
          }}
        >
          {/* Google 'G' Mark */}
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.87c2.26-2.09 3.675-5.17 3.675-9.09z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.25v3.1C3.27 21.43 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.6H1.25C.45 8.19 0 9.99 0 12s.45 3.81 1.25 5.4l4.02-3.11z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.57 1.25 6.6l4.02 3.11c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
          <span>{signingIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        {/* Clear, dignified privacy notice */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', color: '#64748b', fontSize: '0.75rem' }}>
          <ShieldCheck size={14} className="text-cyan" />
          <span>Your private documents and examinations are protected under end-user encryption.</span>
        </div>
      </div>
    </div>
  );
}
