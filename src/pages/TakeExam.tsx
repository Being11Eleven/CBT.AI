import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { Clock, ChevronLeft, ChevronRight, Flag, Send, X, AlertTriangle, Maximize, CheckCircle2, ShieldAlert, Sparkles, Shield, ArrowRight } from 'lucide-react';
import { storage } from '../services/storage';
import { evaluateExamOnBackend } from '../services/api-client';
import MathText from '../components/MathText';
import CbtLogo from '../components/CbtLogo';
import type { Exam, ExamAttempt, ExamResult, StudentResponse, QuestionState, IntegrityEvent, ExamMode } from '../types';
import './TakeExam.css';

export default function TakeExam() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showPalette, setShowPalette] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [terminatedResultId, setTerminatedResultId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initialize
  useEffect(() => {
    if (!examId) return;
    const e = storage.getExam(examId);
    if (!e || (e.status !== 'ready' && e.status !== 'active' && e.status !== 'submitted')) {
      navigate('/my-exams');
      return;
    }
    setExam(e);

    const storedMode = (sessionStorage.getItem('cbtai_exam_mode_' + examId) as ExamMode) || 'serious';

    // Check for existing attempt
    let existingAttempt = storage.getAttemptByExam(examId);
    if (!existingAttempt) {
      const now = Date.now();
      existingAttempt = {
        id: uuid(),
        examId,
        examVersion: e.version,
        mode: storedMode,
        startedAt: now,
        expiresAt: now + e.config.duration * 60 * 1000,
        responses: {},
        integrityLog: [],
        autoSubmitted: false,
        status: 'in_progress',
      };
      storage.saveAttempt(existingAttempt);
    } else if (!existingAttempt.mode) {
      existingAttempt.mode = storedMode;
      storage.saveAttempt(existingAttempt);
    }

    if (existingAttempt.status === 'terminated') {
      const existingRes = storage.getResultByAttempt(existingAttempt.id);
      if (existingRes) setTerminatedResultId(existingRes.id);
    }

    setAttempt(existingAttempt);

    // Calculate initial time authoritatively
    const remaining = Math.max(0, Math.floor((existingAttempt.expiresAt - Date.now()) / 1000));
    setTimeLeft(remaining);

    // Mark exam as active if not submitted
    if (existingAttempt.status === 'in_progress') {
      storage.saveExam({ ...e, status: 'active', updatedAt: Date.now() });
      try { document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
    }
  }, [examId, navigate]);

  // Authoritative Timer
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((attempt.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [attempt]);

  // Strict Mode Termination
  const terminateExam = useCallback(async (reason: string) => {
    if (!exam || !attempt || attempt.status === 'terminated' || isSubmitting) return;
    setIsSubmitting(true);
    clearInterval(timerRef.current);
    try { document.exitFullscreen?.(); } catch { /* ignore */ }

    const now = Date.now();
    const event: IntegrityEvent = {
      type: 'tab_hidden',
      timestamp: now,
      message: reason,
    };

    const terminatedAttempt: ExamAttempt = {
      ...attempt,
      submittedAt: now,
      status: 'terminated',
      terminatedReason: reason,
      integrityLog: [...(attempt.integrityLog || []), event],
    };

    setAttempt(terminatedAttempt);
    storage.saveAttempt(terminatedAttempt);
    storage.saveExam({ ...exam, status: 'submitted', updatedAt: now });

    // Evaluate answers recorded up to termination point
    try {
      const evalData = await evaluateExamOnBackend(
        exam.questions,
        terminatedAttempt.responses,
        {
          correct: exam.config.marking.correct,
          incorrect: exam.config.marking.incorrect,
          unanswered: exam.config.marking.unanswered,
          partial: exam.config.marking.partial ? 1 : undefined,
        }
      );
      const result: ExamResult = {
        ...evalData,
        attemptId: terminatedAttempt.id,
        examId: exam.id,
        studentName: terminatedAttempt.studentName,
      };
      storage.saveResult(result);
      setTerminatedResultId(result.id);
    } catch (err) {
      console.warn('Evaluation for terminated exam recorded locally:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [exam, attempt, isSubmitting]);

  // Visibility & Focus detection according to Exam Mode
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;

    const handleVisibility = () => {
      if (document.hidden) {
        if (attempt.mode === 'practice') {
          // Practice Mode: user is free to switch tabs, clock keeps running authoritatively
          return;
        }
        // Strict Examination Mode: tab switch immediately terminates the attempt
        terminateExam('Student navigated away from the exam tab during Strict Examination Mode.');
      } else {
        // Tab regained visibility: synchronize authoritative countdown
        const remaining = Math.max(0, Math.floor((attempt.expiresAt - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          handleAutoSubmit();
        }
      }
    };

    const handleBlur = () => {
      if (attempt.mode === 'serious' && attempt.status === 'in_progress') {
        terminateExam('Examination window lost focus during Strict Examination Mode.');
      }
    };

    const handleFullscreenExit = () => {
      if (!document.fullscreenElement && attempt.mode === 'serious') {
        setWarnings(prev => [...prev, 'Fullscreen exited. Please keep the examination window active.']);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenExit);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenExit);
    };
  }, [attempt, terminateExam]);

  // ── Response management ──
  const getResponse = useCallback((qId: string): StudentResponse => {
    if (!attempt) return { questionId: qId, state: 'not_visited', timeSpent: 0, changesCount: 0 };
    return attempt.responses[qId] || { questionId: qId, state: 'not_visited', timeSpent: 0, changesCount: 0 };
  }, [attempt]);

  const updateResponse = useCallback((qId: string, update: Partial<StudentResponse>) => {
    if (!attempt) return;

    const current = getResponse(qId);
    const updated: StudentResponse = { ...current, ...update, questionId: qId };

    // Determine state
    const hasAnswer = (updated.selectedOptions && updated.selectedOptions.length > 0) || updated.textAnswer;
    if (updated.state === 'marked' || updated.state === 'answered_marked') {
      updated.state = hasAnswer ? 'answered_marked' : 'marked';
    } else {
      updated.state = hasAnswer ? 'answered' : 'visited';
    }

    const newAttempt = {
      ...attempt,
      responses: { ...attempt.responses, [qId]: updated },
    };
    setAttempt(newAttempt);

    // Debounced save
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => storage.saveAttempt(newAttempt), 500);
  }, [attempt, getResponse]);

  const selectOption = useCallback((qId: string, optionId: string, isMultiple: boolean) => {
    const current = getResponse(qId);
    let selected = current.selectedOptions || [];

    if (isMultiple) {
      selected = selected.includes(optionId)
        ? selected.filter(id => id !== optionId)
        : [...selected, optionId];
    } else {
      selected = [optionId];
    }

    updateResponse(qId, {
      selectedOptions: selected,
      answeredAt: Date.now(),
      changesCount: (current.changesCount || 0) + 1,
    });
  }, [getResponse, updateResponse]);

  const clearResponse = useCallback((qId: string) => {
    updateResponse(qId, {
      selectedOptions: [],
      textAnswer: '',
      explanation: '',
      state: 'visited',
    });
  }, [updateResponse]);

  const toggleMark = useCallback((qId: string) => {
    const current = getResponse(qId);
    const isMarked = current.state === 'marked' || current.state === 'answered_marked';
    const hasAnswer = (current.selectedOptions?.length || 0) > 0 || !!current.textAnswer;

    if (isMarked) {
      updateResponse(qId, { state: hasAnswer ? 'answered' : 'visited' });
    } else {
      updateResponse(qId, { state: hasAnswer ? 'answered_marked' : 'marked' });
    }
  }, [getResponse, updateResponse]);

  // Mark current as visited when navigating
  useEffect(() => {
    if (!exam || !attempt) return;
    const q = exam.questions[currentIdx];
    if (q) {
      const resp = getResponse(q.id);
      if (resp.state === 'not_visited') {
        updateResponse(q.id, { state: 'visited' });
      }
    }
  }, [currentIdx, exam]);

  // ── Submission ──
  const handleAutoSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (attempt) {
      attempt.autoSubmitted = true;
      await submitExam();
    }
  };

  const submitExam = async () => {
    if (!exam || !attempt) return;
    setEvaluating(true);

    clearInterval(timerRef.current);

    const submittedAttempt: ExamAttempt = {
      ...attempt,
      submittedAt: Date.now(),
      status: 'submitted',
    };
    storage.saveAttempt(submittedAttempt);

    // Exit fullscreen
    try { document.exitFullscreen?.(); } catch { /* ignore */ }

    // Evaluate on server
    try {
      const evalData = await evaluateExamOnBackend(
        exam.questions,
        submittedAttempt.responses,
        {
          correct: exam.config.marking.correct,
          incorrect: exam.config.marking.incorrect,
          unanswered: exam.config.marking.unanswered,
          partial: exam.config.marking.partial ? 1 : undefined,
        }
      );

      const result: ExamResult = {
        ...evalData,
        attemptId: submittedAttempt.id,
        examId: exam.id,
        studentName: submittedAttempt.studentName,
      };

      storage.saveResult(result);

      // Update exam status
      storage.saveExam({ ...exam, status: 'submitted', updatedAt: Date.now() });

      // Update attempt status
      submittedAttempt.status = 'evaluated';
      storage.saveAttempt(submittedAttempt);

      navigate(`/result/${result.id}`);
    } catch (error) {
      console.error('Server evaluation failed, falling back to local result:', error);
      navigate('/my-exams');
    }
  };

  // ── Render ──
  if (!exam || !attempt) {
    return <div className="exam-loading"><div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--c-primary)', borderTop: '3px solid transparent', borderRadius: '50%' }} /></div>;
  }

  // ── Terminated Screen ──
  if (attempt.status === 'terminated') {
    const answeredCount = Object.values(attempt.responses).filter(
      r => r.state === 'answered' || r.state === 'answered_marked'
    ).length;

    return (
      <div className="exam-terminated-container animate-fade-in">
        <div className="exam-terminated-card">
          <div className="terminated-icon-badge">
            <ShieldAlert size={44} />
          </div>
          <span className="terminated-pill">Strict Proctored Examination Policy</span>
          <h1 className="terminated-title">Examination Terminated</h1>
          <p className="terminated-desc">
            Your attempt was ended because the examination window was left or lost focus during Strict Examination Mode.
          </p>

          <div className="terminated-details-grid">
            <div className="terminated-detail-item">
              <span className="detail-label">Status</span>
              <span className="detail-val error">Terminated</span>
            </div>
            <div className="terminated-detail-item">
              <span className="detail-label">Examination Mode</span>
              <span className="detail-val">Strict Examination Mode</span>
            </div>
            <div className="terminated-detail-item">
              <span className="detail-label">Questions Recorded</span>
              <span className="detail-val">{answeredCount} of {exam.questions.length}</span>
            </div>
            <div className="terminated-detail-item">
              <span className="detail-label">Triggered Policy</span>
              <span className="detail-val muted">{attempt.terminatedReason || 'Window lost focus / Tab switch'}</span>
            </div>
          </div>

          <div className="terminated-note">
            Answers completed prior to termination have been securely saved and evaluated.
          </div>

          <div className="terminated-actions">
            {terminatedResultId ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => navigate(`/result/${terminatedResultId}`)}
              >
                View Evaluated Results <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => {
                  const existingResult = storage.getResultByAttempt(attempt.id);
                  if (existingResult) {
                    navigate(`/result/${existingResult.id}`);
                  } else {
                    navigate('/my-exams');
                  }
                }}
              >
                View Results <ArrowRight size={16} />
              </button>
            )}
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => navigate('/my-exams')}
            >
              Return to My Exams
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (evaluating) {
    return (
      <div className="exam-loading">
        <div style={{ marginBottom: 'var(--sp-6)', animation: 'pulse 2s infinite' }}>
          <CbtLogo size={68} />
        </div>
        <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700 }}>Evaluating Your Answers</h2>
        <p style={{ color: 'var(--c-text-secondary)', marginTop: 'var(--sp-2)' }}>AI evaluation engine analyzing student responses against rubric...</p>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentIdx];
  const currentResponse = getResponse(currentQuestion.id);
  const isMultiCorrect = currentQuestion.type === 'multiple_correct_mcq';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const getStateColor = (state: QuestionState) => {
    switch (state) {
      case 'answered': return 'var(--c-answered)';
      case 'marked': return 'var(--c-marked)';
      case 'answered_marked': return 'var(--c-answered-marked)';
      case 'visited': return 'var(--c-visited)';
      default: return 'var(--c-not-visited)';
    }
  };

  // Exam summary for submit modal
  const answered = exam.questions.filter(q => {
    const r = getResponse(q.id);
    return r.state === 'answered' || r.state === 'answered_marked';
  }).length;
  const marked = exam.questions.filter(q => {
    const r = getResponse(q.id);
    return r.state === 'marked' || r.state === 'answered_marked';
  }).length;
  const unanswered = exam.questions.length - answered;

  return (
    <div className="exam-container">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="exam-warnings">
          {warnings.slice(-2).map((w, i) => (
            <div key={i} className="exam-warning">
              <AlertTriangle size={14} /> {w}
              <button onClick={() => setWarnings(prev => prev.filter((_, idx) => idx !== warnings.length - 2 + i))}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Top Bar */}
      <header className="exam-topbar">
        <div className="exam-topbar-left">
          <div className="exam-mode-badge-wrap">
            <CbtLogo size={22} />
            <span className="exam-title-bar">{exam.config.title}</span>
            <span className={`exam-mode-tag ${attempt.mode === 'practice' ? 'practice' : 'serious'}`}>
              {attempt.mode === 'practice' ? (
                <><Sparkles size={11} /> Practice Mode</>
              ) : (
                <><Shield size={11} /> Strict Examination</>
              )}
            </span>
          </div>
        </div>
        <div className="exam-topbar-center">
          <div className={`exam-timer ${timeLeft < 300 ? 'danger' : timeLeft < 600 ? 'warning' : ''}`}>
            <Clock size={16} />
            <span className="timer-display">{formatTime(timeLeft)}</span>
          </div>
        </div>
        <div className="exam-topbar-right">
          <button className="btn btn-ghost btn-sm" onClick={() => {
            try { document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
          }}>
            <Maximize size={14} />
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setShowSubmitModal(true)}>
            <Send size={14} /> Submit
          </button>
        </div>
      </header>

      {/* Mode Sub-banner */}
      {attempt.mode === 'practice' ? (
        <div className="practice-subtle-bar">
          <Sparkles size={13} />
          <span><strong>Practice Mode:</strong> Tab switching is permitted. Timer continues running in the background.</span>
        </div>
      ) : (
        <div className="serious-subtle-bar">
          <Shield size={13} />
          <span><strong>Strict Examination:</strong> Leaving this window or switching tabs will immediately terminate your attempt.</span>
        </div>
      )}

      <div className="exam-body">
        {/* Question Panel */}
        <div className="exam-question-panel">
          <div className="question-card">
            <div className="question-header">
              <span className="question-number">QUESTION {String(currentIdx + 1).padStart(2, '0')}</span>
              <div className="question-meta">
                <span className="badge badge-primary">{currentQuestion.type.replace(/_/g, ' ')}</span>
                <span className="badge badge-warning">+{currentQuestion.marks} / {currentQuestion.negativeMarks > 0 ? `-${currentQuestion.negativeMarks}` : '0'}</span>
              </div>
            </div>

            <div className="question-text">
              <MathText text={currentQuestion.text} />
            </div>

            {/* Options for MCQ */}
            {currentQuestion.options && (
              <div className="options-list">
                {currentQuestion.options.map(opt => {
                  const isSelected = currentResponse.selectedOptions?.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      className={`option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => selectOption(currentQuestion.id, opt.id, isMultiCorrect)}
                    >
                      <span className="option-id">{opt.id}</span>
                      <span className="option-text">
                        <MathText text={opt.text} />
                      </span>
                      {isSelected && <CheckCircle2 size={18} className="option-check" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Numerical input */}
            {currentQuestion.type === 'numerical' && (
              <div className="numerical-input">
                <label className="label">Your Answer</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter numerical value..."
                  value={currentResponse.textAnswer || ''}
                  onChange={e => updateResponse(currentQuestion.id, {
                    textAnswer: e.target.value,
                    answeredAt: Date.now(),
                    changesCount: (currentResponse.changesCount || 0) + 1,
                  })}
                  style={{ maxWidth: 300, fontSize: 'var(--fs-lg)' }}
                />
              </div>
            )}

            {/* Subjective / Short / Long answer */}
            {['short_answer', 'long_answer', 'subjective'].includes(currentQuestion.type) && (
              <div className="subjective-input">
                <label className="label">Your Answer</label>
                <textarea
                  className="textarea"
                  placeholder="Type your answer here..."
                  value={currentResponse.textAnswer || ''}
                  onChange={e => updateResponse(currentQuestion.id, {
                    textAnswer: e.target.value,
                    answeredAt: Date.now(),
                    changesCount: (currentResponse.changesCount || 0) + 1,
                  })}
                  rows={currentQuestion.type === 'long_answer' ? 10 : 5}
                />
              </div>
            )}

            {/* Optional explanation/working */}
            <details className="working-section">
              <summary className="working-toggle">
                Show working / explanation (optional)
              </summary>
              <textarea
                className="textarea"
                placeholder="Write your working, reasoning, or notes here..."
                value={currentResponse.explanation || ''}
                onChange={e => updateResponse(currentQuestion.id, { explanation: e.target.value })}
                rows={4}
                style={{ marginTop: 'var(--sp-3)' }}
              />
            </details>
          </div>

          {/* Navigation */}
          <div className="question-nav">
            <button
              className="btn btn-secondary"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <button
              className={`btn ${currentResponse.state === 'marked' || currentResponse.state === 'answered_marked' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => toggleMark(currentQuestion.id)}
            >
              <Flag size={16} /> {currentResponse.state === 'marked' || currentResponse.state === 'answered_marked' ? 'Unmark' : 'Mark for Review'}
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => clearResponse(currentQuestion.id)}
            >
              Clear
            </button>

            <button
              className="btn btn-primary"
              disabled={currentIdx === exam.questions.length - 1}
              onClick={() => setCurrentIdx(prev => Math.min(exam.questions.length - 1, prev + 1))}
            >
              Save & Next <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Question Palette */}
        <div className={`exam-palette ${showPalette ? 'open' : ''}`}>
          <div className="palette-header">
            <h3>Questions</h3>
            <button className="btn btn-ghost btn-sm palette-close" onClick={() => setShowPalette(!showPalette)}>
              {showPalette ? <X size={14} /> : <span>≡</span>}
            </button>
          </div>

          <div className="palette-legend">
            <span><span className="legend-dot" style={{ background: 'var(--c-not-visited)' }} /> Not Visited</span>
            <span><span className="legend-dot" style={{ background: 'var(--c-visited)' }} /> Visited</span>
            <span><span className="legend-dot" style={{ background: 'var(--c-answered)' }} /> Answered</span>
            <span><span className="legend-dot" style={{ background: 'var(--c-marked)' }} /> Marked</span>
            <span><span className="legend-dot" style={{ background: 'var(--c-answered-marked)' }} /> Ans + Mark</span>
          </div>

          <div className="palette-grid">
            {exam.questions.map((q, i) => {
              const resp = getResponse(q.id);
              return (
                <button
                  key={q.id}
                  className={`palette-btn ${i === currentIdx ? 'current' : ''}`}
                  style={{ background: getStateColor(resp.state) }}
                  onClick={() => setCurrentIdx(i)}
                  title={`Q${i + 1}: ${resp.state.replace(/_/g, ' ')}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile palette toggle */}
      <button className="palette-mobile-toggle" onClick={() => setShowPalette(!showPalette)}>
        {showPalette ? '✕' : `☰ ${answered}/${exam.questions.length}`}
      </button>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="modal-content animate-scale-in" onClick={e => e.stopPropagation()}>
            <h2>Submit Examination?</h2>
            <div className="submit-summary">
              <div className="summary-item correct">
                <span className="summary-num">{answered}</span>
                <span>Answered</span>
              </div>
              <div className="summary-item warning">
                <span className="summary-num">{unanswered}</span>
                <span>Unanswered</span>
              </div>
              <div className="summary-item info">
                <span className="summary-num">{marked}</span>
                <span>Marked</span>
              </div>
              <div className="summary-item">
                <span className="summary-num">{exam.questions.length}</span>
                <span>Total</span>
              </div>
            </div>

            {unanswered > 0 && (
              <p className="submit-warning">
                <AlertTriangle size={14} /> You have {unanswered} unanswered question{unanswered > 1 ? 's' : ''}.
              </p>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>
                Go Back
              </button>
              <button className="btn btn-primary" onClick={submitExam} disabled={isSubmitting}>
                <Send size={16} /> Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
