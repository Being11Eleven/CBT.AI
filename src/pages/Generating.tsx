/* ============================================================
   CBT.AI — Generating Page (Luxury AI Compiler Chamber)
   Autonomous Exam Generation UX:
   - Real stage checklist (no fake percentage)
   - Dynamic rotating stage-aware messages
   - Real-time SSE with reconnect & refresh resilience
   - Never exposes internal provider keys or token quotas to students
   ============================================================ */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, Loader2, AlertCircle, Sparkles, Wifi, WifiOff, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import CbtLogo from '../components/CbtLogo';
import { storage } from '../services/storage';
import {
  startGenerationJob,
  connectToJobEvents,
  getJobStatus,
  type BackendSSEEvent,
  type SSEStageEvent,
  type SSECompleteEvent,
  type SSEErrorEvent,
} from '../services/api-client';
import { pendingFiles } from './CreateExam';
import type { GeneratedQuestion } from '../types';
import './Generating.css';

// ── Standard UI Stages (Mapped to Real Backend States) ──────────
interface UIStage {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  message?: string;
}

const ORDERED_STAGES = [
  { id: 'PARSING', label: 'Extracting source text & formulas' },
  { id: 'ANALYZING', label: 'Analyzing syllabus & cognitive distribution' },
  { id: 'BLUEPRINTING', label: 'Compiling target examination blueprint' },
  { id: 'GENERATING', label: 'Synthesizing novel high-order questions' },
  { id: 'VERIFYING', label: 'Independently verifying solutions & LaTeX' },
  { id: 'REGENERATING', label: 'Refining boundary conditions & distractors' },
  { id: 'FINALIZING', label: 'Final examination calibration complete' },
];

