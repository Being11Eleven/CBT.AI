/* ============================================================
   CBT.AI — Cross-Device Cloud Storage Service (Firestore)
   Stores user-scoped exams, attempts, and results securely.
   ============================================================ */

import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  orderBy,
  type Firestore,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { storage } from './storage';
import type { Exam, ExamResult, ExamAttempt } from '../types';

/**
 * Save an exam to the user's private cloud collection
 */
export async function saveExamToCloud(userId: string, exam: Exam): Promise<void> {
  if (!isFirebaseConfigured || !db || !userId) return;

  try {
    const examRef = doc(db, 'users', userId, 'exams', exam.id);
    await setDoc(examRef, {
      ...exam,
      syncedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[CBT.AI Cloud] Failed to sync exam to cloud:', err);
  }
}

/**
 * Fetch all user exams from their private cloud collection
 */
export async function fetchUserExamsFromCloud(userId: string): Promise<Exam[]> {
  if (!isFirebaseConfigured || !db || !userId) return [];

  try {
    const examsCol = collection(db, 'users', userId, 'exams');
    const q = query(examsCol);
    const snap = await getDocs(q);

    const cloudExams: Exam[] = [];
    snap.forEach((docSnap) => {
      cloudExams.push(docSnap.data() as Exam);
    });

    return cloudExams;
  } catch (err) {
    console.warn('[CBT.AI Cloud] Failed to fetch cloud exams:', err);
    return [];
  }
}

/**
 * Delete an exam from the user's private cloud collection
 */
export async function deleteExamFromCloud(userId: string, examId: string): Promise<void> {
  if (!isFirebaseConfigured || !db || !userId) return;

  try {
    const examRef = doc(db, 'users', userId, 'exams', examId);
    await deleteDoc(examRef);
  } catch (err) {
    console.warn('[CBT.AI Cloud] Failed to delete cloud exam:', err);
  }
}

/**
 * Save an exam result to the user's private cloud collection
 */
export async function saveResultToCloud(userId: string, result: ExamResult): Promise<void> {
  if (!isFirebaseConfigured || !db || !userId) return;

  try {
    const resRef = doc(db, 'users', userId, 'results', result.id);
    await setDoc(resRef, {
      ...result,
      syncedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[CBT.AI Cloud] Failed to sync result to cloud:', err);
  }
}

/**
 * Fetch all user results from their private cloud collection
 */
export async function fetchUserResultsFromCloud(userId: string): Promise<ExamResult[]> {
  if (!isFirebaseConfigured || !db || !userId) return [];

  try {
    const resCol = collection(db, 'users', userId, 'results');
    const snap = await getDocs(resCol);

    const cloudResults: ExamResult[] = [];
    snap.forEach((docSnap) => {
      cloudResults.push(docSnap.data() as ExamResult);
    });

    return cloudResults;
  } catch (err) {
    console.warn('[CBT.AI Cloud] Failed to fetch cloud results:', err);
    return [];
  }
}

/**
 * Sync local exams and results with cloud on user login.
 * Merges local and remote items without data loss.
 */
export async function syncUserData(userId: string): Promise<{ syncedExams: number; syncedResults: number }> {
  if (!isFirebaseConfigured || !db || !userId) {
    return { syncedExams: 0, syncedResults: 0 };
  }

  try {
    const [cloudExams, cloudResults] = await Promise.all([
      fetchUserExamsFromCloud(userId),
      fetchUserResultsFromCloud(userId),
    ]);

    const localExams = storage.getExams();
    const localResults = storage.getResults();

    // 1. Upload local exams that aren't yet in the cloud
    for (const le of localExams) {
      if (!cloudExams.some((ce) => ce.id === le.id)) {
        await saveExamToCloud(userId, le);
      }
    }

    // 2. Save any remote exams to local storage
    for (const ce of cloudExams) {
      storage.saveExam(ce);
    }

    // 3. Upload local results not yet in cloud
    for (const lr of localResults) {
      if (!cloudResults.some((cr) => cr.id === lr.id)) {
        await saveResultToCloud(userId, lr);
      }
    }

    // 4. Save any remote results to local storage
    for (const cr of cloudResults) {
      storage.saveResult(cr);
    }

    return {
      syncedExams: cloudExams.length,
      syncedResults: cloudResults.length,
    };
  } catch (err) {
    console.warn('[CBT.AI Cloud] Sync error:', err);
    return { syncedExams: 0, syncedResults: 0 };
  }
}
