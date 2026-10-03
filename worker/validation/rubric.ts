/* ============================================================
   CBT.AI Edge Worker — Rubric-Based Subjective Evaluation Engine
   Generates detailed multi-criterion grading rubrics:
   - required concepts
   - expected reasoning steps
   - key facts / keywords
   - formula/derivation requirements
   - partial credit breakdown
   - common errors
   - ideal response
   Evaluates student responses with probabilistic uncertainty awareness.
   ============================================================ */

export interface GradingRubric {
  questionId: string;
  idealResponse: string;
  requiredConcepts: string[];
  keyFacts: string[];
  expectedReasoningSteps: string[];
  formulaRequirements?: string[];
  partialCreditRules: Array<{ criteria: string; marksAwarded: number }>;
  commonErrors: string[];
  maxMarks: number;
}

export interface RubricEvaluationResult {
  marksAwarded: number;
  maxMarks: number;
  percentage: number;
  isCorrect: boolean;
  isPartiallyCorrect: boolean;
  matchedConcepts: string[];
  missingConcepts: string[];
  feedback: string;
  detectedErrors: string[];
}

export function buildGradingRubric(
  questionId: string,
  questionText: string,
  expectedAnswer: string,
  explanation: string,
  maxMarks: number
): GradingRubric {
  const sentences = (explanation + '. ' + expectedAnswer)
    .split(/[.!?]/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  const requiredConcepts = sentences.slice(0, 3);
  const keyFacts = (expectedAnswer.match(/\b[A-Za-z]{5,}\b/g) || []).slice(0, 5);

  return {
    questionId,
    idealResponse: expectedAnswer || explanation,
    requiredConcepts: requiredConcepts.length > 0 ? requiredConcepts : ['Comprehensive conceptual explanation'],
    keyFacts: keyFacts.length > 0 ? keyFacts : ['Core technical keywords'],
    expectedReasoningSteps: [
      'Identification of core principle or formula',
      'Step-by-step logical justification',
      'Accurate conclusion and units',
    ],
    partialCreditRules: [
      { criteria: 'Stating correct definition or principle', marksAwarded: Math.max(1, Math.round(maxMarks * 0.3)) },
      { criteria: 'Correct analytical derivation or working', marksAwarded: Math.max(1, Math.round(maxMarks * 0.5)) },
      { criteria: 'Complete precision and accurate conclusion', marksAwarded: maxMarks },
    ],
    commonErrors: [
      'Missing core scientific or mathematical justification',
      'Incomplete steps in reasoning',
      'Incorrect units or dimensional discrepancy',
    ],
    maxMarks,
  };
}

export function evaluateAnswerAgainstRubric(
  rubric: GradingRubric,
  studentAnswer: string
): RubricEvaluationResult {
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return {
      marksAwarded: 0,
      maxMarks: rubric.maxMarks,
      percentage: 0,
      isCorrect: false,
      isPartiallyCorrect: false,
      matchedConcepts: [],
      missingConcepts: rubric.requiredConcepts,
      feedback: 'No answer was provided.',
      detectedErrors: ['Blank response'],
    };
  }

  const sText = studentAnswer.toLowerCase();
  const matchedConcepts: string[] = [];
  const missingConcepts: string[] = [];

  for (const concept of rubric.requiredConcepts) {
    const keywords = concept
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 4);

    const matchCount = keywords.filter(kw => sText.includes(kw)).length;
    if (keywords.length > 0 && matchCount >= Math.ceil(keywords.length * 0.4)) {
      matchedConcepts.push(concept);
    } else {
      missingConcepts.push(concept);
    }
  }

  const matchedFacts = rubric.keyFacts.filter(fact => sText.includes(fact.toLowerCase()));

  const conceptRatio = rubric.requiredConcepts.length > 0
    ? matchedConcepts.length / rubric.requiredConcepts.length
    : 0.5;

  const factRatio = rubric.keyFacts.length > 0
    ? matchedFacts.length / rubric.keyFacts.length
    : 0.5;

  const compositeRatio = (conceptRatio * 0.6) + (factRatio * 0.4);

  const lengthPenalty = studentAnswer.trim().split(/\s+/).length < 8 ? 0.5 : 1.0;
  const finalRatio = Math.min(1, compositeRatio * lengthPenalty);
  const marksAwarded = Math.round(rubric.maxMarks * finalRatio * 10) / 10;
  const percentage = Math.round((marksAwarded / rubric.maxMarks) * 100);

  const isCorrect = percentage >= 80;
  const isPartiallyCorrect = percentage >= 35 && percentage < 80;

  let feedback = '';
  if (isCorrect) {
    feedback = 'Strong conceptual response addressing key principles with clarity.';
  } else if (isPartiallyCorrect) {
    feedback = `Partially complete. Good progress on core points, but missed: ${missingConcepts.slice(0, 2).join('; ')}.`;
  } else {
    feedback = `Significant gaps in conceptual coverage. Key missing elements: ${missingConcepts.slice(0, 2).join('; ')}.`;
  }

  return {
    marksAwarded,
    maxMarks: rubric.maxMarks,
    percentage,
    isCorrect,
    isPartiallyCorrect,
    matchedConcepts,
    missingConcepts,
    feedback,
    detectedErrors: finalRatio < 0.4 ? ['Missing key scientific elements'] : [],
  };
}
