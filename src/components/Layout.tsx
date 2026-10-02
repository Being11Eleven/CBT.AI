import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Plus, BookOpen, Sliders, Compass, ChevronRight, LogIn } from 'lucide-react';
import CinematicIntro from './CinematicIntro';
import CbtLogo from './CbtLogo';
import AccountMenu from './AccountMenu';
import AuthModal from './AuthModal';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return sessionStorage.getItem('cbtai_intro_seen') !== 'true';
    } catch {
      return false;
    }
  });

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="layout">
      {/* First-visit cinematic intro */}
      {showIntro && <CinematicIntro onComplete={() => setShowIntro(false)} />}

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title="Sign in to CBT.AI"
        subtitle="Save examinations and sync your study history across devices."
      />

      <header className={`header ${scrolled ? 'header-scrolled' : ''}`}>
        <div className="header-inner container-wide">
          {/* Canonical Logo Mark */}
          <Link to="/" className="logo" aria-label="CBT.AI Homepage">
            <CbtLogo size={30} />
            <span className="logo-brand">
              CBT<span className="logo-dot-ai">.AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="nav-desktop" aria-label="Primary Navigation">
            <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
              <Compass size={15} />
              <span>Explore</span>
            </Link>
            <Link to="/my-exams" className={`nav-link ${isActive('/my-exams') ? 'active' : ''}`}>
              <BookOpen size={15} />
              <span>Examinations</span>
            </Link>
            <Link to="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`}>
              <Sliders size={15} />
              <span>Preferences</span>
            </Link>
          </nav>

          {/* Header Action & Auth Section */}
          <div className="header-actions">
            {user ? (
              <AccountMenu />
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm header-auth-btn"
                onClick={() => setAuthModalOpen(true)}
              >
                <LogIn size={14} />
                <span>Sign in</span>
              </button>
            )}

            <Link to="/create" className="btn btn-primary btn-sm header-cta">
              <Plus size={15} />
              <span>New Exam</span>
              <ChevronRight size={13} className="header-cta-arrow" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Refined Mobile Bottom Navigation Bar */}
      <nav className="nav-mobile" aria-label="Mobile Navigation">
        <div className="nav-mobile-inner glass">
          <Link to="/" className={`nav-mobile-link ${isActive('/') ? 'active' : ''}`}>
            <Compass size={18} />
            <span>Explore</span>
          </Link>
          <Link to="/create" className={`nav-mobile-link ${isActive('/create') ? 'active' : ''}`}>
            <Plus size={18} />
            <span>Create</span>
          </Link>
          <Link to="/my-exams" className={`nav-mobile-link ${isActive('/my-exams') ? 'active' : ''}`}>
            <BookOpen size={18} />
            <span>Exams</span>
          </Link>
          {user ? (
            <Link to="/settings" className={`nav-mobile-link ${isActive('/settings') ? 'active' : ''}`}>
              <Sliders size={18} />
              <span>Account</span>
            </Link>
          ) : (
            <button
              type="button"
              className="nav-mobile-link"
              onClick={() => setAuthModalOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <LogIn size={18} />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
