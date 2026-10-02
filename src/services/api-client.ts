/* ============================================================
   CBT.AI Frontend — Backend API Client
   Replaces direct AI provider calls with secure backend calls.
   All AI logic, provider keys, and models are SERVER-SIDE ONLY.
   ============================================================ */

const BACKEND_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3001');

function sanitizeErrorMessage(msg?: string): string {
  if (!msg) return 'AI generation is temporarily unavailable. Please try again shortly.';
  const lower = msg.toLowerCase();
  if (
    lower.includes('quota') ||
    lower.includes('freellmapi') ||
    lower.includes('gemini') ||
    lower.includes('groq') ||
    lower.includes('openrouter') ||
    lower.includes('provider') ||
    lower.includes('model pool') ||
    lower.includes('rate limit') ||
    lower.includes('token') ||
    lower.includes('cluster')
  ) {
    return 'AI generation is temporarily unavailable. Please try again shortly.';
  }
  return msg;
}

// ── Types shared with backend ───────────────────────────────────
export interface GenerationJobConfig {
  id?: string;
  subject: string;
  level: { id: string; label: string; description?: string };
  difficulty: string;
  customDifficulty?: string;
  questionCount: number;
  questionTypes: string[];
  characteristics: string[];
  marking: { correct: number; incorrect: number; unanswered: number; partial?: number };
  additionalInstructions?: string;
  teacherInstructions?: string;
  title?: string;
}

export interface GenerationJobResponse {
  jobId: string;
  status: string;
  stage?: string;
  createdAt: number;
  eventsUrl: string;
  statusUrl: string;
  message: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: 'queued' | 'running' | 'complete' | 'error' | 'timeout';
  stage?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  questionCount?: number;
  error?: string;
  questions?: unknown[];
  recentEvents?: unknown[];
}

export interface SSEStageEvent {
  type: 'stage';
  jobId: string;
  stage: string;
  stageLabel: string;
  message: string;
  questionsGenerated: number;
  questionsTotal: number;
  timestamp: number;
}

export interface SSECompleteEvent {
  type: 'complete';
  jobId: string;
  questions: unknown[];
  timestamp: number;
  totalTimeMs: number;
}

export interface SSEErrorEvent {
  type: 'error';
  jobId: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
}

export type BackendSSEEvent = SSEStageEvent | SSECompleteEvent | SSEErrorEvent;

// ── Start a generation job ──────────────────────────────────────
export async function startGenerationJob(
  config: GenerationJobConfig,
  files?: {
    study_material?: File;
    syllabus?: File;
  }
): Promise<GenerationJobResponse> {
  const formData = new FormData();
  formData.append('config', JSON.stringify(config));

  if (files?.study_material) {
    formData.append('study_material', files.study_material);
  }
  if (files?.syllabus) {
    formData.append('syllabus', files.syllabus);
  }

  const response = await fetch(`${BACKEND_URL}/api/generate`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    const rawError = (err as { error?: string }).error || `Generation request failed: ${response.status}`;
    throw new Error(sanitizeErrorMessage(rawError));
  }

  return response.json();
}

// ── Poll job status ─────────────────────────────────────────────
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${BACKEND_URL}/api/generate/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.status}`);
  }
  return response.json();
}

// ── Connect to SSE stream ───────────────────────────────────────
export function connectToJobEvents(
  jobId: string,
  onEvent: (event: BackendSSEEvent) => void,
  onError: (error: Error) => void,
  onClose?: () => void
): () => void {
  const url = `${BACKEND_URL}/api/generate/${jobId}/events`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    if (!e.data || e.data.trim().startsWith(':')) return;
    try {
      const parsed = JSON.parse(e.data) as BackendSSEEvent;
      onEvent(parsed);

      if (parsed.type === 'complete' || parsed.type === 'error') {
        setTimeout(() => es.close(), 500);
        onClose?.();
      }
    } catch {
      // Ignore non-JSON comments
    }
  };

  es.onerror = () => {
    onError(new Error('Connection to generation stream interrupted. Resuming via status sync.'));
    es.close();
    onClose?.();
  };

  return () => es.close();
}

// ── Server-Side Exam Evaluation ──────────────────────────────────
export async function evaluateExamOnBackend(
  questions: unknown[],
  responses: Record<string, unknown>,
  marking: { correct: number; incorrect: number; unanswered: number; partial?: number }
) {
  const response = await fetch(`${BACKEND_URL}/api/generate/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions,
      responses,
      marking,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `Evaluation request failed: ${response.status}` }));
    const rawError = (err as { error?: string }).error || 'Evaluation failed on server';
    throw new Error(sanitizeErrorMessage(rawError));
  }

  return response.json();
}

// ── Public Clean Health Check ────────────────────────────────────
export interface PublicHealthResponse {
  ok: boolean;
  uptimeSeconds?: number;
  ai?: {
    status: 'ready' | 'degraded' | 'unavailable';
    headline: string;
    subtext: string;
  };
}

export async function checkBackendHealth(): Promise<PublicHealthResponse> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    if (!res.ok) return { ok: false };

    const data = await res.json();
    return {
      ok: true,
      uptimeSeconds: data.uptimeSeconds,
      ai: data.ai,
    };
  } catch {
    return { ok: false };
  }
}
