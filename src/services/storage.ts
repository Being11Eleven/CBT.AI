/* ============================================================
   CBT.AI — Local Storage Service
   Persistent storage with IndexedDB fallback to localStorage
   ============================================================ */
import type { Exam, ExamAttempt, ExamResult } from '../types';

const STORE_PREFIX = 'cbtai_';

class StorageService {
  // ── Generic ──
  private get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage write failed:', e);
    }
  }

  private remove(key: string): void {
    localStorage.removeItem(STORE_PREFIX + key);
  }

  private getList<T>(key: string): T[] {
    return this.get<T[]>(key) || [];
  }

  // ── Exams ──
  getExams(): Exam[] {
    return this.getList<Exam>('exams');
  }

  getExam(id: string): Exam | null {
    const exams = this.getExams();
    return exams.find(e => e.id === id) || null;
  }

  saveExam(exam: Exam): void {
    const exams = this.getExams();
    const idx = exams.findIndex(e => e.id === exam.id);
    if (idx >= 0) {
      exams[idx] = exam;
    } else {
      exams.unshift(exam);
    }
    this.set('exams', exams);
  }

  deleteExam(id: string): void {
    const exams = this.getExams().filter(e => e.id !== id);
    this.set('exams', exams);
    // Also delete associated attempts and results
    this.deleteAttemptsByExam(id);
    this.deleteResultsByExam(id);
  }

  // ── Attempts ──
  getAttempts(): ExamAttempt[] {
    return this.getList<ExamAttempt>('attempts');
  }

  getAttempt(id: string): ExamAttempt | null {
    const attempts = this.getAttempts();
    return attempts.find(a => a.id === id) || null;
  }

  getAttemptByExam(examId: string): ExamAttempt | null {
    const attempts = this.getAttempts();
    return attempts.find(a => a.examId === examId && a.status === 'in_progress') || null;
  }

  saveAttempt(attempt: ExamAttempt): void {
    const attempts = this.getAttempts();
    const idx = attempts.findIndex(a => a.id === attempt.id);
    if (idx >= 0) {
      attempts[idx] = attempt;
    } else {
      attempts.unshift(attempt);
    }
    this.set('attempts', attempts);
  }

  deleteAttemptsByExam(examId: string): void {
    const attempts = this.getAttempts().filter(a => a.examId !== examId);
    this.set('attempts', attempts);
  }

  // ── Results ──
  getResults(): ExamResult[] {
    return this.getList<ExamResult>('results');
  }

  getResult(id: string): ExamResult | null {
    const results = this.getResults();
    return results.find(r => r.id === id) || null;
  }

  getResultByAttempt(attemptId: string): ExamResult | null {
    const results = this.getResults();
    return results.find(r => r.attemptId === attemptId) || null;
  }

  getResultsByExam(examId: string): ExamResult[] {
    return this.getResults().filter(r => r.examId === examId);
  }

  saveResult(result: ExamResult): void {
    const results = this.getResults();
    const idx = results.findIndex(r => r.id === result.id);
    if (idx >= 0) {
      results[idx] = result;
    } else {
      results.unshift(result);
    }
    this.set('results', results);
  }

  deleteResultsByExam(examId: string): void {
    const results = this.getResults().filter(r => r.examId !== examId);
    this.set('results', results);
  }

  // ── Settings ──
  getSettings(): Record<string, unknown> {
    return this.get<Record<string, unknown>>('settings') || {};
  }

  saveSetting(key: string, value: unknown): void {
    const settings = this.getSettings();
    settings[key] = value;
    this.set('settings', settings);
  }

  // ── AI Config ──
  getAIConfig(): { provider: string; apiKey?: string; model?: string; endpoint?: string } | null {
    return this.get('ai_config');
  }

  saveAIConfig(config: { provider: string; apiKey?: string; model?: string; endpoint?: string }): void {
    this.set('ai_config', config);
  }

  // ── Clear All ──
  clearAll(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }
}

export const storage = new StorageService();
