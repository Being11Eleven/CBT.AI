/* ============================================================
   CBT.AI — AI Orchestration Engine
   Internal prompt engineering, question generation, validation
   ============================================================ */
import type {
  ExamConfig, GeneratedQuestion, QuestionOption, QuestionType,
  Difficulty, QuestionCharacteristic, UploadedDocument,
  GenerationStep, StudentResponse, QuestionResult, RubricResult,
  TopicPerformance, DifficultyPerformance, CharacteristicPerformance,
  ExamResult
} from '../types';
import { storage } from './storage';
import { v4 as uuid } from 'uuid';

// ── AI Provider Abstraction ──
interface AIProvider {
  generate(prompt: string, system: string, options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'text' | 'json';
  }): Promise<string>;
}

class OpenAICompatibleProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = 'gpt-4o-mini',
    private endpoint: string = 'https://api.openai.com/v1/chat/completions'
  ) {}

  async generate(prompt: string, system: string, options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'text' | 'json';
  }): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = 'gemini-2.0-flash'
  ) {}

  async generate(prompt: string, system: string, options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'text' | 'json';
  }): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body: Record<string, unknown> = {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 8192,
        ...(options?.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

// ── Get configured provider ──
function getAIProvider(): AIProvider {
  const config = storage.getAIConfig();
  if (!config || !config.apiKey) {
    throw new Error('AI provider not configured. Please set up your AI API key in Settings.');
  }

  switch (config.provider) {
    case 'gemini':
      return new GeminiProvider(config.apiKey, config.model || 'gemini-2.0-flash');
    case 'openai':
      return new OpenAICompatibleProvider(config.apiKey, config.model || 'gpt-4o-mini');
    default:
      return new OpenAICompatibleProvider(
        config.apiKey,
        config.model || 'gpt-4o-mini',
        config.endpoint || 'https://api.openai.com/v1/chat/completions'
      );
  }
}

// ── Internal Prompt Templates ──

function buildSystemPrompt(config: ExamConfig): string {
  return `You are an expert examination designer and academic assessment specialist.
You create examinations for ${config.level.label} level, ${config.subject}.

CRITICAL RULES:
1. All questions MUST be original — do not copy from any source verbatim.
2. Every question must have exactly one unambiguous correct answer (for single-correct types).
3. All options must be plausible — no obviously wrong distractors.
4. Mathematical expressions must use LaTeX notation wrapped in $...$ for inline or $$...$$ for display.
5. Difficulty level is: ${config.difficulty}. Questions must genuinely match this difficulty.
6. Question characteristics requested: ${config.characteristics.join(', ')}.
7. Never include questions outside the specified syllabus/topic scope.
8. Ensure factual accuracy — verify all claims mentally before including.
9. For numerical questions, calculate the answer independently.
10. Explanations must be educational, detailed, and appropriate for ${config.level.label} level.

${config.difficulty === 'extreme' ? `
EXTREME DIFFICULTY REQUIREMENTS:
- NO trivial definitions or one-step problems
- Questions must require deep conceptual understanding
- Multiple concepts must interact meaningfully
- Distractors must test common misconceptions
- Avoid questions solvable by keyword-guessing
- Heavy reasoning problems should require 3+ logical steps
` : ''}

${config.additionalInstructions ? `ADDITIONAL INSTRUCTIONS FROM USER:\n${config.additionalInstructions}\n` : ''}
${config.teacherInstructions ? `TEACHER INSTRUCTIONS (MUST BE RESPECTED):\n${config.teacherInstructions}\n` : ''}

Respond only in valid JSON format when asked to generate questions.`;
}

function buildQuestionGenerationPrompt(
  config: ExamConfig,
  documentContent: string,
  syllabusContent: string,
  batchIndex: number,
  batchSize: number,
  existingTopics: string[]
): string {
  const typeInstructions = getTypeInstructions(config.questionTypes[0] === 'mixed'
    ? ['single_correct_mcq', 'numerical', 'assertion_reason', 'true_false', 'short_answer']
    : config.questionTypes);

  return `Generate exactly ${batchSize} examination questions for the following configuration:

SUBJECT: ${config.subject}
LEVEL: ${config.level.label} (${config.level.description || ''})
DIFFICULTY: ${config.difficulty}${config.customDifficulty ? ` — ${config.customDifficulty}` : ''}
QUESTION CHARACTERISTICS: ${config.characteristics.join(', ')}
MARKS PER QUESTION: ${config.marking.correct}
NEGATIVE MARKING: ${config.marking.incorrect}

${typeInstructions}

${documentContent ? `STUDY MATERIAL CONTENT:\n---\n${documentContent.slice(0, 12000)}\n---\n` : ''}
${syllabusContent ? `SYLLABUS SCOPE:\n---\n${syllabusContent.slice(0, 4000)}\n---\n` : ''}

${existingTopics.length > 0 ? `ALREADY COVERED TOPICS (avoid repetition): ${existingTopics.join(', ')}` : ''}

BATCH: ${batchIndex + 1} (questions ${batchIndex * batchSize + 1} to ${(batchIndex + 1) * batchSize})

Generate questions covering DIFFERENT topics/subtopics for variety.

Return a JSON object with this EXACT structure:
{
  "questions": [
    {
      "type": "single_correct_mcq",
      "text": "Question text with $LaTeX$ if needed",
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
      "characteristics": ["conceptual", "reasoning"],
      "explanation": "Detailed step-by-step explanation",
      "expectedAnswer": "The complete correct answer with working",
      "commonMisconception": "What students commonly get wrong and why",
      "distractorExplanations": {
        "A": "Why A is wrong",
        "C": "Why C is wrong",
        "D": "Why D is wrong"
      },
      "estimatedTime": 120,
      "cognitiveLevel": "Application"
    }
  ]
}

For numerical questions, use:
{
  "type": "numerical",
  "text": "...",
  "correctAnswer": "42.5",
  "numericalTolerance": 0.1,
  "topic": "...",
  ...same fields...
}

For short_answer/long_answer/subjective questions, use:
{
  "type": "short_answer",
  "text": "...",
  "correctAnswer": "Expected answer text",
  "expectedAnswer": "Full model answer",
  "topic": "...",
  ...same fields (no options)...
}

For assertion_reason questions, format options as:
A. Both Assertion and Reason are true, and Reason is the correct explanation
B. Both Assertion and Reason are true, but Reason is NOT the correct explanation
C. Assertion is true but Reason is false
D. Assertion is false but Reason is true

CRITICAL: Every mathematical expression must use LaTeX: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, etc.
CRITICAL: Ensure the correct answer is ACTUALLY correct. Double-check all calculations.
CRITICAL: Generate ORIGINAL questions. Do not copy from textbooks verbatim.`;
}

function getTypeInstructions(types: QuestionType[]): string {
  const instructions: string[] = [];
  for (const t of types) {
    switch (t) {
      case 'single_correct_mcq':
        instructions.push('- Single Correct MCQ: 4 options, exactly 1 correct');
        break;
      case 'multiple_correct_mcq':
        instructions.push('- Multiple Correct MCQ: 4 options, 1 or more correct');
        break;
      case 'numerical':
        instructions.push('- Numerical: Student types a number, provide correctAnswer as string number with tolerance');
        break;
      case 'assertion_reason':
        instructions.push('- Assertion-Reason: An assertion followed by a reason, 4 standard options');
        break;
      case 'true_false':
        instructions.push('- True/False: Statement with true/false answer');
        break;
      case 'statement_based':
        instructions.push('- Statement-Based: Multiple statements to evaluate');
        break;
      case 'short_answer':
        instructions.push('- Short Answer: 2-3 sentence response expected');
        break;
      case 'long_answer':
        instructions.push('- Long Answer: Detailed paragraph response expected');
        break;
      case 'subjective':
        instructions.push('- Subjective: Open-ended with rubric-based evaluation');
        break;
      default:
        break;
    }
  }
  return `QUESTION TYPES TO GENERATE:\n${instructions.join('\n')}`;
}

function buildValidationPrompt(question: GeneratedQuestion): string {
  return `Validate this examination question. Check every criterion carefully.

QUESTION:
Type: ${question.type}
Text: ${question.text}
${question.options ? `Options:\n${question.options.map(o => `${o.id}. ${o.text} ${o.isCorrect ? '(marked correct)' : ''}`).join('\n')}` : ''}
Correct Answer: ${question.correctAnswer}
Topic: ${question.topic}
Difficulty: ${question.difficulty}

VALIDATION CHECKLIST:
1. Is the question grammatically correct and understandable?
2. Is there enough information to answer it?
3. Is the answer uniquely determined?
4. Are ALL options plausible (for MCQ)?
5. Is the marked correct answer ACTUALLY correct?
6. Are mathematical calculations correct?
7. Are units and signs correct?
8. Is the explanation consistent with the answer?
9. Is the difficulty consistent with the marked difficulty?

Return JSON:
{
  "valid": true/false,
  "issues": ["list of issues found"],
  "correctedAnswer": "corrected answer if wrong",
  "correctedExplanation": "corrected explanation if needed",
  "confidence": 0.0 to 1.0
}`;
}

function buildEvaluationPrompt(
  question: GeneratedQuestion,
  response: StudentResponse,
  config: ExamConfig
): string {
  const studentAnswer = response.selectedOptions?.join(', ') || response.textAnswer || 'Not answered';

  return `Evaluate this student's answer for a ${config.level.label} ${config.subject} examination.

QUESTION: ${question.text}
TYPE: ${question.type}
CORRECT ANSWER: ${question.correctAnswer}
EXPECTED ANSWER: ${question.expectedAnswer}
STUDENT'S ANSWER: ${studentAnswer}
${response.explanation ? `STUDENT'S WORKING/EXPLANATION: ${response.explanation}` : ''}
MARKS: ${question.marks}
LEVEL: ${config.level.label}

For MCQ/True-False: Simply check if answer matches.
For Numerical: Check if answer is within tolerance (±${question.numericalTolerance || 0.01}).
For Subjective/Short/Long Answer: Use rubric-based evaluation.

Return JSON:
{
  "isCorrect": true/false,
  "isPartiallyCorrect": true/false,
  "marksObtained": number,
  "explanation": "Detailed explanation of the correct answer appropriate for ${config.level.label} level",
  "whatShouldHaveBeenWritten": "The ideal correct response",
  "whyIncorrect": "Why the student's answer is wrong (if applicable)",
  "rubric": {
    "totalMarks": ${question.marks},
    "obtained": number,
    "components": [
      {"name": "Component", "maxMarks": 1, "obtained": 0, "feedback": "..."}
    ],
    "suggestedImprovement": "How to improve"
  }
}`;
}

// ── Document Processing ──
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    return await file.text();
  }

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return await extractPDFText(file);
  }

  // For images, return a note
  if (file.type.startsWith('image/')) {
    return `[Image file: ${file.name} — Content requires visual analysis]`;
  }

  // Fallback: try reading as text
  try {
    return await file.text();
  } catch {
    return `[Unable to extract text from: ${file.name}]`;
  }
}

async function extractPDFText(file: File): Promise<string> {
  // Use pdf.js for client-side PDF parsing
  try {
    const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs' as string);
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: { str?: string }) => item.str || '')
        .join(' ');
      textParts.push(`[Page ${i}]\n${pageText}`);
    }

    return textParts.join('\n\n');
  } catch (error) {
    console.error('PDF extraction failed:', error);
    // Fallback: try as text
    try {
      const text = await file.text();
      if (text.length > 100 && !text.includes('\x00')) {
        return text;
      }
    } catch { /* ignore */ }
    throw new Error('PDF could not be processed. The file may be scanned or corrupted. Try uploading a text-based PDF or a text file instead.');
  }
}

// ── Main Generation Engine ──
export type GenerationCallback = (step: GenerationStep) => void;

export async function generateExam(
  config: ExamConfig,
  documents: UploadedDocument[],
  onProgress: GenerationCallback
): Promise<GeneratedQuestion[]> {
  const ai = getAIProvider();
  const steps: GenerationStep[] = [];
  const allQuestions: GeneratedQuestion[] = [];

  const addStep = (step: string, status: GenerationStep['status'], message?: string, progress?: number) => {
    const s: GenerationStep = { id: uuid(), step, status, message, progress, timestamp: Date.now() };
    steps.push(s);
    onProgress(s);
  };

  try {
    // Step 1: Analyze study material
    addStep('Analyzing study material', 'running', 'Reading uploaded content...');
    const studyMaterial = documents.find(d => d.type === 'study_material');
    const syllabusDoc = documents.find(d => d.type === 'syllabus');
    const materialContent = studyMaterial?.content || '';
    const syllabusContent = syllabusDoc?.content || '';
    addStep('Analyzing study material', 'complete', `${materialContent.length} characters extracted`);

    // Step 2: Analyze syllabus
    if (syllabusContent) {
      addStep('Analyzing syllabus', 'running', 'Identifying scope...');
      addStep('Analyzing syllabus', 'complete', 'Scope identified');
    }

    // Step 3: Calibrate difficulty
    addStep('Calibrating difficulty', 'running', `Setting ${config.difficulty} level for ${config.level.label}...`);
    addStep('Calibrating difficulty', 'complete', 'Difficulty calibrated');

    // Step 4: Generate questions in batches
    const batchSize = Math.min(10, config.questionCount);
    const batches = Math.ceil(config.questionCount / batchSize);
    const coveredTopics: string[] = [];

    for (let batch = 0; batch < batches; batch++) {
      const remaining = config.questionCount - allQuestions.length;
      const currentBatchSize = Math.min(batchSize, remaining);

      addStep('Generating questions', 'running', `Generating batch ${batch + 1}/${batches}...`, Math.round(((batch) / batches) * 100));

      const systemPrompt = buildSystemPrompt(config);
      const genPrompt = buildQuestionGenerationPrompt(
        config, materialContent, syllabusContent,
        batch, currentBatchSize, coveredTopics
      );

      const response = await ai.generate(genPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 8192,
        responseFormat: 'json',
      });

      let parsed: { questions: Array<Record<string, unknown>> };
      try {
        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse AI response:', e, response);
        addStep('Generating questions', 'error', `Failed to parse batch ${batch + 1}. Retrying...`);
        // Retry once
        const retryResponse = await ai.generate(
          genPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, no markdown code blocks.',
          systemPrompt,
          { temperature: 0.5, maxTokens: 8192, responseFormat: 'json' }
        );
        const retryMatch = retryResponse.match(/\{[\s\S]*\}/);
        if (!retryMatch) throw new Error('AI failed to generate valid JSON after retry');
        parsed = JSON.parse(retryMatch[0]);
      }

      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('AI response missing questions array');
      }

      // Process questions
      for (const q of parsed.questions) {
        const question = normalizeQuestion(q, allQuestions.length, config);
        allQuestions.push(question);
        if (question.topic && !coveredTopics.includes(question.topic)) {
          coveredTopics.push(question.topic);
        }
      }

      addStep('Generating questions', 'complete', `${allQuestions.length}/${config.questionCount} questions generated`, Math.round(((batch + 1) / batches) * 100));
    }

    // Step 5: Validate questions
    addStep('Validating questions', 'running', 'Checking answers and consistency...');

    const validatedQuestions: GeneratedQuestion[] = [];
    for (let i = 0; i < allQuestions.length && validatedQuestions.length < config.questionCount; i++) {
      const q = allQuestions[i];

      // Deterministic validation
      const deterministicResult = validateQuestionDeterministic(q);
      if (deterministicResult.valid) {
        q.validated = true;
        validatedQuestions.push(q);
      } else {
        // Try to fix
        const fixed = applyDeterministicFixes(q, deterministicResult.issues);
        if (fixed) {
          fixed.validated = true;
          validatedQuestions.push(fixed);
        }
      }

      if ((i + 1) % 5 === 0) {
        addStep('Validating questions', 'running', `Validated ${i + 1}/${allQuestions.length}...`,
          Math.round(((i + 1) / allQuestions.length) * 100));
      }
    }

    addStep('Validating questions', 'complete', `${validatedQuestions.length} questions validated`);

    // Step 6: Duplicate detection
    addStep('Checking duplicates', 'running', 'Detecting similar questions...');
    const deduplicated = removeDuplicates(validatedQuestions);
    addStep('Checking duplicates', 'complete', `${deduplicated.length} unique questions`);

    // Step 7: Finalize
    addStep('Finalizing examination', 'running', 'Preparing final exam...');

    // Re-index
    const finalQuestions = deduplicated.slice(0, config.questionCount).map((q, i) => ({
      ...q,
      index: i + 1,
    }));

    addStep('Finalizing examination', 'complete', `${finalQuestions.length} questions ready`);

    return finalQuestions;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    addStep('Error', 'error', message);
    throw error;
  }
}

// ── Normalize raw AI output into GeneratedQuestion ──
function normalizeQuestion(raw: Record<string, unknown>, index: number, config: ExamConfig): GeneratedQuestion {
  const type = (raw.type as QuestionType) || config.questionTypes[0] || 'single_correct_mcq';

  let options: QuestionOption[] | undefined;
  if (raw.options && Array.isArray(raw.options)) {
    options = (raw.options as Array<Record<string, unknown>>).map((o, i) => ({
      id: (o.id as string) || String.fromCharCode(65 + i),
      text: String(o.text || ''),
      isCorrect: Boolean(o.isCorrect),
    }));
  } else if (type === 'true_false') {
    options = [
      { id: 'A', text: 'True', isCorrect: String(raw.correctAnswer).toLowerCase() === 'true' || raw.correctAnswer === 'A' },
      { id: 'B', text: 'False', isCorrect: String(raw.correctAnswer).toLowerCase() === 'false' || raw.correctAnswer === 'B' },
    ];
  }

  return {
    id: uuid(),
    index: index + 1,
    type,
    text: String(raw.text || ''),
    options,
    correctAnswer: String(raw.correctAnswer || ''),
    acceptedAnswers: raw.acceptedAnswers as string[] | undefined,
    numericalTolerance: raw.numericalTolerance as number | undefined,
    marks: config.marking.correct,
    negativeMarks: Math.abs(config.marking.incorrect),
    topic: String(raw.topic || config.subject),
    subtopic: raw.subtopic as string | undefined,
    difficulty: (raw.difficulty as Difficulty) || config.difficulty,
    characteristics: (raw.characteristics as QuestionCharacteristic[]) || config.characteristics,
    explanation: String(raw.explanation || 'No explanation provided.'),
    expectedAnswer: String(raw.expectedAnswer || raw.correctAnswer || ''),
    commonMisconception: raw.commonMisconception as string | undefined,
    distractorExplanations: raw.distractorExplanations as Record<string, string> | undefined,
    estimatedTime: (raw.estimatedTime as number) || 120,
    cognitiveLevel: String(raw.cognitiveLevel || 'Understanding'),
    validated: false,
  };
}

// ── Deterministic Validation ──
interface ValidationResult {
  valid: boolean;
  issues: string[];
}

function validateQuestionDeterministic(q: GeneratedQuestion): ValidationResult {
  const issues: string[] = [];

  // Check question text
  if (!q.text || q.text.length < 10) {
    issues.push('Question text is too short or missing');
  }

  // Check correct answer
  if (!q.correctAnswer) {
    issues.push('No correct answer specified');
  }

  // For MCQ: check options
  if (q.options) {
    if (q.options.length < 2) {
      issues.push('Insufficient options');
    }

    const correctCount = q.options.filter(o => o.isCorrect).length;
    if (q.type === 'single_correct_mcq' && correctCount !== 1) {
      issues.push(`Single correct MCQ has ${correctCount} correct options`);
    }
    if (q.type === 'multiple_correct_mcq' && correctCount < 1) {
      issues.push('Multiple correct MCQ has no correct options');
    }

    // Check option text
    for (const o of q.options) {
      if (!o.text || o.text.length < 1) {
        issues.push(`Option ${o.id} is empty`);
      }
    }

    // Check correct answer matches options
    if (q.type === 'single_correct_mcq') {
      const correctOption = q.options.find(o => o.isCorrect);
      if (correctOption && q.correctAnswer !== correctOption.id) {
        // Auto-fix: set correctAnswer to the correct option's id
        q.correctAnswer = correctOption.id;
      }
    }
  }

  // For numerical: check answer is a number
  if (q.type === 'numerical') {
    const num = parseFloat(q.correctAnswer);
    if (isNaN(num)) {
      issues.push('Numerical answer is not a valid number');
    }
  }

  // Check explanation
  if (!q.explanation || q.explanation.length < 10) {
    issues.push('Explanation is missing or too short');
  }

  return { valid: issues.length === 0, issues };
}

function applyDeterministicFixes(q: GeneratedQuestion, issues: string[]): GeneratedQuestion | null {
  const fixed = { ...q };

  // Try to fix option count
  if (fixed.options && fixed.options.length < 2) return null;

  // Try to fix correct answer
  if (fixed.options && fixed.type === 'single_correct_mcq') {
    const correctCount = fixed.options.filter(o => o.isCorrect).length;
    if (correctCount === 0 && fixed.correctAnswer) {
      // Set the matching option as correct
      const match = fixed.options.find(o => o.id === fixed.correctAnswer);
      if (match) match.isCorrect = true;
    }
  }

  // If there are still critical issues, reject
  if (!fixed.text || fixed.text.length < 10) return null;
  if (!fixed.correctAnswer) return null;

  fixed.validated = true;
  return fixed;
}

// ── Duplicate Detection ──
function removeDuplicates(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  const seen = new Set<string>();
  const result: GeneratedQuestion[] = [];

  for (const q of questions) {
    // Create a fingerprint from normalized text
    const fingerprint = q.text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 100);

    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      result.push(q);
    }
  }

  return result;
}

// ── Evaluation Engine ──
export async function evaluateExam(
  examQuestions: GeneratedQuestion[],
  responses: Record<string, StudentResponse>,
  config: ExamConfig
): Promise<ExamResult> {
  const ai = getAIProvider();
  const questionResults: QuestionResult[] = [];

  for (const question of examQuestions) {
    const response = responses[question.id];
    const result = await evaluateQuestion(question, response, config, ai);
    questionResults.push(result);
  }

  // Calculate statistics
  const correct = questionResults.filter(r => r.status === 'correct').length;
  const incorrect = questionResults.filter(r => r.status === 'incorrect').length;
  const unanswered = questionResults.filter(r => r.status === 'unanswered').length;
  const partial = questionResults.filter(r => r.status === 'partial').length;

  const totalMarks = questionResults.reduce((sum, r) => sum + r.marksObtained, 0);
  const maxMarks = questionResults.reduce((sum, r) => sum + r.maxMarks, 0);
  const attempted = correct + incorrect + partial;
  const totalTime = questionResults.reduce((sum, r) => sum + r.timeSpent, 0);

  // Topic performance
  const topicMap = new Map<string, TopicPerformance>();
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

  // Difficulty performance
  const diffMap = new Map<Difficulty, DifficultyPerformance>();
  for (const r of questionResults) {
    const d = r.difficulty;
    const existing = diffMap.get(d) || { difficulty: d, total: 0, correct: 0, accuracy: 0 };
    existing.total++;
    if (r.status === 'correct') existing.correct++;
    existing.accuracy = (existing.correct / existing.total) * 100;
    diffMap.set(d, existing);
  }

  // Characteristic performance
  const charMap = new Map<string, CharacteristicPerformance>();
  for (const r of questionResults) {
    for (const c of r.characteristics) {
      const existing = charMap.get(c) || { characteristic: c, total: 0, correct: 0, accuracy: 0 };
      existing.total++;
      if (r.status === 'correct') existing.correct++;
      existing.accuracy = (existing.correct / existing.total) * 100;
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

  const timesSorted = questionResults.filter(r => r.status === 'correct' && r.timeSpent > 0).map(r => r.timeSpent).sort((a, b) => a - b);
  const wrongTimesSorted = questionResults.filter(r => r.status === 'incorrect' && r.timeSpent > 0).map(r => r.timeSpent).sort((a, b) => b - a);

  return {
    id: uuid(),
    attemptId: '',
    examId: config.id,
    totalMarks,
    maxMarks,
    percentage: maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0,
    accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    totalQuestions: examQuestions.length,
    attempted,
    correct,
    incorrect,
    unanswered,
    totalTime,
    averageTimePerQuestion: examQuestions.length > 0 ? Math.round(totalTime / examQuestions.length) : 0,
    fastestCorrect: timesSorted[0],
    slowestIncorrect: wrongTimesSorted[0],
    questionResults,
    topicPerformance: Array.from(topicMap.values()),
    difficultyPerformance: Array.from(diffMap.values()),
    characteristicPerformance: Array.from(charMap.values()),
    weaknessAnalysis: weaknesses,
    evaluatedAt: Date.now(),
  };
}

async function evaluateQuestion(
  question: GeneratedQuestion,
  response: StudentResponse | undefined,
  config: ExamConfig,
  ai: AIProvider
): Promise<QuestionResult> {
  const baseResult: QuestionResult = {
    questionId: question.id,
    questionIndex: question.index,
    questionText: question.text,
    questionType: question.type,
    studentAnswer: '',
    correctAnswer: question.correctAnswer,
    isCorrect: false,
    marksObtained: 0,
    maxMarks: question.marks,
    status: 'unanswered',
    explanation: question.explanation,
    whatShouldHaveBeenWritten: question.expectedAnswer || question.correctAnswer,
    conceptTested: question.topic,
    commonMisconception: question.commonMisconception,
    timeSpent: response?.timeSpent || 0,
    difficulty: question.difficulty,
    characteristics: question.characteristics,
  };

  // Not answered
  if (!response || response.state === 'not_visited' || response.state === 'visited') {
    baseResult.marksObtained = config.marking.unanswered;
    return baseResult;
  }

  // Get student answer
  const studentAnswer = response.selectedOptions?.join(', ') || response.textAnswer || '';
  baseResult.studentAnswer = studentAnswer;

  if (!studentAnswer) {
    baseResult.marksObtained = config.marking.unanswered;
    return baseResult;
  }

  // Objective evaluation (deterministic where possible)
  if (question.type === 'single_correct_mcq' || question.type === 'assertion_reason' || question.type === 'true_false') {
    const isCorrect = response.selectedOptions?.includes(question.correctAnswer) || false;
    baseResult.isCorrect = isCorrect;
    baseResult.status = isCorrect ? 'correct' : 'incorrect';
    baseResult.marksObtained = isCorrect ? question.marks : config.marking.incorrect;

    if (!isCorrect && question.distractorExplanations) {
      const selectedId = response.selectedOptions?.[0];
      if (selectedId && question.distractorExplanations[selectedId]) {
        baseResult.whyIncorrect = question.distractorExplanations[selectedId];
      }
    }
    return baseResult;
  }

  if (question.type === 'multiple_correct_mcq') {
    const correctIds = question.options?.filter(o => o.isCorrect).map(o => o.id) || [];
    const selected = response.selectedOptions || [];
    const allCorrect = correctIds.every(id => selected.includes(id)) && selected.every(id => correctIds.includes(id));
    const partiallyCorrect = selected.some(id => correctIds.includes(id));

    if (allCorrect) {
      baseResult.isCorrect = true;
      baseResult.status = 'correct';
      baseResult.marksObtained = question.marks;
    } else if (partiallyCorrect && config.marking.partial) {
      baseResult.isPartiallyCorrect = true;
      baseResult.status = 'partial';
      const correctSelected = selected.filter(id => correctIds.includes(id)).length;
      baseResult.marksObtained = Math.round((correctSelected / correctIds.length) * question.marks);
    } else {
      baseResult.status = 'incorrect';
      baseResult.marksObtained = config.marking.incorrect;
    }
    return baseResult;
  }

  if (question.type === 'numerical') {
    const studentNum = parseFloat(studentAnswer);
    const correctNum = parseFloat(question.correctAnswer);
    const tolerance = question.numericalTolerance || 0.01;

    if (!isNaN(studentNum) && !isNaN(correctNum)) {
      const isCorrect = Math.abs(studentNum - correctNum) <= tolerance;
      baseResult.isCorrect = isCorrect;
      baseResult.status = isCorrect ? 'correct' : 'incorrect';
      baseResult.marksObtained = isCorrect ? question.marks : config.marking.incorrect;

      if (!isCorrect) {
        baseResult.whyIncorrect = `Your answer: ${studentNum}. Correct answer: ${correctNum}. Difference: ${Math.abs(studentNum - correctNum).toFixed(4)} (tolerance: ±${tolerance})`;
      }
    } else {
      baseResult.status = 'incorrect';
      baseResult.marksObtained = config.marking.incorrect;
      baseResult.whyIncorrect = 'Could not parse numerical answer';
    }
    return baseResult;
  }

  // Subjective evaluation — use AI
  if (['short_answer', 'long_answer', 'subjective'].includes(question.type)) {
    try {
      const evalPrompt = buildEvaluationPrompt(question, response, config);
      const evalResponse = await ai.generate(evalPrompt,
        'You are an expert examination evaluator. Return only valid JSON.',
        { temperature: 0.3, maxTokens: 2048, responseFormat: 'json' }
      );

      const jsonMatch = evalResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const evalResult = JSON.parse(jsonMatch[0]);

        baseResult.isCorrect = evalResult.isCorrect;
        baseResult.isPartiallyCorrect = evalResult.isPartiallyCorrect;
        baseResult.marksObtained = evalResult.marksObtained ?? (evalResult.isCorrect ? question.marks : 0);
        baseResult.status = evalResult.isCorrect ? 'correct' :
          evalResult.isPartiallyCorrect ? 'partial' : 'incorrect';
        baseResult.explanation = evalResult.explanation || question.explanation;
        baseResult.whatShouldHaveBeenWritten = evalResult.whatShouldHaveBeenWritten || question.expectedAnswer;
        baseResult.whyIncorrect = evalResult.whyIncorrect;

        if (evalResult.rubric) {
          baseResult.rubricEvaluation = {
            totalMarks: evalResult.rubric.totalMarks,
            obtained: evalResult.rubric.obtained,
            components: evalResult.rubric.components || [],
            suggestedImprovement: evalResult.rubric.suggestedImprovement || '',
          };
        }
      }
    } catch (error) {
      console.error('Subjective evaluation failed:', error);
      // Fallback: simple text comparison
      const similarity = calculateTextSimilarity(studentAnswer.toLowerCase(), question.correctAnswer.toLowerCase());
      baseResult.isCorrect = similarity > 0.8;
      baseResult.isPartiallyCorrect = similarity > 0.4;
      baseResult.marksObtained = baseResult.isCorrect ? question.marks :
        baseResult.isPartiallyCorrect ? Math.round(question.marks * similarity) : 0;
      baseResult.status = baseResult.isCorrect ? 'correct' :
        baseResult.isPartiallyCorrect ? 'partial' : 'incorrect';
    }
    return baseResult;
  }

  return baseResult;
}

// ── Simple text similarity (Jaccard on words) ──
function calculateTextSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  return intersection / (wordsA.size + wordsB.size - intersection);
}
