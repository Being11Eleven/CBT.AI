import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, BookOpen, Settings, Sparkles } from 'lucide-react';
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="layout">
      <header className="header glass">
        <div className="header-inner container">
          <Link to="/" className="logo">
            <div className="logo-icon">
              <Sparkles size={20} />
            </div>
            <span className="logo-text">CBT<span className="logo-accent">.AI</span></span>
          </Link>

          <nav className="nav-desktop">
            <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
              <Home size={16} /> Home
            </Link>
            <Link to="/create" className={`nav-link ${isActive('/create') ? 'active' : ''}`}>
              <PlusCircle size={16} /> Create Exam
            </Link>
            <Link to="/my-exams" className={`nav-link ${isActive('/my-exams') ? 'active' : ''}`}>
              <BookOpen size={16} /> My Exams
            </Link>
            <Link to="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`}>
              <Settings size={16} /> Settings
            </Link>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="nav-mobile glass">
        <Link to="/" className={`nav-mobile-link ${isActive('/') ? 'active' : ''}`}>
          <Home size={20} />
          <span>Home</span>
        </Link>
        <Link to="/create" className={`nav-mobile-link ${isActive('/create') ? 'active' : ''}`}>
          <PlusCircle size={20} />
          <span>Create</span>
        </Link>
        <Link to="/my-exams" className={`nav-mobile-link ${isActive('/my-exams') ? 'active' : ''}`}>
          <BookOpen size={20} />
          <span>Exams</span>
        </Link>
        <Link to="/settings" className={`nav-mobile-link ${isActive('/settings') ? 'active' : ''}`}>
          <Settings size={20} />
          <span>Settings</span>
        </Link>
      </nav>
    </div>
  );
}
