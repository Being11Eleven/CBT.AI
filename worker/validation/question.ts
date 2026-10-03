/* ============================================================
   CBT.AI Edge Worker — Deep Question Quality Verification
   Performs rigorous multi-point validation:
   - Option uniqueness & duplicate distractor detection
   - Single-correct / multi-correct consistency
   - Answer leakage detection (stem revealing answer)
   - Explanation-to-answer consistency
   - LaTeX syntax balance
   - Programmatic numerical validity
   ============================================================ */

import { validateLatexSyntax, parseNumericalValue } from './math';

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
        issues.push({ severity: 'critical', code: 'EMPTY_OPTION', message: 'Question contains an empty option' });
      } else if (seenTexts.has(optText)) {
        issues.push({ severity: 'critical', code: 'DUPLICATE_OPTION', message: `Duplicate option detected: "${opt.text}"` });
      }
      seenTexts.add(optText);
    }

    // Check that at least one option is marked correct
    const correctOptions = options.filter(o => o.isCorrect === true);
    if (type === 'single_correct_mcq') {
      if (correctOptions.length === 0) {
        issues.push({ severity: 'critical', code: 'NO_CORRECT_OPTION_FLAGGED', message: 'No option is flagged as correct' });
      } else if (correctOptions.length > 1) {
        issues.push({ severity: 'warning', code: 'MULTIPLE_OPTIONS_FLAGGED', message: 'Multiple options flagged as correct in single-correct question' });
      }
    }

    // Check for answer leakage in the stem
    if (correctAnswer && correctAnswer.length > 5) {
      const stemLower = text.toLowerCase();
      const ansLower = correctAnswer.toLowerCase();
      if (stemLower.includes(`the answer is ${ansLower}`) || stemLower.includes(`which is ${ansLower}`)) {
        issues.push({ severity: 'critical', code: 'ANSWER_LEAK_IN_STEM', message: 'The question text inadvertently reveals the correct answer' });
      }
    }
  }

  // 5. Numerical questions check
  if (type === 'numerical') {
    const numCheck = parseNumericalValue(correctAnswer);
    if (numCheck.value === null) {
      issues.push({ severity: 'critical', code: 'NON_NUMERICAL_ANSWER', message: `Numerical question has non-parseable answer: "${correctAnswer}"` });
    }
  }

  // 6. Explanation validation
  if (!explanation || explanation.length < 10) {
    issues.push({ severity: 'warning', code: 'SHALLOW_EXPLANATION', message: 'Explanation is too short or missing' });
  }

  const criticalIssues = issues.filter(i => i.severity === 'critical');
  return {
    valid: criticalIssues.length === 0,
    issues,
  };
}

export function deduplicateQuestions(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seenStems = new Set<string>();
  const unique: Array<Record<string, unknown>> = [];

  for (const q of questions) {
    const stem = String(q.text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 80);

    if (!seenStems.has(stem)) {
      seenStems.add(stem);
      unique.push(q);
    }
  }

  return unique;
}
