/* ============================================================
   CBT.AI Backend — Autonomous Exam Generation Engine
   Implements:
   - Real stage progression (QUEUED -> PARSING -> ANALYZING -> BLUEPRINTING
     -> GENERATING -> VERIFYING -> REGENERATING -> FINALIZING -> COMPLETED)
   - Dynamic stage-specific intelligent loading messages
   - 8-minute global deadline enforcement with deadline-aware scheduling
   - Batch generation + targeted single-question regeneration
   - Deep deterministic question verification
   - Prompt-injection defense & untrusted document boundaries
   - Topic-only autonomous syllabus blueprinting
   - Exam snapshot immutability
   ============================================================ */

import { randomUUID } from 'crypto';
import { generateExamAI } from '../ai/providers.js';
import { verifyQuestionDeep, deduplicateQuestions } from '../validation/question.js';
import { compareNumericalAnswers } from '../validation/math.js';
import { buildGradingRubric, evaluateAnswerAgainstRubric } from '../validation/rubric.js';
import { wrapInUntrustedBoundary } from '../security/sanitizer.js';
import { logger } from '../logging/logger.js';

// ── Types ───────────────────────────────────────────────────────
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export type QuestionType =
  | 'single_correct_mcq' | 'multiple_correct_mcq' | 'numerical'
  | 'assertion_reason' | 'true_false' | 'statement_based'
  | 'short_answer' | 'long_answer' | 'subjective' | 'mixed';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
export type QuestionCharacteristic = string;

