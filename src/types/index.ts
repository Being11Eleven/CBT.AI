/* ============================================================
   CBT.AI — Core Type Definitions
   ============================================================ */

// ── Academic Level ──
export type AcademicCategory = 'school' | 'competitive' | 'college' | 'custom';

export interface AcademicLevel {
  id: string;
  category: AcademicCategory;
  label: string;
  description?: string;
}

// ── Exam Configuration ──
export type QuestionType =
  | 'single_correct_mcq'
  | 'multiple_correct_mcq'
  | 'numerical'
  | 'assertion_reason'
  | 'true_false'
  | 'statement_based'
  | 'match_following'
  | 'short_answer'
  | 'long_answer'
  | 'subjective'
  | 'mixed';

export type Difficulty = 'easy' | 'normal' | 'medium' | 'hard' | 'very_hard' | 'extreme' | 'custom';

export type QuestionCharacteristic =
  | 'conceptual'
  | 'reasoning'
  | 'heavy_reasoning'
  | 'application'
  | 'hots'
  | 'twisted'
  | 'multi_concept'
  | 'counterintuitive'
  | 'analytical'
  | 'case_based'
  | 'graph_based'
  | 'data_based'
  | 'calculation_heavy'
  | 'concept_calculation'
  | 'elimination_based'
  | 'trap_aware'
  | 'real_world'
  | 'deep_understanding'
  | 'misconception_testing'
  | 'pattern_recognition'
  | 'competitive_style'
  | 'pyq_inspired'
  | 'teacher_trick'
  | 'time_pressure';

export interface MarkingScheme {
  correct: number;
  incorrect: number;
  unanswered: number;
  partial?: boolean;
}

export interface ExamSection {
  id: string;
  name: string;
  questionCount: number;
  marks: number;
  duration?: number; // minutes
  questionTypes: QuestionType[];
}

export interface ExamConfig {
  id: string;
  title: string;
  level: AcademicLevel;
  subject: string;
  questionTypes: QuestionType[];
  difficulty: Difficulty;
  customDifficulty?: string;
  characteristics: QuestionCharacteristic[];
  questionCount: number;
  duration: number; // minutes
  marking: MarkingScheme;
  sections?: ExamSection[];
  enablePYQAnalysis: boolean;
  enableResearch: boolean;
  enableMixed: boolean;
  enableExplanations: boolean;
  enableNegativeMarking: boolean;
  enablePartialMarking: boolean;
  additionalInstructions?: string;
  teacherInstructions?: string;
  visibility: 'private' | 'link' | 'code';
  shareCode?: string;
}

// ── Document / Upload ──
export interface UploadedDocument {
  id: string;
  name: string;
  type: 'study_material' | 'syllabus' | 'instructions';
  mimeType: string;
  size: number;
  content?: string; // extracted text
  uploadedAt: number;
}

// ── Generated Question ──
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface GeneratedQuestion {
  id: string;
  index: number;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  options?: QuestionOption[];
  matchPairs?: MatchPair[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  numericalTolerance?: number;
  marks: number;
  negativeMarks: number;
  topic: string;
  subtopic?: string;
  difficulty: Difficulty;
  characteristics: QuestionCharacteristic[];
  explanation: string;
  expectedAnswer: string;
  commonMisconception?: string;
  distractorExplanations?: Record<string, string>;
  estimatedTime: number; // seconds
  cognitiveLevel: string;
  validated: boolean;
  sourceInspiration?: string;
  section?: string;
}

// ── Exam Instance ──
export type ExamStatus = 'draft' | 'generating' | 'ready' | 'active' | 'submitted' | 'evaluated';

export interface Exam {
  id: string;
  config: ExamConfig;
  questions: GeneratedQuestion[];
  status: ExamStatus;
  createdAt: number;
  updatedAt: number;
  generationLog?: GenerationStep[];
  documents: UploadedDocument[];
  version: number;
}

export interface GenerationStep {
  id: string;
  step: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  message?: string;
  progress?: number;
  timestamp: number;
}

// ── Attempt ──
export type QuestionState = 'not_visited' | 'visited' | 'answered' | 'marked' | 'answered_marked';

export interface StudentResponse {
  questionId: string;
  selectedOptions?: string[]; // for MCQ
  textAnswer?: string; // for numerical/subjective
  explanation?: string; // optional working
  state: QuestionState;
  timeSpent: number; // seconds
  answeredAt?: number;
  changesCount: number;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examVersion: number;
  studentName?: string;
  startedAt: number;
  submittedAt?: number;
  expiresAt: number;
  responses: Record<string, StudentResponse>;
  integrityLog: IntegrityEvent[];
  autoSubmitted: boolean;
  status: 'in_progress' | 'submitted' | 'evaluated';
}

export interface IntegrityEvent {
  type: 'visibility_change' | 'focus_loss' | 'fullscreen_exit' | 'warning' | 'auto_submit';
  timestamp: number;
  count?: number;
  message?: string;
}

// ── Result ──
export interface QuestionResult {
  questionId: string;
  questionIndex: number;
  questionText: string;
  questionType: QuestionType;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isPartiallyCorrect?: boolean;
  marksObtained: number;
  maxMarks: number;
  status: 'correct' | 'incorrect' | 'unanswered' | 'partial';
  explanation: string;
  whatShouldHaveBeenWritten: string;
  whyIncorrect?: string;
  conceptTested: string;
  commonMisconception?: string;
  timeSpent: number;
  difficulty: Difficulty;
  characteristics: QuestionCharacteristic[];
  rubricEvaluation?: RubricResult;
}

export interface RubricResult {
  totalMarks: number;
  obtained: number;
  components: RubricComponent[];
  suggestedImprovement: string;
}

export interface RubricComponent {
  name: string;
  maxMarks: number;
  obtained: number;
  feedback: string;
}

export interface TopicPerformance {
  topic: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
  marksObtained: number;
  maxMarks: number;
}

export interface DifficultyPerformance {
  difficulty: Difficulty;
  total: number;
  correct: number;
  accuracy: number;
}

export interface CharacteristicPerformance {
  characteristic: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface ExamResult {
  id: string;
  attemptId: string;
  examId: string;
  studentName?: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  accuracy: number;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  totalTime: number;
  averageTimePerQuestion: number;
  fastestCorrect?: number;
  slowestIncorrect?: number;
  questionResults: QuestionResult[];
  topicPerformance: TopicPerformance[];
  difficultyPerformance: DifficultyPerformance[];
  characteristicPerformance: CharacteristicPerformance[];
  weaknessAnalysis: string[];
  evaluatedAt: number;
}

// ── AI Provider ──
export interface AIProviderConfig {
  provider: 'cloudflare' | 'openai' | 'gemini' | 'custom';
  model?: string;
  apiKey?: string;
  endpoint?: string;
}

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
