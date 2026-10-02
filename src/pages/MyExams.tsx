import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Clock, Hash, Play, Eye, Trash2, BookOpen, Sparkles, Cloud, Check } from 'lucide-react';
import { storage } from '../services/storage';
import { deleteExamFromCloud, fetchUserExamsFromCloud } from '../services/cloud-storage';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import { DIFFICULTIES } from '../data/constants';
import type { Exam } from '../types';
import './MyExams.css';

export default function MyExams() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Load local exams first
    setExams(storage.getExams());

    // If authenticated, fetch cloud exams and merge
    if (user?.uid) {
      setIsSyncing(true);
      fetchUserExamsFromCloud(user.uid)
        .then((cloudExams) => {
          if (cloudExams && cloudExams.length > 0) {
            cloudExams.forEach(ce => storage.saveExam(ce));
            setExams(storage.getExams());
          }
        })
        .finally(() => setIsSyncing(false));
    }
  }, [user]);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this exam and all its data?')) {
      storage.deleteExam(id);
      if (user?.uid) {
        await deleteExamFromCloud(user.uid, id);
      }
      setExams(storage.getExams());
    }
  };

  const getStatusColor = (status: Exam['status']) => {
    switch (status) {
      case 'ready': return 'badge-success';
      case 'generating': return 'badge-warning';
      case 'active': return 'badge-info';
      case 'submitted': return 'badge-primary';
      case 'evaluated': return 'badge-success';
      default: return 'badge-info';
    }
  };

  const getExamAction = (exam: Exam) => {
    switch (exam.status) {
      case 'ready':
        return (
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/preview/${exam.id}`)}>
            <Play size={14} /> Start
          </button>
        );
      case 'generating':
        return (
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/generating/${exam.id}`)}>
            <Clock size={14} /> View Progress
          </button>
        );
      case 'submitted':
      case 'evaluated': {
        const results = storage.getResultsByExam(exam.id);
        const latestResult = results[0];
        return latestResult ? (
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/result/${latestResult.id}`)}>
            <Eye size={14} /> View Result
          </button>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/preview/${exam.id}`)}>
            <Eye size={14} /> Preview
          </button>
        );
      }
      default:
        return (
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/preview/${exam.id}`)}>
            <Eye size={14} /> Preview
          </button>
        );
    }
  };

  return (
    <div className="myexams-page container animate-fade-in">
      {/* Account Awareness Banner */}
      {!user ? (
        <div className="myexams-auth-banner">
          <div className="auth-banner-content">
            <div className="auth-banner-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="auth-banner-title">Cross-Device History</div>
              <p className="auth-banner-text">Save your examinations across devices with Google.</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAuthModal(true)}>
            Sign in with Google
          </button>
        </div>
      ) : (
        <div className="myexams-sync-status">
          <Cloud size={14} className={isSyncing ? 'animate-pulse' : ''} />
          <span>Cloud sync active for <strong>{user.email || user.displayName}</strong></span>
          <span className="sync-check"><Check size={12} /></span>
        </div>
      )}

      <div className="myexams-header">
        <div>
          <h1>My Examinations</h1>
          <p>View, manage, and take your generated exams</p>
        </div>
        <Link to="/create" className="btn btn-primary">
          <Plus size={16} /> Create New
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={48} />
          <h3>Your examination library is empty</h3>
          <p>Create your first examination to begin.</p>
          <Link to="/create" className="btn btn-primary btn-lg">
            <Plus size={18} /> Create Examination
          </Link>
        </div>
      ) : (
        <div className="exams-grid">
          {exams.map(exam => {
            const diffLabel = DIFFICULTIES.find(d => d.value === exam.config.difficulty)?.label || exam.config.difficulty;
            return (
              <div key={exam.id} className="exam-card card">
                <div className="exam-card-header">
                  <h3>{exam.config.title}</h3>
                  <span className={`badge ${getStatusColor(exam.status)}`}>{exam.status}</span>
                </div>

                <div className="exam-card-meta">
                  <span><Hash size={12} /> {exam.questions.length} questions</span>
                  <span><Clock size={12} /> {exam.config.duration} min</span>
                  <span>{diffLabel}</span>
                </div>

                <div className="exam-card-info">
                  <span className="badge badge-primary">{exam.config.level.label}</span>
                  <span className="badge badge-info">{exam.config.subject}</span>
                </div>

                <div className="exam-card-date">
                  {new Date(exam.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </div>

                <div className="exam-card-actions">
                  {getExamAction(exam)}
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(exam.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