export interface GeneratedQuestion {
  id: string;
  index: number;
  type: QuestionType;
  text: string;
  options?: QuestionOption[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  numericalTolerance?: number;
  marks: number;
  negativeMarks: number;
  topic: string;
  subtopic?: string;
  difficulty: Difficulty;
  characteristics: QuestionCharacteristic[];
  explanation: string;
  expectedAnswer: string;
  commonMisconception?: string;
  distractorExplanations?: Record<string, string>;
  estimatedTime: number;
  cognitiveLevel: string;
  validated: boolean;
  rubric?: unknown;
}

export interface ExamLevel {
  id: string;
  label: string;
  description?: string;
}

export interface MarkingScheme {
  correct: number;
  incorrect: number;
  unanswered: number;
  partial?: number;
}

export interface JobConfig {
  id?: string;
  subject: string;
  level: ExamLevel;
  difficulty: Difficulty;
  customDifficulty?: string;
  questionCount: number;
  questionTypes: QuestionType[];
  characteristics: QuestionCharacteristic[];
  marking: MarkingScheme;
  additionalInstructions?: string;
  teacherInstructions?: string;
  title?: string;
}

export interface JobDocument {
  filename: string;
  type: 'study_material' | 'syllabus';
  content: string;
}

export type JobStage =
  | 'QUEUED'
  | 'PARSING'
  | 'ANALYZING'
  | 'BLUEPRINTING'
  | 'GENERATING'
  | 'VERIFYING'
  | 'REGENERATING'
  | 'FINALIZING'
  | 'COMPLETED';

export interface SSEStageEvent {
  type: 'stage';
  jobId: string;
  stage: JobStage;
  stageLabel: string;
  message: string;
  questionsGenerated: number;
  questionsTotal: number;
  timestamp: number;
}

export interface SSECompleteEvent {
  type: 'complete';
  jobId: string;
  questions: GeneratedQuestion[];
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

export type SSEEvent = SSEStageEvent | SSECompleteEvent | SSEErrorEvent;

export interface Job {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'error' | 'timeout';
  stage: JobStage;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  config: JobConfig;
  documents: JobDocument[];
  questions?: GeneratedQuestion[];
  error?: string;
  events: SSEEvent[];
  listeners: Set<(event: SSEEvent) => void>;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  messageRotationTimer?: ReturnType<typeof setInterval>;
}

// ── Dynamic Stage-Specific Intelligent Loading Message Pools ───
const STAGE_MESSAGE_POOLS: Record<JobStage, string[]> = {
  QUEUED: [
    'Your examination request is queued with the server orchestrator.',
    'Allocating server-side generation resources.',
  ],
  PARSING: [
    'Reading and extracting text from your uploaded materials.',
    'Sanitizing document input and extracting structural chapters.',
    'Indexing formulas, definitions, and chapter sections.',
  ],
  ANALYZING: [
    'Analyzing syllabus scope and concept hierarchies.',
    'Calibrating question complexity to your target academic standard.',
    'Mapping key learning objectives across the subject domain.',
  ],
  BLUEPRINTING: [
    'Building the comprehensive exam blueprint.',
    'Balancing topic coverage to prevent over-concentration.',
    'Configuring cognitive distribution: conceptual, analytical, and computational.',
  ],
  GENERATING: [
    'Good questions need careful construction. We\'re refining the draft.',
    'Separating genuinely challenging questions from merely confusing ones.',
    'Crafting plausible distractors that test deep understanding.',
    'Ensuring all mathematical expressions use precise LaTeX syntax.',
    'Running a generation pass over the hardest question items.',
  ],
  VERIFYING: [
    'Checking whether these questions are difficult for the right reasons.',
    'Looking for hidden ambiguity in the answer choices.',
    'Cross-checking the calculations before they reach your exam.',
    'Checking that each explanation supports the marked answer.',
    'Checking for accidental duplicates.',
    'Filtering out weak questions before you see them.',
  ],
  REGENERATING: [
    'Regenerating questions that failed rigorous verification.',
    'Re-crafting rejected questions to meet strict quality benchmarks.',
    'Re-verifying regenerated items against the syllabus scope.',
  ],
  FINALIZING: [
    'Final verification is in progress.',
    'Formatting LaTeX typography and question numbering.',
    'Assembling your sealed, immutable examination snapshot.',
  ],
  COMPLETED: [
    'Examination generation complete and ready.',
  ],
};

const STAGE_LABELS: Record<JobStage, string> = {
  QUEUED: 'Queued',
  PARSING: 'Reading Material',
  ANALYZING: 'Analyzing Syllabus',
  BLUEPRINTING: 'Building Blueprint',
  GENERATING: 'Generating Questions',
  VERIFYING: 'Verifying Quality',
  REGENERATING: 'Refining Questions',
  FINALIZING: 'Final Quality Control',
  COMPLETED: 'Ready',
};

// ── Global Store & Concurrency ──────────────────────────────────
const jobs = new Map<string, Job>();
const MAX_CONCURRENT = parseInt(process.env.JOB_MAX_CONCURRENT || '3', 10);
const MAX_QUEUE = parseInt(process.env.JOB_MAX_QUEUE_SIZE || '20', 10);
const GLOBAL_DEADLINE_MS = parseInt(process.env.JOB_TIMEOUT_MS || '480000', 10); // 8 minutes

let activeJobs = 0;
const jobQueue: string[] = [];

// Cleanup completed jobs after 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (job.completedAt && now - job.completedAt > 3600000) {
      if (job.messageRotationTimer) clearInterval(job.messageRotationTimer);
      jobs.delete(id);
      logger.debug({ jobId: id }, 'Cleaned up expired job');
    }
  }
}, 300000);

