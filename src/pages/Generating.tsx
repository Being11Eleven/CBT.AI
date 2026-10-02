import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { storage } from '../services/storage';
import { generateExam } from '../services/ai-engine';
import type { GenerationStep } from '../types';
import './Generating.css';

export default function Generating() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [steps, setSteps] = useState<GenerationStep[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !examId) return;
    started.current = true;

    const exam = storage.getExam(examId);
    if (!exam) {
      setError('Exam not found');
      return;
    }

    const run = async () => {
      try {
        const questions = await generateExam(
          exam.config,
          exam.documents,
          (step) => setSteps(prev => {
            // Replace if same step name, otherwise add
            const idx = prev.findIndex(s => s.step === step.step && s.status !== 'complete');
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = step;
              return updated;
            }
            return [...prev, step];
          })
        );

        // Save completed exam
        storage.saveExam({
          ...exam,
          questions,
          status: 'ready',
          updatedAt: Date.now(),
        });

        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Generation failed');
      }
    };

    run();
  }, [examId]);

  const uniqueSteps = steps.reduce((acc: GenerationStep[], step) => {
    const existing = acc.findIndex(s => s.step === step.step);
    if (existing >= 0) {
      acc[existing] = step;
    } else {
      acc.push(step);
    }
    return acc;
  }, []);

  return (
    <div className="generating-page container">
      <div className="generating-content animate-fade-in">
        <div className="generating-header">
          <div className="generating-icon">
            {done ? <Sparkles size={32} /> : <Loader2 size={32} className="animate-spin" />}
          </div>
          <h1>{done ? 'Examination Ready' : 'Generating Examination'}</h1>
          <p>{done ? 'Your exam has been created and validated' : 'AI is analyzing material and creating questions...'}</p>
        </div>

        <div className="steps-list">
          {uniqueSteps.map((step, i) => (
            <div key={i} className={`gen-step ${step.status}`}>
              <div className="gen-step-icon">
                {step.status === 'complete' && <Check size={16} />}
                {step.status === 'running' && <Loader2 size={16} className="animate-spin" />}
                {step.status === 'error' && <AlertCircle size={16} />}
                {step.status === 'pending' && <div className="gen-step-dot" />}
              </div>
              <div className="gen-step-content">
                <span className="gen-step-title">{step.step}</span>
                {step.message && <span className="gen-step-msg">{step.message}</span>}
              </div>
              {step.progress !== undefined && step.status === 'running' && (
                <div className="gen-step-progress">
                  <div className="progress-bar" style={{ width: 80 }}>
                    <div className="progress-fill" style={{ width: `${step.progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="error-banner" style={{ marginTop: 'var(--sp-6)' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {done && (
          <div className="generating-actions animate-scale-in">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate(`/preview/${examId}`)}
            >
              <Sparkles size={20} /> View Exam
            </button>
          </div>
        )}

        {error && (
          <div className="generating-actions">
            <button className="btn btn-secondary" onClick={() => navigate('/create')}>
              Back to Create
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
