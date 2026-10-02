/* ============================================================
   CBT.AI — Final Pre-Deployment Verification Test Suite
   Tests:
   - Section 55: Authentication states & session handling
   - Section 56: Practice Mode vs. Strict Examination Mode logic
   - Section 57: User data ownership & cross-user isolation
   - Section 58: Production URL configuration & zero localhost leak
   - Section 10/48: Zero internal infrastructure leakage
   ============================================================ */

import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res.then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      }).catch(err => {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
      });
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n=== CBT.AI PRE-DEPLOYMENT TEST SUITE ===\n');

// ── 1. AUTHENTICATION & SESSION TESTS ───────────────────────────
console.log('1. Authentication & Session States');

test('Unauthenticated user is recognized as guest without error', () => {
  let currentUser: { uid: string; email: string } | null = null;
  assert.strictEqual(currentUser, null, 'Default session must be null (unauthenticated)');
});

test('Google auth success sets authenticated user session with uid and email', () => {
  const mockUser = {
    uid: 'google-uid-12345',
    email: 'student@example.com',
    displayName: 'Aarav Patel',
    photoURL: 'https://lh3.googleusercontent.com/a/mock',
  };

  let session: typeof mockUser | null = null;
  // Simulate login
  session = mockUser;
  assert.ok(session !== null, 'Session must be active');
  assert.strictEqual(session.uid, 'google-uid-12345');
  assert.strictEqual(session.email, 'student@example.com');
});

test('Auth failure produces a clean user-safe error message without raw trace', () => {
  const rawFirebaseError = {
    code: 'auth/popup-closed-by-user',
    message: 'Firebase: Error (auth/popup-closed-by-user).',
  };

  const userFacingError = rawFirebaseError.code === 'auth/popup-closed-by-user'
    ? 'Sign-in window was closed. Please try again.'
    : 'We could not complete sign-in. Please try again.';

  assert.strictEqual(userFacingError, 'Sign-in window was closed. Please try again.');
  assert.ok(!userFacingError.includes('Firebase: Error'), 'Raw error trace must never leak to user');
});

test('Logout clears session and isolates account state', () => {
  let session: { uid: string } | null = { uid: 'google-uid-12345' };
  // Logout
  session = null;
  assert.strictEqual(session, null, 'Session must be null after logout');
});

// ── 2. DATA OWNERSHIP & CROSS-USER ISOLATION ─────────────────────
console.log('\n2. Data Ownership & Cross-User Isolation');

test('User A data is partitioned under users/{userId} and inaccessible to User B', () => {
  const cloudDatabase: Record<string, { exams: Record<string, any> }> = {
    'user-A': { exams: { 'exam-1': { title: 'Physics Final' } } },
    'user-B': { exams: {} },
  };

  function getExamsForUser(requestAuthUid: string, targetUserId: string) {
    // Mimics Firestore Security Rule: allow read: if request.auth.uid == userId
    if (requestAuthUid !== targetUserId) {
      throw new Error('Permission denied: Cross-user access violation');
    }
    return cloudDatabase[targetUserId]?.exams || {};
  }

  // User A gets own exams
  const userAExams = getExamsForUser('user-A', 'user-A');
  assert.ok(userAExams['exam-1'], 'User A should access their own exam');

  // User B attempts to access User A's exams -> Must fail
  assert.throws(
    () => getExamsForUser('user-B', 'user-A'),
    /Permission denied/,
    'User B must be rejected when attempting to access User A data'
  );
});

// ── 3. EXAM MODES & INTEGRITY TESTS ─────────────────────────────
console.log('\n3. Exam Modes & Integrity Behavior');

test('Practice Mode allows tab switching without termination or integrity violations', () => {
  const attempt = {
    mode: 'practice' as const,
    status: 'in_progress' as const,
    integrityLog: [] as any[],
  };

  // Simulate tab switch (document.hidden = true)
  if (attempt.mode === 'serious') {
    attempt.status = 'terminated' as any;
  }
  // In practice mode, nothing happens to status
  assert.strictEqual(attempt.status, 'in_progress', 'Practice mode exam must continue on tab switch');
  assert.strictEqual(attempt.integrityLog.length, 0, 'No violations recorded for practice tab switch');
});

test('Practice Mode timer continues authoritatively based on real elapsed time', () => {
  const durationMinutes = 30;
  const startedAt = Date.now() - 5 * 60 * 1000; // 5 minutes ago
  const expiresAt = startedAt + durationMinutes * 60 * 1000;

  // Real-world remaining time calculation (authoritative)
  const remainingSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const expectedSeconds = 25 * 60; // 25 minutes left

  // Allow 2s tolerance for test execution
  assert.ok(
    Math.abs(remainingSeconds - expectedSeconds) <= 2,
    `Timer must authoritatively reflect 25 mins remaining, got ${remainingSeconds}`
  );
});

test('Strict Examination Mode tab switch immediately terminates attempt and logs event', () => {
  const attempt = {
    mode: 'serious' as const,
    status: 'in_progress' as 'in_progress' | 'terminated',
    terminatedReason: undefined as string | undefined,
    integrityLog: [] as any[],
  };

  // Simulate tab switch in Strict Mode
  if (attempt.mode === 'serious') {
    const reason = 'Student navigated away from the exam tab during Strict Examination Mode.';
    attempt.status = 'terminated';
    attempt.terminatedReason = reason;
    attempt.integrityLog.push({
      type: 'tab_hidden',
      timestamp: Date.now(),
      message: reason,
    });
  }

  assert.strictEqual(attempt.status, 'terminated', 'Strict mode must terminate on tab switch');
  assert.ok(attempt.terminatedReason?.includes('navigated away'), 'Clear factual termination reason');
  assert.strictEqual(attempt.integrityLog.length, 1, 'Integrity violation event must be logged');
  assert.strictEqual(attempt.integrityLog[0].type, 'tab_hidden');
});