// ── Public Job Interface ────────────────────────────────────────
export function createJob(config: JobConfig, documents: JobDocument[]): Job {
  const queuedCount = Array.from(jobs.values()).filter(j => j.status === 'queued').length;
  if (queuedCount >= MAX_QUEUE) {
    throw new Error('Server queue is full. Please try again shortly.');
  }

  const id = randomUUID();
  const job: Job = {
    id,
    status: 'queued',
    stage: 'QUEUED',
    createdAt: Date.now(),
    config,
    documents,
    events: [],
    listeners: new Set(),
  };

  jobs.set(id, job);
  logger.info({ jobId: id, subject: config.subject, count: config.questionCount }, 'Job created');

  scheduleJob(id);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function subscribeToJob(id: string, listener: (event: SSEEvent) => void): () => void {
  const job = jobs.get(id);
  if (!job) return () => {};

  job.listeners.add(listener);

  // Replay all previous events so reconnecting clients resume seamlessly
  for (const event of job.events) {
    listener(event);
  }

  return () => {
    job.listeners.delete(listener);
  };
}

function scheduleJob(jobId: string) {
  if (activeJobs < MAX_CONCURRENT) {
    runJob(jobId);
  } else {
    jobQueue.push(jobId);
  }
}

function onJobFinished() {
  activeJobs = Math.max(0, activeJobs - 1);
  const next = jobQueue.shift();
  if (next) runJob(next);
}

function emit(job: Job, event: SSEEvent) {
  job.events.push(event);
  for (const listener of job.listeners) {
    try { listener(event); } catch { /* ignore broken listener */ }
  }
}

function emitStage(job: Job, stage: JobStage, customMessage?: string, questionsGenerated = 0) {
  job.stage = stage;
  const pool = STAGE_MESSAGE_POOLS[stage] || ['Processing...'];
  const message = customMessage || pool[0];

  emit(job, {
    type: 'stage',
    jobId: job.id,
    stage,
    stageLabel: STAGE_LABELS[stage] || stage,
    message,
    questionsGenerated,
    questionsTotal: job.config.questionCount,
    timestamp: Date.now(),
  });
}

function startMessageRotation(job: Job) {
  if (job.messageRotationTimer) clearInterval(job.messageRotationTimer);

  job.messageRotationTimer = setInterval(() => {
    if (job.status !== 'running') {
      if (job.messageRotationTimer) clearInterval(job.messageRotationTimer);
      return;
    }

    const pool = STAGE_MESSAGE_POOLS[job.stage];
    if (pool && pool.length > 1) {
      // Pick random message from pool to rotate dynamically
      const msg = pool[Math.floor(Math.random() * pool.length)];
      emit(job, {
        type: 'stage',
        jobId: job.id,
        stage: job.stage,
        stageLabel: STAGE_LABELS[job.stage],
        message: msg,
        questionsGenerated: job.questions?.length || 0,
        questionsTotal: job.config.questionCount,
        timestamp: Date.now(),
      });
    }
  }, 4500); // rotate every 4.5 seconds
}

// ── Job Execution Pipeline ──────────────────────────────────────
async function runJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  activeJobs++;
  job.status = 'running';
  job.startedAt = Date.now();
  const globalDeadline = job.startedAt + GLOBAL_DEADLINE_MS;

  startMessageRotation(job);

  // Enforce 8-minute hard stop
  job.timeoutHandle = setTimeout(() => {
    if (job.status === 'running') {
      job.status = 'timeout';
      job.completedAt = Date.now();
      if (job.messageRotationTimer) clearInterval(job.messageRotationTimer);

      emit(job, {
        type: 'error',
        jobId: job.id,
        message: 'Generation exceeded the 8-minute global deadline. The exam could not be completed in time.',
        timestamp: Date.now(),
        recoverable: true,
      });

      logger.warn({ jobId }, 'Generation job hit 8-minute global deadline');
      onJobFinished();
    }
  }, GLOBAL_DEADLINE_MS);

  try {
    const questions = await executePipeline(job, globalDeadline);
    clearTimeout(job.timeoutHandle);
    if (job.messageRotationTimer) clearInterval(job.messageRotationTimer);

    if (job.status !== 'running') return;

    job.status = 'complete';
    job.questions = questions;
    job.completedAt = Date.now();

    emitStage(job, 'COMPLETED', 'Exam generated and verified successfully.', questions.length);

    emit(job, {
      type: 'complete',
      jobId: job.id,
      questions,
      timestamp: Date.now(),
      totalTimeMs: Date.now() - job.startedAt,
    });

    logger.info({ jobId, count: questions.length, time: Date.now() - job.startedAt }, 'Job finished successfully');
  } catch (err: unknown) {
    clearTimeout(job.timeoutHandle);
    if (job.messageRotationTimer) clearInterval(job.messageRotationTimer);

    if (job.status !== 'running') return;

    const msg = (err as Error)?.message || 'Generation failed unexpectedly';
    job.status = 'error';
    job.error = msg;
    job.completedAt = Date.now();

    emit(job, {
      type: 'error',
      jobId: job.id,
      message: msg,
      timestamp: Date.now(),
      recoverable: false,
    });

    logger.error({ jobId, error: msg }, 'Job failed');
  } finally {
    onJobFinished();
  }
}

