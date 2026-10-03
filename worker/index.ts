/**
 * CBT.AI — Edge Cloudflare Worker & API Gateway
 * Fully self-contained on Cloudflare Free Tier:
 * - /api/health: Institutional health monitoring
 * - /api/generate: Durable multi-stage AI question generation
 * - /api/generate/:id: Real-time job status polling
 * - /api/generate/:id/events: Real-time SSE stage stream
 * - /api/generate/evaluate: Deterministic server-side evaluation & rubric grading
 * - All other paths: Single Page Application static assets via env.ASSETS
 */

import { Env } from './ai/engine';
import { createAndRunJob, getJob, subscribeToJob } from './jobs/generator';
import { compareNumericalAnswers } from './validation/math';
import { evaluateAnswerAgainstRubric } from './validation/rubric';

const WORKER_START_TIME = Date.now();

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...headers,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ── Handle CORS Preflight ────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // ── Health Endpoint: GET /api/health ─────────────────────────────────────
    if (url.pathname === '/api/health') {
      const uptime = Math.floor((Date.now() - WORKER_START_TIME) / 1000);
      return jsonResponse({
        status: 'ok',
        service: 'CBT.AI Universal Platform',
        version: '2.0.0',
        uptimeSeconds: uptime,
        ai: {
          status: 'ready',
          headline: 'AI Service: Ready',
          subtext: 'Examination engine ready for real-time generation.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // ── Start Generation: POST /api/generate ─────────────────────────────────
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        let config: any = {};
        const documents: Array<{ filename: string; type: string; content: string }> = [];

        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          const configRaw = formData.get('config');
          if (configRaw && typeof configRaw === 'string') {
            config = JSON.parse(configRaw);
          }

          const studyMaterial = formData.get('study_material');
          if (studyMaterial && typeof studyMaterial === 'object' && 'text' in studyMaterial) {
            const file = studyMaterial as File;
            const content = await file.text();
            documents.push({
              filename: file.name || 'study_material.txt',
              type: 'study_material',
              content,
            });
          }

          const syllabus = formData.get('syllabus');
          if (syllabus && typeof syllabus === 'object' && 'text' in syllabus) {
            const file = syllabus as File;
            const content = await file.text();
            documents.push({
              filename: file.name || 'syllabus.txt',
              type: 'syllabus',
              content,
            });
          }
        } else {
          const body = await request.json() as any;
          config = body.config || body;
          if (Array.isArray(body.documents)) {
            documents.push(...body.documents);
          }
        }

        if (!config.subject) {
          return jsonResponse({ error: 'Subject is required' }, 400);
        }

        const job = await createAndRunJob(config, documents, env);

        return jsonResponse(
          {
            jobId: job.id,
            status: 'queued',
            stage: job.stage,
            createdAt: job.createdAt,
            eventsUrl: `/api/generate/${job.id}/events`,
            statusUrl: `/api/generate/${job.id}`,
            message: 'Examination generation job accepted and scheduled.',
          },
          201
        );
      } catch (err: any) {
        return jsonResponse({ error: err.message || 'Failed to start generation job' }, 500);
      }
    }

    // ── Poll Job Status: GET /api/generate/:jobId ────────────────────────────
    const statusMatch = url.pathname.match(/^\/api\/generate\/([a-zA-Z0-9_-]+)$/);
    if (statusMatch && request.method === 'GET') {
      const jobId = statusMatch[1];
      const job = getJob(jobId);

      if (!job) {
        return jsonResponse({ error: `Job not found: ${jobId}` }, 404);
      }

      return jsonResponse({
        jobId: job.id,
        status: job.status,
        stage: job.stage,
        stageLabel: job.stageLabel,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        questionCount: job.questionsGenerated,
        questions: job.questions,
        error: job.error,
      });
    }

    // ── SSE Event Stream: GET /api/generate/:jobId/events ────────────────────
    const sseMatch = url.pathname.match(/^\/api\/generate\/([a-zA-Z0-9_-]+)\/events$/);
    if (sseMatch && request.method === 'GET') {
      const jobId = sseMatch[1];
      const job = getJob(jobId);

      if (!job) {
        return jsonResponse({ error: `Job not found: ${jobId}` }, 404);
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Send initial keepalive comment
      writer.write(encoder.encode(': connected\n\n'));

      const unsubscribe = subscribeToJob(jobId, (event) => {
        try {
          writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          if (event.type === 'complete' || event.type === 'error') {
            setTimeout(() => {
              try { writer.close(); } catch {}
            }, 300);
          }
        } catch {
          unsubscribe();
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ── Exam Evaluation: POST /api/generate/evaluate ─────────────────────────
    if (url.pathname === '/api/generate/evaluate' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const questions: any[] = Array.isArray(body.questions) ? body.questions : [];
        const responses: Record<string, any> = body.responses || {};
        const marking = body.marking || { correct: 4, incorrect: 1, unanswered: 0 };

        let totalScore = 0;
        let maxScore = 0;
        let correctCount = 0;
        let answeredCount = 0;
        const questionResults: any[] = [];

        for (const q of questions) {
          const qId = q.id;
          const studentAns = responses[qId];
          const hasAnswer = studentAns !== undefined && studentAns !== null && String(studentAns).trim().length > 0;
          const qMarks = q.marks || marking.correct || 4;
          const qNegative = q.negativeMarks !== undefined ? q.negativeMarks : (marking.incorrect || 1);
          maxScore += qMarks;

          if (!hasAnswer) {
            questionResults.push({
              questionId: qId,
              status: 'unanswered',
              marksAwarded: 0,
              maxMarks: qMarks,
              feedback: 'Question was left unattempted.',
            });
            continue;
          }

          answeredCount++;
          let isCorrect = false;
          let marksAwarded = 0;
          let feedback = '';

          if (q.type === 'single_correct_mcq' || q.type === 'true_false' || q.type === 'assertion_reason') {
            isCorrect = String(studentAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
            marksAwarded = isCorrect ? qMarks : -qNegative;
            feedback = isCorrect
              ? 'Correct choice.'
              : `Incorrect. Expected ${q.correctAnswer}. ${q.explanation || ''}`;
          } else if (q.type === 'numerical') {
            const comp = compareNumericalAnswers(String(studentAns), String(q.correctAnswer), q.numericalTolerance || 0.02);
            isCorrect = comp.isMatch;
            marksAwarded = isCorrect ? qMarks : -qNegative;
            feedback = comp.details || (isCorrect ? 'Numerical answer matches within tolerance.' : 'Value mismatch.');
          } else {
            // Subjective / short answer rubric evaluation
            const rubric = q.rubric || {
              questionId: qId,
              idealResponse: q.expectedAnswer || q.correctAnswer || '',
              requiredConcepts: [q.topic || 'Subject understanding'],
              keyFacts: [],
              expectedReasoningSteps: [],
              partialCreditRules: [],
              commonErrors: [],
              maxMarks: qMarks,
            };

            const evalRes = evaluateAnswerAgainstRubric(rubric, String(studentAns));
            marksAwarded = evalRes.marksAwarded;
            isCorrect = evalRes.isCorrect;
            feedback = evalRes.feedback;
          }

          if (isCorrect) correctCount++;
          totalScore += marksAwarded;

          questionResults.push({
            questionId: qId,
            status: isCorrect ? 'correct' : 'incorrect',
            marksAwarded,
            maxMarks: qMarks,
            studentAnswer: studentAns,
            correctAnswer: q.correctAnswer,
            feedback,
          });
        }

        const percentage = maxScore > 0 ? Math.round((Math.max(0, totalScore) / maxScore) * 100) : 0;

        return jsonResponse({
          score: Math.max(0, totalScore),
          maxScore,
          percentage,
          answeredCount,
          correctCount,
          totalQuestions: questions.length,
          results: questionResults,
          timestamp: Date.now(),
        });
      } catch (err: any) {
        return jsonResponse({ error: err.message || 'Evaluation failed' }, 500);
      }
    }

    // ── Static Asset & Single Page App Routing ───────────────────────────────
    // Serves /, /create, /settings, /my-exams, /preview, and static assets
    return env.ASSETS.fetch(request);
  },
};