export default function Generating() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [currentStageId, setCurrentStageId] = useState<string>('QUEUED');
  const [dynamicMessage, setDynamicMessage] = useState<string>('Establishing secure connection with examination compiler...');
  const [stages, setStages] = useState<UIStage[]>(
    ORDERED_STAGES.map(s => ({ ...s, status: 'pending' }))
  );

  const [questionsGenerated, setQuestionsGenerated] = useState(0);
  const [questionsTotal, setQuestionsTotal] = useState(0);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [connected, setConnected] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const started = useRef(false);
  const unsubscribe = useRef<(() => void) | null>(null);
  const startTime = useRef<number>(Date.now());
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Elapsed timer ──────────────────────────────────────────────
  useEffect(() => {
    timerInterval.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  // ── Update stages helper ───────────────────────────────────────
  const updateStageProgress = useCallback((activeStageId: string, customMsg?: string) => {
    setCurrentStageId(activeStageId);
    if (customMsg) setDynamicMessage(customMsg);

    setStages(prev => {
      const activeIdx = prev.findIndex(s => s.id === activeStageId);
      if (activeIdx < 0) return prev;

      return prev.map((s, idx) => {
        if (idx < activeIdx) {
          return { ...s, status: 'complete' };
        } else if (idx === activeIdx) {
          return { ...s, status: 'running', message: customMsg || s.message };
        } else {
          return { ...s, status: 'pending' };
        }
      });
    });
  }, []);

  // ── Finish exam helper ─────────────────────────────────────────
  const handleJobSuccess = useCallback((rawQuestions: unknown[], examObj: ReturnType<typeof storage.getExam>) => {
    const questions = rawQuestions as GeneratedQuestion[];
    if (examObj) {
      storage.saveExam({
        ...examObj,
        questions,
        status: 'ready',
        updatedAt: Date.now(),
      });
    }

    if (examId) {
      localStorage.removeItem(`cbtai_job_${examId}`);
      pendingFiles.delete(`${examId}_study`);
      pendingFiles.delete(`${examId}_syllabus`);
      pendingFiles.delete(`${examId}_instruction`);
    }

    setStages(prev => prev.map(s => ({ ...s, status: 'complete' })));
    setDone(true);
    setDynamicMessage('Your examination paper is compiled, verified, and certified ready.');
  }, [examId]);

  // ── Main Generation & Reconnect Flow ───────────────────────────
  useEffect(() => {
    if (started.current || !examId) return;
    started.current = true;
    startTime.current = Date.now();

    const exam = storage.getExam(examId);
    if (!exam) {
      setError('Exam configuration not found. Please create a new exam.');
      return;
    }

    setQuestionsTotal(exam.config.questionCount);

    const run = async () => {
      // 1. Check for existing active job ID in localStorage (for refresh/reconnect resilience)
      const existingJobId = localStorage.getItem(`cbtai_job_${examId}`);
      let activeJobId = existingJobId;

      if (!activeJobId) {
        setDynamicMessage('Establishing secure connection with examination compiler...');

        const studyFile = pendingFiles.get(`${examId}_study`);
        const syllabusFile = pendingFiles.get(`${examId}_syllabus`);

        const files: { study_material?: File; syllabus?: File } = {};
        if (studyFile) files.study_material = studyFile;
        if (syllabusFile) files.syllabus = syllabusFile;

        const backendConfig = {
          subject: exam.config.subject,
          level: exam.config.level,
          difficulty: exam.config.difficulty,
          customDifficulty: exam.config.customDifficulty,
          questionCount: exam.config.questionCount,
          questionTypes: exam.config.questionTypes,
          characteristics: exam.config.characteristics,
          marking: {
            ...exam.config.marking,
            partial: exam.config.marking.partial ? 1 : undefined,
          },
          additionalInstructions: exam.config.additionalInstructions,
          teacherInstructions: exam.config.teacherInstructions,
          title: exam.config.title,
        };

        const jobResponse = await startGenerationJob(backendConfig, files);
        activeJobId = jobResponse.jobId;
        localStorage.setItem(`cbtai_job_${examId}`, activeJobId);
      } else {
        setDynamicMessage('Reconnected to existing generation chamber...');
      }

      setConnected(true);

      // Connect to SSE event stream
      const unsub = connectToJobEvents(
        activeJobId,
        (rawEvent: BackendSSEEvent) => {
          if (rawEvent.type === 'stage') {
            const ev = rawEvent as SSEStageEvent;
            updateStageProgress(ev.stage, ev.message);
            if (ev.questionsGenerated !== undefined) {
              setQuestionsGenerated(ev.questionsGenerated);
            }
          } else if (rawEvent.type === 'complete') {
            const ev = rawEvent as SSECompleteEvent;
            handleJobSuccess(ev.questions, exam);
          } else if (rawEvent.type === 'error') {
            const ev = rawEvent as SSEErrorEvent;
            setError(ev.message);
            setConnected(false);
          }
        },
        () => {
          setConnected(false);
          startPolling(activeJobId!, exam);
        },
        () => setConnected(false)
      );

      unsubscribe.current = unsub;
    };

    run().catch(err => {
      const msg = err instanceof Error ? err.message : 'Failed to connect to generation engine.';
      setError(msg);
    });

    return () => {
      unsubscribe.current?.();
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [examId, handleJobSuccess, updateStageProgress]);

  // ── Polling Fallback ───────────────────────────────────────────
  const startPolling = (jobId: string, exam: ReturnType<typeof storage.getExam>) => {
    if (pollInterval.current) return;

    pollInterval.current = setInterval(async () => {
      try {
        const status = await getJobStatus(jobId);

        if (status.status === 'complete' && status.questions) {
          clearInterval(pollInterval.current!);
          handleJobSuccess(status.questions, exam);
        } else if (status.status === 'error' || status.status === 'timeout') {
          clearInterval(pollInterval.current!);
          setError(status.error || 'Generation timed out or failed on server.');
        } else if (status.stage) {
          updateStageProgress(status.stage);
          if (status.questionCount) {
            setQuestionsGenerated(status.questionCount);
          }
        }
      } catch {
        // Continue polling
      }
    }, 3500);
  };

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="generating-chamber-page container-narrow">
      <div className="chamber-visual-glow" />

      <div className="chamber-console surface-elevated animate-fade-in">
        {/* Top Status Header with Canonical Logo */}
        <div className="chamber-head">
          <div className="chamber-orb-emblem">
            <div className={`emblem-housing ${done ? 'emblem-done' : 'emblem-compiling'}`}>
              {!done && <div className="compiling-ring" />}
              <CbtLogo size={44} />
            </div>
          </div>

          <span className="eyebrow" style={{ marginBottom: '0.4rem' }}>
            {done ? 'EXAMINATION CERTIFIED' : 'AUTONOMOUS COMPILATION ACTIVE'}
          </span>

          <h1 className="chamber-title">
            {done ? 'Examination Ready' : 'Synthesizing Examination Paper'}
          </h1>

          <p className="chamber-dynamic-message font-editorial">
            "{dynamicMessage}"
          </p>

          {/* Real-time telemetry indicators */}
          {!done && !error && (
            <div className="chamber-telemetry-bar">
              <span className="telemetry-pill">
                {connected ? <Wifi size={13} className="text-cyan" /> : <WifiOff size={13} />}
                <span>{connected ? 'Real-time SSE Stream' : 'Auto-reconnecting...'}</span>
              </span>

              <span className="telemetry-pill font-mono">
                <Clock size={13} />
                <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
              </span>

              {questionsTotal > 0 && (
                <span className="telemetry-pill font-mono highlight-pill">
                  <ShieldCheck size={13} className="text-cyan" />
                  <span>{questionsGenerated} / {questionsTotal} Items Verified</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Real Stage Checklist */}
        <div className="chamber-stages-list">
          {stages.map((stage, idx) => {
            const isCompleted = stage.status === 'complete';
            const isRunning = stage.status === 'running';

            return (
              <div key={stage.id} className={`stage-row ${stage.status}`}>
                <div className="stage-num font-mono">0{idx + 1}</div>

                <div className="stage-indicator">
                  {isCompleted && <Check size={14} className="icon-complete" />}
                  {isRunning && <Loader2 size={14} className="animate-spin icon-running" />}
                  {stage.status === 'pending' && <div className="dot-pending" />}
                  {stage.status === 'error' && <AlertCircle size={14} className="icon-error" />}
                </div>

                <div className="stage-info">
                  <span className="stage-title">{stage.label}</span>
                  {isRunning && stage.message && (
                    <span className="stage-msg font-mono">{stage.message}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="error-banner animate-fade-in" style={{ marginTop: '1.75rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="chamber-actions">
          {done && (
            <button
              className="btn btn-primary btn-lg chamber-primary-action animate-scale-in"
              onClick={() => navigate(`/preview/${examId}`)}
            >
              <Sparkles size={18} />
              <span>Review & Attempt Examination</span>
              <ArrowRight size={16} />
            </button>
          )}

          {error && (
            <button
              className="btn btn-secondary chamber-secondary-action"
              onClick={() => navigate('/create')}
            >
              Return to Create Examination
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