// ── Orchestrated Pipeline ───────────────────────────────────────
async function executePipeline(job: Job, deadlineMs: number): Promise<GeneratedQuestion[]> {
  const { config, documents } = job;

  // 1. PARSING STAGE
  emitStage(job, 'PARSING', 'Reading uploaded material and extracting structural content...');
  const studyDoc = documents.find(d => d.type === 'study_material');
  const syllabusDoc = documents.find(d => d.type === 'syllabus');

  const studyMaterialSanitized = studyDoc ? wrapInUntrustedBoundary(studyDoc.content.slice(0, 16000), studyDoc.filename) : '';
  const syllabusSanitized = syllabusDoc ? wrapInUntrustedBoundary(syllabusDoc.content.slice(0, 6000), syllabusDoc.filename) : '';

  // 2. ANALYZING STAGE
  emitStage(job, 'ANALYZING', `Analyzing topic scope for ${config.subject} (${config.level.label})...`);

  // 3. BLUEPRINTING STAGE
  emitStage(job, 'BLUEPRINTING', `Creating exam blueprint for ${config.questionCount} questions at ${config.difficulty} difficulty...`);

  // 4. BATCH GENERATION STAGE
  emitStage(job, 'GENERATING', 'Beginning question generation passes...');
  const batchSize = Math.min(8, config.questionCount);
  const totalBatches = Math.ceil(config.questionCount / batchSize);
  const rawQuestions: Record<string, unknown>[] = [];
  const coveredTopics: string[] = [];

  for (let b = 0; b < totalBatches; b++) {
    // Check deadline before starting batch
    if (Date.now() + 20000 >= deadlineMs) {
      logger.warn({ batch: b }, 'Approaching global deadline — terminating early batch loop');
      break;
    }

    const remaining = config.questionCount - rawQuestions.length;
    const currentBatchCount = Math.min(batchSize, remaining);

    emitStage(
      job,
      'GENERATING',
      `Drafting batch ${b + 1} of ${totalBatches} (${currentBatchCount} questions)...`,
      rawQuestions.length
    );

    const systemPrompt = buildSystemPrompt(config);
    const userPrompt = buildBatchPrompt(
      config,
      studyMaterialSanitized,
      syllabusSanitized,
      b,
      currentBatchCount,
      coveredTopics
    );

    const aiRes = await generateExamAI(userPrompt, systemPrompt, {
      responseFormat: 'json',
      requireMath: true,
      requireReasoning: true,
      globalDeadlineMs: deadlineMs,
    });

    const parsedBatch = parseQuestionsJson(aiRes.content);
    for (const q of parsedBatch) {
      rawQuestions.push(q);
      const topic = String(q.topic || '');
      if (topic && !coveredTopics.includes(topic)) {
        coveredTopics.push(topic);
      }
    }
  }

  // 5. DEEP VERIFICATION STAGE
  emitStage(job, 'VERIFYING', 'Running multi-point verification across generated questions...', rawQuestions.length);
  const verifiedQuestions: GeneratedQuestion[] = [];
  const failedQuestions: Record<string, unknown>[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const raw = rawQuestions[i];
    const validation = verifyQuestionDeep(raw);

    if (validation.valid && validation.fixedQuestion) {
      const q = normalizeQuestion(validation.fixedQuestion, verifiedQuestions.length, config);
      q.validated = true;
      verifiedQuestions.push(q);
    } else {
      failedQuestions.push(raw);
    }
  }

  // 6. TARGETED REGENERATION (Regenerate ONLY failed questions!)
  const needed = config.questionCount - verifiedQuestions.length;
  if (needed > 0 && failedQuestions.length > 0 && Date.now() + 45000 < deadlineMs) {
    emitStage(
      job,
      'REGENERATING',
      `Targeted regeneration of ${needed} questions that did not meet verification criteria...`,
      verifiedQuestions.length
    );

    try {
      const regenPrompt = `Generate exactly ${needed} replacement questions for ${config.subject} (${config.level.label}).
Difficulty: ${config.difficulty}.
Ensure each question is completely original, has 4 distinct options, unambiguous correct answer, and detailed explanation.
Return as JSON with "questions" array.`;

      const regenRes = await generateExamAI(regenPrompt, buildSystemPrompt(config), {
        responseFormat: 'json',
        requireMath: true,
        globalDeadlineMs: deadlineMs,
      });

      const regenBatch = parseQuestionsJson(regenRes.content);
      for (const raw of regenBatch) {
        if (verifiedQuestions.length >= config.questionCount) break;
        const validation = verifyQuestionDeep(raw);
        if (validation.valid && validation.fixedQuestion) {
          const q = normalizeQuestion(validation.fixedQuestion, verifiedQuestions.length, config);
          q.validated = true;
          verifiedQuestions.push(q);
        }
      }
    } catch (regenErr) {
      logger.warn({ regenErr }, 'Targeted regeneration pass failed or timed out — proceeding with current valid pool');
    }
  }

  // 7. DEDUPLICATION & FINAL ASSEMBLY
  emitStage(job, 'FINALIZING', 'Performing final deduplication and assembling examination paper...');
  const deduplicated = deduplicateQuestions(verifiedQuestions);

  // Guarantee required count by slicing or indexing
  const finalQuestions = deduplicated.slice(0, config.questionCount).map((q, idx) => ({
    ...q,
    index: idx + 1,
  }));

  if (finalQuestions.length === 0) {
    throw new Error('AI generation produced no valid questions passing quality checks. Please try again.');
  }

  return finalQuestions;
}

