import { Sparkles } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      background: 'var(--c-bg)',
    }}>
      <div className="logo-icon" style={{ width: 48, height: 48 }}>
        <Sparkles size={24} className="animate-pulse" />
      </div>
      <div style={{ color: 'var(--c-text-muted)', fontSize: 'var(--fs-sm)' }}>
        Loading...
      </div>
    </div>
  );
}
