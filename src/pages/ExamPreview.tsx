import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play,
  ArrowLeft,
  Clock,
  Hash,
  BarChart3,
  Target,
  BookOpen,
  ShieldAlert,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { storage } from '../services/storage';
import { DIFFICULTIES } from '../data/constants';
import MathText from '../components/MathText';
import type { ExamMode } from '../types';
import './ExamPreview.css';

export default function ExamPreview() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const exam = examId ? storage.getExam(examId) : null;

  const [selectedMode, setSelectedMode] = useState<ExamMode>('practice');
  const [acknowledged, setAcknowledged] = useState(false);

  if (!exam) {
    return (
      <div className="container" style={{ padding: 'var(--sp-20) 0', textAlign: 'center' }}>
        <h2>Exam Not Found</h2>
        <Link to="/my-exams" className="btn btn-secondary" style={{ marginTop: 'var(--sp-4)' }}>
          Back to My Exams
        </Link>
      </div>
    );
  }

  const diffLabel = DIFFICULTIES.find(d => d.value === exam.config.difficulty)?.label || exam.config.difficulty;
  const totalMarks = exam.questions.length * exam.config.marking.correct;

  const handleStartExam = () => {
    if (examId) {
      sessionStorage.setItem(`cbtai_exam_mode_${examId}`, selectedMode);
    }
    navigate(`/exam/${examId}`);
  };

  return (
    <div className="preview-page container animate-fade-in">
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--sp-4)' }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="preview-header">
        <span className="eyebrow">EXAMINATION SPECIFICATION</span>
        <h1>{exam.config.title}</h1>
        <div className="preview-badges">
          <span className="badge badge-primary">{exam.config.level.label}</span>
          <span className="badge badge-info">{exam.config.subject}</span>
          <span className="badge badge-warning">{diffLabel}</span>
        </div>
      </div>

      <div className="preview-stats">
        <div className="preview-stat">
          <Hash size={18} />
          <div>
            <span className="stat-num">{exam.questions.length}</span>
            <span className="stat-label">Questions</span>
          </div>
        </div>
        <div className="preview-stat">
          <Clock size={18} />
          <div>
            <span className="stat-num">{exam.config.duration} min</span>
            <span className="stat-label">Duration</span>
          </div>
        </div>
        <div className="preview-stat">
          <BarChart3 size={18} />
          <div>
            <span className="stat-num">{totalMarks}</span>
            <span className="stat-label">Total Marks</span>
          </div>
        </div>
        <div className="preview-stat">
          <Target size={18} />
          <div>
            <span className="stat-num">+{exam.config.marking.correct} / {exam.config.marking.incorrect}</span>
            <span className="stat-label">Marking Rule</span>
          </div>
        </div>
      </div>

      {/* ============================================================
          EXAM MODE SELECTOR (Practice Mode vs Strict Mode)
          ============================================================ */}
      <div className="mode-selection-container surface-elevated">
        <div className="mode-section-head">
          <h3>Select Examination Mode</h3>
          <p>Choose the environment rules appropriate for your current preparation objective.</p>
        </div>

        <div className="mode-cards-grid">
          {/* Practice Mode Card */}
          <div
            className={`mode-card ${selectedMode === 'practice' ? 'selected practice' : ''}`}
            onClick={() => setSelectedMode('practice')}
          >
            <div className="mode-card-header">
              <div className="mode-icon-circle practice-icon">
                <GraduationCap size={22} />
              </div>
              <div>
                <h4>Practice Mode</h4>
                <span className="badge badge-success">Flexible Study</span>
              </div>
            </div>
            <p className="mode-card-desc">
              Practice freely without punitive integrity rules. You may switch tabs or check notes.
              The clock continues running authoritatively and your responses are continuously auto-saved.
            </p>
          </div>

          {/* Strict Examination Mode Card */}
          <div
            className={`mode-card ${selectedMode === 'serious' ? 'selected serious' : ''}`}
            onClick={() => setSelectedMode('serious')}
          >
            <div className="mode-card-header">
              <div className="mode-icon-circle serious-icon">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h4>Strict Examination Mode</h4>
                <span className="badge badge-warning">Simulated CBT</span>
              </div>
            </div>
            <p className="mode-card-desc">
              Simulates genuine national examination conditions. Switching browser tabs, minimizing,
              or leaving the active test window will automatically terminate and invalidate your attempt.
            </p>
          </div>
        </div>

        {/* Pre-Exam Warning & Acknowledgement */}
        <div className={`mode-warning-box ${selectedMode}`}>
          {selectedMode === 'serious' ? (
            <div>
              <div className="warning-title">
                <AlertTriangle size={18} className="text-warning" />
                <span>Strict Examination Protocols Apply</span>
              </div>
              <ul className="warning-rules-list">
                <li>• Do not switch browser tabs or open other applications.</li>
                <li>• Do not minimize or navigate away from the examination window.</li>
                <li>• Keep your session in fullscreen until final submission.</li>
                <li>• Leaving the exam window will automatically terminate and finalize your attempt.</li>
              </ul>
              <label className="acknowledgement-checkbox">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>I understand the examination rules and agree to take this test under strict proctored conditions.</span>
              </label>
            </div>
          ) : (
            <div>
              <div className="warning-title">
                <CheckCircle2 size={18} className="text-success" />
                <span>Practice Mode Selected</span>
              </div>
              <p className="practice-note">
                You can move between browser tabs or applications freely. Your timer will continue running
                and your answers remain synced.
              </p>
            </div>
          )}
        </div>
      </div>

      {exam.config.characteristics.length > 0 && (
        <div className="preview-chars">
          <h3>Question Typology & Styles</h3>
          <div className="chars-list">
            {exam.config.characteristics.map(c => (
              <span key={c} className="chip active">{c.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </div>
      )}

      {/* Question overview */}
      <div className="preview-questions-summary">
        <h3><BookOpen size={16} /> Question Overview</h3>
        <div className="q-summary-list">
          {exam.questions.slice(0, 5).map((q) => (
            <div key={q.id} className="q-summary-item card">
              <span className="q-num">Q{q.index}</span>
              <div className="q-preview-text">
                <MathText text={q.text.slice(0, 120) + (q.text.length > 120 ? '...' : '')} />
              </div>
              <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                {q.type.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
          {exam.questions.length > 5 && (
            <div className="q-summary-more font-mono">
              +{exam.questions.length - 5} additional questions compiled
            </div>
          )}
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="preview-actions">
        <button
          className={`btn btn-primary btn-lg ${selectedMode === 'serious' ? 'btn-strict' : ''}`}
          onClick={handleStartExam}
          disabled={selectedMode === 'serious' && !acknowledged}
        >
          <Play size={20} />
          <span>
            {selectedMode === 'serious'
              ? 'I Understand — Start Examination'
              : 'Start Practice Session'}
          </span>
        </button>
      </div>
    </div>
  );
}