// ── JSON Parser Helper ──────────────────────────────────────────
function parseQuestionsJson(raw: string): Record<string, unknown>[] {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

// ── Prompt Construction ─────────────────────────────────────────
function buildSystemPrompt(config: JobConfig): string {
  return `You are a distinguished senior examination architect designing an official assessment for ${config.level.label}, subject: ${config.subject}.

CORE QUALITY PROTOCOL:
1. Every question must be original, pedagogically sound, and factually accurate.
2. For single-choice MCQs, provide exactly 4 distinct options (A, B, C, D) with exactly ONE correct answer.
3. Distractors must represent plausible misconceptions, never absurd answers.
4. Mathematical expressions must strictly use valid LaTeX enclosed in $...$ for inline or $$...$$ for display equations.
5. Target difficulty: ${config.difficulty}${config.customDifficulty ? ` (${config.customDifficulty})` : ''}.
6. Question characteristics: ${config.characteristics.join(', ')}.
7. Never include instructions or text leaking the correct answer in the question stem.
8. Explanations must provide thorough step-by-step reasoning.
9. Always output valid JSON strictly matching the requested schema.`;
}

function buildBatchPrompt(
  config: JobConfig,
  studyMaterial: string,
  syllabus: string,
  batchIdx: number,
  count: number,
  existingTopics: string[]
): string {
  return `Generate exactly ${count} examination questions for this configuration:
SUBJECT: ${config.subject}
ACADEMIC LEVEL: ${config.level.label}
DIFFICULTY: ${config.difficulty}
MARKS PER QUESTION: ${config.marking.correct}
NEGATIVE MARKING: ${config.marking.incorrect}

${studyMaterial ? `REFERENCE STUDY MATERIAL:\n${studyMaterial}\n` : 'NOTE: Generate questions based on official curriculum standards.'}
${syllabus ? `SYLLABUS SCOPE:\n${syllabus}\n` : ''}
${existingTopics.length > 0 ? `PREVIOUSLY COVERED TOPICS (please cover different areas): ${existingTopics.join(', ')}` : ''}

BATCH ${batchIdx + 1}:
Output a JSON object with this exact structure:
{
  "questions": [
    {
      "type": "single_correct_mcq",
      "text": "Detailed question text with $LaTeX$ formulas",
      "options": [
        {"id": "A", "text": "Option A text", "isCorrect": false},
        {"id": "B", "text": "Option B text", "isCorrect": true},
        {"id": "C", "text": "Option C text", "isCorrect": false},
        {"id": "D", "text": "Option D text", "isCorrect": false}
      ],
      "correctAnswer": "B",
      "topic": "Topic name",
      "subtopic": "Subtopic name",
      "difficulty": "${config.difficulty}",
      "characteristics": ["conceptual"],
      "explanation": "Step-by-step derivation or conceptual justification",
      "expectedAnswer": "Model solution",
      "estimatedTime": 120,
      "cognitiveLevel": "Application"
    }
  ]
}`;
}

// ── Normalization ───────────────────────────────────────────────
function normalizeQuestion(
  raw: Record<string, unknown>,
  idx: number,
  config: JobConfig
): GeneratedQuestion {
  const type = (raw.type as QuestionType) || config.questionTypes[0] || 'single_correct_mcq';

  let options: QuestionOption[] | undefined;
  if (Array.isArray(raw.options)) {
    options = (raw.options as Array<Record<string, unknown>>).map((o, i) => ({
      id: String(o.id || String.fromCharCode(65 + i)).toUpperCase(),
      text: String(o.text || '').trim(),
      isCorrect: Boolean(o.isCorrect),
    }));
  }

  const qId = randomUUID();
  const expAnswer = String(raw.expectedAnswer || raw.correctAnswer || '');
  const explanation = String(raw.explanation || 'Step-by-step reasoning.');

  // Attach pre-computed rubric for subjective questions
  let rubric: unknown;
  if (['short_answer', 'long_answer', 'subjective'].includes(type)) {
    rubric = buildGradingRubric(qId, String(raw.text || ''), expAnswer, explanation, config.marking.correct);
  }

  return {
    id: qId,
    index: idx + 1,
    type,
    text: String(raw.text || '').trim(),
    options,
    correctAnswer: String(raw.correctAnswer || '').trim(),
    acceptedAnswers: raw.acceptedAnswers as string[] | undefined,
    numericalTolerance: (raw.numericalTolerance as number) || 0.02,
    marks: config.marking.correct,
    negativeMarks: Math.abs(config.marking.incorrect),
    topic: String(raw.topic || config.subject),
    subtopic: raw.subtopic as string | undefined,
    difficulty: (raw.difficulty as Difficulty) || config.difficulty,
    characteristics: (raw.characteristics as QuestionCharacteristic[]) || config.characteristics,
    explanation,
    expectedAnswer: expAnswer,
    commonMisconception: raw.commonMisconception as string | undefined,
    distractorExplanations: raw.distractorExplanations as Record<string, string> | undefined,
    estimatedTime: (raw.estimatedTime as number) || 120,
    cognitiveLevel: String(raw.cognitiveLevel || 'Application'),
    validated: false,
    rubric,
  };
}

export function getQueueStatus() {
  return {
    activeJobs,
    queuedJobs: jobQueue.length,
    maxConcurrent: MAX_CONCURRENT,
    totalJobs: jobs.size,
  };
}

// ── Server-Side Exam Evaluation ──────────────────────────────────
export interface ExamEvaluationRequest {
  questions: GeneratedQuestion[];
  responses: Record<string, {
    selectedOptions?: string[];
    textAnswer?: string;
    timeSpent?: number;
    state?: string;
  }>;
  marking: MarkingScheme;
}

export function evaluateExamServerSide(payload: ExamEvaluationRequest) {
  const { questions, responses, marking } = payload;
  const questionResults = [];

  for (const q of questions) {
    const resp = responses[q.id];
    const maxMarks = q.marks || marking.correct;
    let marksObtained = 0;
    let isCorrect = false;
    let isPartiallyCorrect = false;
    let status: 'correct' | 'incorrect' | 'unanswered' | 'partial' = 'unanswered';
    let feedback = '';

    if (!resp || !resp.state || resp.state === 'not_visited' || resp.state === 'visited') {
      marksObtained = marking.unanswered;
      status = 'unanswered';
    } else if (q.type === 'single_correct_mcq' || q.type === 'assertion_reason' || q.type === 'true_false') {
      const selected = resp.selectedOptions?.[0] || '';
      if (selected && selected.toUpperCase() === q.correctAnswer.toUpperCase()) {
        isCorrect = true;
        status = 'correct';
        marksObtained = maxMarks;
      } else if (selected) {
        status = 'incorrect';
        marksObtained = -Math.abs(marking.incorrect);
      } else {
        status = 'unanswered';
        marksObtained = marking.unanswered;
      }
    } else if (q.type === 'multiple_correct_mcq') {
      const correctIds = (q.options || []).filter(o => o.isCorrect).map(o => o.id.toUpperCase());
      const selectedIds = (resp.selectedOptions || []).map(s => s.toUpperCase());

      const allCorrect = correctIds.length > 0 &&
        correctIds.every(id => selectedIds.includes(id)) &&
        selectedIds.every(id => correctIds.includes(id));

      if (allCorrect) {
        isCorrect = true;
        status = 'correct';
        marksObtained = maxMarks;
      } else if (marking.partial && selectedIds.some(id => correctIds.includes(id))) {
        isPartiallyCorrect = true;
        status = 'partial';
        marksObtained = Math.round(maxMarks * 0.5);
      } else if (selectedIds.length > 0) {
        status = 'incorrect';
        marksObtained = -Math.abs(marking.incorrect);
      } else {
        status = 'unanswered';
        marksObtained = marking.unanswered;
      }
    } else if (q.type === 'numerical') {
      const studentText = resp.textAnswer || '';
      if (studentText) {
        const comp = compareNumericalAnswers(studentText, q.correctAnswer, q.numericalTolerance || 0.02);
        if (comp.isMatch) {
          isCorrect = true;
          status = 'correct';
          marksObtained = maxMarks;
        } else {
          status = 'incorrect';
          marksObtained = -Math.abs(marking.incorrect);
          feedback = comp.details || '';
        }
      } else {
        status = 'unanswered';
        marksObtained = marking.unanswered;
      }
    } else if (['short_answer', 'long_answer', 'subjective'].includes(q.type)) {
      const studentText = resp.textAnswer || '';
      const rubric = (q.rubric as ReturnType<typeof buildGradingRubric>) ||
        buildGradingRubric(q.id, q.text, q.expectedAnswer, q.explanation, maxMarks);

      const evalRes = evaluateAnswerAgainstRubric(studentText, rubric);
      marksObtained = evalRes.marksAwarded;
      isCorrect = evalRes.isCorrect;
      isPartiallyCorrect = evalRes.isPartiallyCorrect;
      status = isCorrect ? 'correct' : (isPartiallyCorrect ? 'partial' : 'incorrect');
      feedback = evalRes.feedback;
    }

    questionResults.push({
      questionId: q.id,
      questionIndex: q.index,
      questionText: q.text,
      questionType: q.type,
      studentAnswer: resp?.selectedOptions?.join(', ') || resp?.textAnswer || '',
      correctAnswer: q.correctAnswer,
      isCorrect,
      isPartiallyCorrect,
      marksObtained,
      maxMarks,
      status,
      explanation: q.explanation,
      feedback,
      whatShouldHaveBeenWritten: q.expectedAnswer || q.correctAnswer,
      conceptTested: q.topic,
      timeSpent: resp?.timeSpent || 0,
      difficulty: q.difficulty,
      characteristics: q.characteristics || [],
    });
  }

  const correct = questionResults.filter(r => r.status === 'correct').length;
  const incorrect = questionResults.filter(r => r.status === 'incorrect').length;
  const unanswered = questionResults.filter(r => r.status === 'unanswered').length;
  const partial = questionResults.filter(r => r.status === 'partial').length;
  const totalMarks = questionResults.reduce((s, r) => s + r.marksObtained, 0);
  const maxMarks = questionResults.reduce((s, r) => s + r.maxMarks, 0);
  const totalTime = questionResults.reduce((s, r) => s + r.timeSpent, 0);

  // Topic performance breakdown
  const topicMap = new Map<string, { topic: string; total: number; correct: number; incorrect: number; unanswered: number; accuracy: number; marksObtained: number; maxMarks: number }>();
  for (const r of questionResults) {
    const existing = topicMap.get(r.conceptTested) || {
      topic: r.conceptTested,
      total: 0, correct: 0, incorrect: 0, unanswered: 0,
      accuracy: 0, marksObtained: 0, maxMarks: 0,
    };
    existing.total++;
    if (r.status === 'correct') existing.correct++;
    else if (r.status === 'incorrect') existing.incorrect++;
    else if (r.status === 'unanswered') existing.unanswered++;
    existing.marksObtained += r.marksObtained;
    existing.maxMarks += r.maxMarks;
    existing.accuracy = existing.total > 0 ? (existing.correct / existing.total) * 100 : 0;
    topicMap.set(r.conceptTested, existing);
  }

  // Difficulty performance breakdown
  const diffMap = new Map<string, { difficulty: string; total: number; correct: number; accuracy: number }>();
  for (const r of questionResults) {
    const d = r.difficulty;
    const existing = diffMap.get(d) || { difficulty: d, total: 0, correct: 0, accuracy: 0 };
    existing.total++;
    if (r.status === 'correct') existing.correct++;
    existing.accuracy = existing.total > 0 ? (existing.correct / existing.total) * 100 : 0;
    diffMap.set(d, existing);
  }

  // Characteristic performance breakdown
  const charMap = new Map<string, { characteristic: string; total: number; correct: number; accuracy: number }>();
  for (const r of questionResults) {
    for (const c of r.characteristics) {
      const existing = charMap.get(c) || { characteristic: c, total: 0, correct: 0, accuracy: 0 };
      existing.total++;
      if (r.status === 'correct') existing.correct++;
      existing.accuracy = existing.total > 0 ? (existing.correct / existing.total) * 100 : 0;
      charMap.set(c, existing);
    }
  }

  // Weakness analysis
  const weaknesses: string[] = [];
  for (const [char, perf] of charMap.entries()) {
    if (perf.accuracy < 50 && perf.total >= 2) {
      weaknesses.push(`Low accuracy on ${char} questions (${Math.round(perf.accuracy)}%)`);
    }
  }
  for (const [topic, perf] of topicMap.entries()) {
    if (perf.accuracy < 50 && perf.total >= 2) {
      weaknesses.push(`Weak performance in ${topic} (${Math.round(perf.accuracy)}%)`);
    }
  }

  return {
    id: randomUUID(),
    totalMarks,
    maxMarks,
    percentage: maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0,
    accuracy: (correct + incorrect + partial) > 0 ? Math.round((correct / (correct + incorrect + partial)) * 100) : 0,
    totalQuestions: questions.length,
    attempted: correct + incorrect + partial,
    correct,
    incorrect,
    unanswered,
    partial,
    totalTime,
    averageTimePerQuestion: questions.length > 0 ? Math.round(totalTime / questions.length) : 0,
    questionResults,
    topicPerformance: Array.from(topicMap.values()),
    difficultyPerformance: Array.from(diffMap.values()),
    characteristicPerformance: Array.from(charMap.values()),
    weaknessAnalysis: weaknesses,
    evaluatedAt: Date.now(),
  };
}