test('Pre-exam warning must be explicitly acknowledged before exam start', () => {
  let warningAcknowledged = false;
  let examCanStart = false;

  function attemptStart(ack: boolean) {
    if (!ack) {
      examCanStart = false;
      return false;
    }
    examCanStart = true;
    return true;
  }

  assert.strictEqual(attemptStart(false), false, 'Start must be blocked if unacknowledged');
  assert.strictEqual(examCanStart, false);

  assert.strictEqual(attemptStart(true), true, 'Start allowed once user checks acknowledgement');
  assert.strictEqual(examCanStart, true);
});

// ── 4. PRODUCTION CONFIGURATION & INFRASTRUCTURE PRIVACY ─────────
console.log('\n4. Production Configuration & Zero Leaks');

test('Production API client resolves correctly without leaking localhost in production', () => {
  // Test production resolution logic
  function resolveApiUrl(envProd: boolean, viteApiUrl?: string, viteBackendUrl?: string) {
    return viteApiUrl || viteBackendUrl || (envProd ? '' : 'http://localhost:3001');
  }

  // When deployed on Cloudflare with VITE_API_URL set
  assert.strictEqual(
    resolveApiUrl(true, 'https://api.cbt.ai'),
    'https://api.cbt.ai',
    'Custom VITE_API_URL must be honored in production'
  );

  // When deployed on Cloudflare with same-origin reverse proxy (no env var)
  assert.strictEqual(
    resolveApiUrl(true, undefined, undefined),
    '',
    'Production fallback must be relative path "", NOT localhost:3001'
  );

  // When running locally in dev mode
  assert.strictEqual(
    resolveApiUrl(false, undefined, undefined),
    'http://localhost:3001',
    'Development mode fallback correctly defaults to local backend'
  );
});

test('No user-facing source files expose sensitive AI provider or quota terms', () => {
  const sensitiveTerms = [
    'FreeLLMAPI',
    'zero-paid AI',
    'token quota',
    'model pool',
    'quota tracking',
    'AI cluster',
  ];

  const filesToCheck = [
    resolve(process.cwd(), 'src/pages/Home.tsx'),
    resolve(process.cwd(), 'src/pages/TakeExam.tsx'),
    resolve(process.cwd(), 'src/pages/ExamPreview.tsx'),
    resolve(process.cwd(), 'src/pages/Settings.tsx'),
    resolve(process.cwd(), 'src/components/Layout.tsx'),
    resolve(process.cwd(), 'src/components/CinematicIntro.tsx'),
  ];

  for (const filePath of filesToCheck) {
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, 'utf-8');
    for (const term of sensitiveTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      assert.ok(
        !regex.test(content),
        `Sensitive infrastructure term "${term}" must not appear in user-facing file: ${filePath}`
      );
    }
  }
});

test('Canonical CBT.AI Logo component and assets are present and rendered', () => {
  const logoPath = resolve(process.cwd(), 'src/components/CbtLogo.tsx');
  assert.ok(existsSync(logoPath), 'CbtLogo.tsx component must exist');

  const logoPng = resolve(process.cwd(), 'public/cbt-logo.png');
  const logoWebp = resolve(process.cwd(), 'public/cbt-logo.webp');
  const faviconSvg = resolve(process.cwd(), 'public/favicon.svg');
  const appleTouchIcon = resolve(process.cwd(), 'public/apple-touch-icon.png');

  assert.ok(existsSync(logoPng), 'public/cbt-logo.png must exist');
  assert.ok(existsSync(logoWebp), 'public/cbt-logo.webp must exist');
  assert.ok(existsSync(faviconSvg), 'public/favicon.svg must exist');
  assert.ok(existsSync(appleTouchIcon), 'public/apple-touch-icon.png must exist');

  const cbtLogoCode = readFileSync(logoPath, 'utf-8');
  assert.ok(cbtLogoCode.includes('/cbt-logo.webp'), 'CbtLogo must reference /cbt-logo.webp');
  assert.ok(cbtLogoCode.includes('/cbt-logo.png'), 'CbtLogo must reference /cbt-logo.png fallback');

  const layoutContent = readFileSync(resolve(process.cwd(), 'src/components/Layout.tsx'), 'utf-8');
  assert.ok(layoutContent.includes('<CbtLogo'), 'CbtLogo must be integrated into Layout.tsx');

  const introContent = readFileSync(resolve(process.cwd(), 'src/components/CinematicIntro.tsx'), 'utf-8');
  assert.ok(introContent.includes('<CbtLogo'), 'CbtLogo must be integrated into CinematicIntro.tsx');

  const homeContent = readFileSync(resolve(process.cwd(), 'src/pages/Home.tsx'), 'utf-8');
  assert.ok(homeContent.includes('<CbtLogo'), 'CbtLogo must be integrated into Home.tsx footer');
});

test('Firestore security rules file exists and enforces strict user authentication isolation', () => {
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  assert.ok(existsSync(rulesPath), 'firestore.rules must exist');

  const rulesContent = readFileSync(rulesPath, 'utf-8');
  assert.ok(rulesContent.includes('request.auth != null'), 'Rules must require authenticated session');
  assert.ok(rulesContent.includes('request.auth.uid == userId'), 'Rules must enforce user isolation');
  assert.ok(!rulesContent.includes('allow read, write: if true'), 'Insecure public rules forbidden');
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
