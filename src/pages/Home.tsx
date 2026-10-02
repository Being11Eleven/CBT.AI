import { Link } from 'react-router-dom';
import { PlusCircle, BookOpen, Sparkles, Brain, Shield, BarChart3, Clock, FileText, Zap, Target } from 'lucide-react';
import './Home.css';

export default function Home() {
  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
        </div>
        <div className="container hero-content animate-fade-in">
          <div className="hero-badge badge badge-primary">
            <Sparkles size={12} /> AI-Powered Examination
          </div>
          <h1 className="hero-title">
            Build Your Own<br />
            <span className="gradient-text">Examination</span>
          </h1>
          <p className="hero-subtitle">
            Upload the material. Define the challenge. Let the AI build the test.<br />
            From school to JEE Advanced — one platform, infinite possibilities.
          </p>
          <div className="hero-actions">
            <Link to="/create" className="btn btn-primary btn-lg">
              <PlusCircle size={20} /> Create Exam
            </Link>
            <Link to="/my-exams" className="btn btn-secondary btn-lg">
              <BookOpen size={20} /> My Exams
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-num">∞</span>
              <span className="hero-stat-label">Question Types</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">20+</span>
              <span className="hero-stat-label">Academic Levels</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">AI</span>
              <span className="hero-stat-label">Powered Engine</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section container">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">From PDF to detailed result in minutes</p>
        <div className="steps-grid">
          {[
            { icon: <FileText size={24} />, title: 'Upload Material', desc: 'PDF, text, syllabus, or teacher instructions' },
            { icon: <Target size={24} />, title: 'Configure Exam', desc: 'Class, subject, difficulty, question types' },
            { icon: <Brain size={24} />, title: 'AI Generates', desc: 'Questions created, validated, and balanced' },
            { icon: <Clock size={24} />, title: 'Take the CBT', desc: 'Realistic exam with timer and autosave' },
            { icon: <BarChart3 size={24} />, title: 'Get Results', desc: 'Detailed analysis with corrections' },
          ].map((step, i) => (
            <div key={i} className="step-card card animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="step-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="section container">
        <h2 className="section-title">Premium Features</h2>
        <div className="features-grid">
          {[
            { icon: <Zap size={20} />, title: 'AI Question Generation', desc: 'Original questions generated from your material with multi-stage validation' },
            { icon: <Shield size={20} />, title: 'Exam Integrity', desc: 'Fullscreen mode, tab-switch detection, and automatic submission' },
            { icon: <Brain size={20} />, title: 'Smart Evaluation', desc: 'Deterministic + AI evaluation with rubric-based subjective grading' },
            { icon: <BarChart3 size={20} />, title: 'Deep Analytics', desc: 'Topic-wise, difficulty-wise, and characteristic-wise performance analysis' },
            { icon: <Target size={20} />, title: 'Difficulty Calibration', desc: 'From Easy to Extreme with conceptual, reasoning, and twisted styles' },
            { icon: <BookOpen size={20} />, title: 'Universal Levels', desc: 'Class 6 to JEE Advanced, university semesters, and custom levels' },
          ].map((f, i) => (
            <div key={i} className="feature-card card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section container" style={{ textAlign: 'center', paddingBottom: 'var(--sp-20)' }}>
        <h2 className="section-title">Ready to Begin?</h2>
        <p className="section-subtitle">Create your first AI-powered examination in minutes</p>
        <Link to="/create" className="btn btn-primary btn-lg" style={{ marginTop: 'var(--sp-6)' }}>
          <Sparkles size={20} /> Start Creating
        </Link>
      </section>
    </div>
  );
}
