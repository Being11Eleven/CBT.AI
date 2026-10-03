/* ============================================================
   CBT.AI Edge Worker — Deterministic Mathematical & Numerical Validator
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

export function parseNumericalValue(input: string): { value: number | null; unit?: string } {
  if (!input) return { value: null };

  const clean = input
    .replace(/\$/g, '')
    .trim()
    .replace(/[\u2212\u2013\u2014]/g, '-');

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

  const sciMatch = clean.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:\*|x|×|\\times|\\cdot)\s*10\^?\{?([+-]?\d+)\}?(.*)$/i);
  if (sciMatch) {
    const mantissa = parseFloat(sciMatch[1]);
    const exponent = parseInt(sciMatch[2], 10);
    return {
      value: mantissa * Math.pow(10, exponent),
      unit: sciMatch[3]?.trim() || undefined,
    };
  }

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

export function compareNumericalAnswers(
  studentAnswer: string,
  correctAnswer: string,
  tolerance = 0.02
): MathComparisonResult {
  const student = parseNumericalValue(studentAnswer);
  const correct = parseNumericalValue(correctAnswer);

  if (student.value === null || correct.value === null) {
    const normStudent = canonicalizeMathExpr(studentAnswer);
    const normCorrect = canonicalizeMathExpr(correctAnswer);
    const isMatch = normStudent.length > 0 && normStudent === normCorrect;

    return {
      isMatch,
      normalizedStudent: normStudent,
      normalizedCorrect: normCorrect,
      details: isMatch ? 'Exact symbolic match' : 'Non-numerical expression mismatch',
    };
  }

  const sVal = student.value;
  const cVal = correct.value;
  const absDiff = Math.abs(sVal - cVal);
  const allowedDiff = Math.max(Math.abs(cVal) * tolerance, 1e-9);
  const isMatch = absDiff <= allowedDiff;

  return {
    isMatch,
    difference: absDiff,
    toleranceUsed: tolerance,
    normalizedStudent: `${sVal}${student.unit ? ' ' + student.unit : ''}`,
    normalizedCorrect: `${cVal}${correct.unit ? ' ' + correct.unit : ''}`,
    details: isMatch
      ? `Match within ${(tolerance * 100).toFixed(1)}% tolerance (diff: ${absDiff.toPrecision(3)})`
      : `Value difference ${absDiff.toPrecision(3)} exceeds allowed ${(tolerance * 100).toFixed(1)}%`,
  };
}

export function validateLatexSyntax(expr: string): { valid: boolean; error?: string } {
  if (!expr) return { valid: true };

  let openBraces = 0;
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    const prev = i > 0 ? expr[i - 1] : '';

    if (char === '{' && prev !== '\\') openBraces++;
    if (char === '}' && prev !== '\\') openBraces--;
    if (openBraces < 0) {
      return { valid: false, error: 'Unbalanced closing brace in LaTeX expression' };
    }
  }

  if (openBraces !== 0) {
    return { valid: false, error: `Unbalanced LaTeX: ${openBraces} unclosed brace(s)` };
  }

  let singleDollarCount = 0;
  const strippedDouble = expr.replace(/\$\$/g, '');
  for (let i = 0; i < strippedDouble.length; i++) {
    if (strippedDouble[i] === '$' && (i === 0 || strippedDouble[i - 1] !== '\\')) {
      singleDollarCount++;
    }
  }

  if (singleDollarCount % 2 !== 0) {
    return { valid: false, error: 'Unbalanced math delimiters ($)' };
  }

  return { valid: true };
}
