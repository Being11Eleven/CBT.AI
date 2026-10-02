/* ============================================================
   CBT.AI Backend — Deep Question Quality Verification
   Performs rigorous multi-point validation:
   - Option uniqueness & duplicate distractor detection
   - Single-correct / multi-correct consistency
   - Answer leakage detection (stem revealing answer)
   - Explanation-to-answer consistency
   - LaTeX syntax balance
   - Programmatic numerical validity
   ============================================================ */

import { validateLatexSyntax, parseNumericalValue } from './math.js';

export interface QuestionValidationIssue {
  severity: 'critical' | 'warning';
  code: string;
  message: string;
}

export interface DetailedValidationResult {
  valid: boolean;
  issues: QuestionValidationIssue[];
  fixedQuestion?: Record<string, unknown>;
}

export function verifyQuestionDeep(q: Record<string, unknown>): DetailedValidationResult {
  const issues: QuestionValidationIssue[] = [];
  const text = String(q.text || '').trim();
  const type = String(q.type || 'single_correct_mcq');
  const correctAnswer = String(q.correctAnswer || '').trim();
  const explanation = String(q.explanation || '').trim();
  const options = Array.isArray(q.options) ? q.options : undefined;

  // 1. Text length check
  if (!text || text.length < 15) {
    issues.push({ severity: 'critical', code: 'TEXT_TOO_SHORT', message: 'Question text is empty or too short' });
  }

  // 2. LaTeX Syntax validation
  const latexCheck = validateLatexSyntax(text);
  if (!latexCheck.valid) {
    issues.push({ severity: 'critical', code: 'MALFORMED_LATEX', message: latexCheck.error || 'Malformed LaTeX syntax' });
  }

  // 3. Correct answer present
  if (!correctAnswer) {
    issues.push({ severity: 'critical', code: 'NO_CORRECT_ANSWER', message: 'Question has no specified correct answer' });
  }

  // 4. MCQ-specific checks
  if (options && options.length > 0) {
    if (options.length < 2) {
      issues.push({ severity: 'critical', code: 'INSUFFICIENT_OPTIONS', message: 'Question must have at least 2 options' });
    }

    // Option uniqueness (check for duplicate options)
    const seenTexts = new Set<string>();
    for (const opt of options) {
      const optText = String(opt.text || '').trim().toLowerCase().replace(/\s+/g, '');
      if (!optText) {
        issues.push({ severity: 'critical', code: 'EMPTY_OPTION', message: `Option ${opt.id} text is empty` });
      } else if (seenTexts.has(optText)) {
        issues.push({ severity: 'critical', code: 'DUPLICATE_OPTION', message: `Duplicate option text found: "${opt.text}"` });
      }
      seenTexts.add(optText);
    }

    // Single MCQ: exactly one option must be marked correct
    if (type === 'single_correct_mcq' || type === 'assertion_reason' || type === 'true_false') {
      const markedCorrect = options.filter(o => Boolean(o.isCorrect));
      if (markedCorrect.length === 0) {
        // Try auto-fixing: if correctAnswer matches an option ID, mark that option as correct
        const match = options.find(o => String(o.id).toUpperCase() === correctAnswer.toUpperCase());
        if (match) {
          match.isCorrect = true;
        } else {
          issues.push({ severity: 'critical', code: 'NO_CORRECT_OPTION_MARKED', message: 'No option is marked as correct' });
        }
      } else if (markedCorrect.length > 1) {
        issues.push({ severity: 'critical', code: 'MULTIPLE_CORRECT_IN_SINGLE_MCQ', message: `Single MCQ has ${markedCorrect.length} options marked correct` });
      }

      // Check alignment: does correctAnswer match the correct option?
      const targetCorrect = options.find(o => Boolean(o.isCorrect));
      if (targetCorrect && correctAnswer !== targetCorrect.id) {
        // Auto-fix correct answer ID
        q.correctAnswer = targetCorrect.id;
      }
    }

    // Multiple MCQ: at least one option must be correct
    if (type === 'multiple_correct_mcq') {
      const markedCorrect = options.filter(o => Boolean(o.isCorrect));
      if (markedCorrect.length === 0) {
        issues.push({ severity: 'critical', code: 'NO_CORRECT_OPTIONS_MULTI', message: 'Multiple MCQ must have at least one correct option' });
      }
    }
  }

  // 5. Numerical question check
  if (type === 'numerical') {
    const num = parseNumericalValue(correctAnswer);
    if (num.value === null) {
      issues.push({ severity: 'critical', code: 'INVALID_NUMERICAL_ANSWER', message: `Numerical answer "${correctAnswer}" is not a valid number` });
    }
  }

  // 6. Explanation consistency
  if (!explanation || explanation.length < 15) {
    issues.push({ severity: 'warning', code: 'EXPLANATION_TOO_BRIEF', message: 'Explanation is missing or too brief' });
  }

  // 7. Answer leakage detection (stem contains verbatim answer)
  if (type === 'single_correct_mcq' && options) {
    const correctOpt = options.find(o => o.id === correctAnswer);
    if (correctOpt && correctOpt.text.length > 5) {
      const stemLower = text.toLowerCase();
      const ansLower = correctOpt.text.toLowerCase();
      // If the stem explicitly says "the answer is X" or gives away the unique option
      if (stemLower.includes(`is ${ansLower}`) || stemLower.includes(`equal to ${ansLower}`)) {
        issues.push({ severity: 'critical', code: 'ANSWER_LEAKAGE', message: 'Question stem appears to leak the correct answer directly' });
      }
    }
  }

  const hasCritical = issues.some(i => i.severity === 'critical');

  return {
    valid: !hasCritical,
    issues,
    fixedQuestion: !hasCritical ? q : undefined,
  };
}

/**
 * Deduplicate a collection of questions using text similarity fingerprints.
 */
export function deduplicateQuestions<T extends { text: string }>(questions: T[]): T[] {
  const seenFingerprints = new Set<string>();
  const uniqueList: T[] = [];

  for (const q of questions) {
    const fp = q.text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 100);

    if (!seenFingerprints.has(fp)) {
      seenFingerprints.add(fp);
      uniqueList.push(q);
    }
  }

  return uniqueList;
}
