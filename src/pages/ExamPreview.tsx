import { useParams, useNavigate, Link } from 'react-router-dom';
import { Play, ArrowLeft, Clock, Hash, BarChart3, Target, BookOpen, Edit, RefreshCw, Trash2 } from 'lucide-react';
import { storage } from '../services/storage';
import { DIFFICULTIES } from '../data/constants';
import MathText from '../components/MathText';
import './ExamPreview.css';

export default function ExamPreview() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const exam = examId ? storage.getExam(examId) : null;

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

  return (
    <div className="preview-page container animate-fade-in">
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--sp-4)' }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="preview-header">
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
            <span className="stat-num">+{exam.config.marking.correct}/{exam.config.marking.incorrect}</span>
            <span className="stat-label">Marking</span>
          </div>
        </div>
      </div>

      {exam.config.characteristics.length > 0 && (
        <div className="preview-chars">
          <h3>Question Styles</h3>
          <div className="chars-list">
            {exam.config.characteristics.map(c => (
              <span key={c} className="chip active">{c.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </div>
      )}

      {/* Question summary */}
      <div className="preview-questions-summary">
        <h3><BookOpen size={16} /> Question Overview</h3>
        <div className="q-summary-list">
          {exam.questions.slice(0, 5).map((q, i) => (
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
            <div className="q-summary-more">
              +{exam.questions.length - 5} more questions
            </div>
          )}
        </div>
      </div>

      <div className="preview-actions">
        <button
          className="btn btn-primary btn-lg"
          onClick={() => navigate(`/exam/${examId}`)}
        >
          <Play size={20} /> Start Examination
        </button>
      </div>
    </div>
  );
}
