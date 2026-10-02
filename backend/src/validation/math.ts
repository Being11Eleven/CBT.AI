/* ============================================================
   CBT.AI Backend — Deterministic Mathematical & Numerical Validator
   Supports:
   - Numerical equivalence with configurable tolerance
   - Scientific notation parsing (1.5e-3, 1.5 * 10^-3, 1.5×10^-3)
   - Unit normalization and stripping (e.g. "5.0 m/s", "5 m/s", "5ms^-1")
   - Fraction parsing ("3/4" -> 0.75)
   - Algebraic/symbolic expression canonicalization (removes spaces, LaTeX wrappers)
   ============================================================ */

export interface MathComparisonResult {
  isMatch: boolean;
  difference?: number;
  toleranceUsed?: number;
  normalizedStudent: string;
  normalizedCorrect: string;
  details?: string;
}

/**
 * Clean and normalize mathematical strings.
 * Removes LaTeX wrappers ($...$, $$...$$), redundant spaces, and common multiplication symbols.
 */
export function canonicalizeMathExpr(expr: string): string {
  if (!expr) return '';
  return expr
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/×/g, '*')
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase();
}

/**
 * Extract numerical value and optional unit from string.
 * Handles scientific notation: "1.6 * 10^-19 C", "1.6e-19", "3/4"
 */
export function parseNumericalValue(input: string): { value: number | null; unit?: string } {
  if (!input) return { value: null };

  const clean = input
    .replace(/\$/g, '')
    .trim()
    .replace(/[\u2212\u2013\u2014]/g, '-'); // Unicode minus to ASCII

  // Fraction format: "3/4", "-7/2"
  const fractionMatch = clean.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)(.*)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]);
    const den = parseFloat(fractionMatch[2]);
    if (den !== 0) {
      return {
        value: num / den,
        unit: fractionMatch[3]?.trim() || undefined,
      };
    }
  }

  // Scientific notation: "1.6 * 10^-19" or "1.6 x 10^4" or "1.6e-19"
  const sciMatch = clean.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:\*|x|×|\\times|\\cdot)\s*10\^?\{?([+-]?\d+)\}?(.*)$/i);
  if (sciMatch) {
    const mantissa = parseFloat(sciMatch[1]);
    const exponent = parseInt(sciMatch[2], 10);
    return {
      value: mantissa * Math.pow(10, exponent),
      unit: sciMatch[3]?.trim() || undefined,
    };
  }

  // Standard float with optional unit: "9.8 m/s^2", "-15.2", "42"
  const standardMatch = clean.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/);
  if (standardMatch) {
    const val = parseFloat(standardMatch[1]);
    return {
      value: isNaN(val) ? null : val,
      unit: standardMatch[2]?.trim() || undefined,
    };
  }

  return { value: null };
}

/**
 * Compare two numerical answers with tolerance and unit tolerance.
 */
export function compareNumericalAnswers(
  studentAnswer: string,
  correctAnswer: string,
  tolerance = 0.02
): MathComparisonResult {
  const student = parseNumericalValue(studentAnswer);
  const correct = parseNumericalValue(correctAnswer);

  if (student.value === null || correct.value === null) {
    // Non-numerical fallback to canonical string comparison
    const normStudent = canonicalizeMathExpr(studentAnswer);
    const normCorrect = canonicalizeMathExpr(correctAnswer);
    return {
      isMatch: normStudent === normCorrect,
      normalizedStudent: normStudent,
      normalizedCorrect: normCorrect,
      details: 'String canonical match',
    };
  }

  const diff = Math.abs(student.value - correct.value);
  // Check relative tolerance or absolute tolerance
  const effectiveTolerance = Math.max(tolerance, Math.abs(correct.value) * tolerance);
  const isMatch = diff <= effectiveTolerance;

  return {
    isMatch,
    difference: diff,
    toleranceUsed: effectiveTolerance,
    normalizedStudent: String(student.value),
    normalizedCorrect: String(correct.value),
    details: isMatch
      ? `Matches within tolerance ±${effectiveTolerance.toFixed(4)}`
      : `Value difference ${diff.toFixed(4)} exceeds allowed tolerance ±${effectiveTolerance.toFixed(4)}`,
  };
}

/**
 * Validates that mathematical LaTeX expressions in a question are syntactically balanced.
 */
export function validateLatexSyntax(text: string): { valid: boolean; error?: string } {
  // Check dollar sign parity
  const inlineDollars = (text.match(/(?<!\\)\$/g) || []).length;
  if (inlineDollars % 2 !== 0) {
    return { valid: false, error: 'Unbalanced $ inline math delimiters' };
  }

  // Check balanced curly braces inside math segments
  const mathSegments = text.match(/\$([^$]+)\$/g) || [];
  for (const seg of mathSegments) {
    let balance = 0;
    for (const ch of seg) {
      if (ch === '{') balance++;
      if (ch === '}') balance--;
      if (balance < 0) return { valid: false, error: 'Unbalanced closing brace } in LaTeX' };
    }
    if (balance !== 0) {
      return { valid: false, error: 'Unclosed opening brace { in LaTeX' };
    }
  }

  return { valid: true };
}
