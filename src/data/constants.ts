/* ============================================================
   CBT.AI — Constants & Configuration Data
   ============================================================ */
import type { AcademicLevel, QuestionCharacteristic, QuestionType, Difficulty } from '../types';

export const ACADEMIC_LEVELS: AcademicLevel[] = [
  // School
  { id: 'class_6', category: 'school', label: 'Class 6', description: 'Middle school foundation' },
  { id: 'class_7', category: 'school', label: 'Class 7', description: 'Middle school' },
  { id: 'class_8', category: 'school', label: 'Class 8', description: 'Middle school advanced' },
  { id: 'class_9', category: 'school', label: 'Class 9', description: 'Secondary school' },
  { id: 'class_10', category: 'school', label: 'Class 10', description: 'Board examination year' },
  { id: 'class_11', category: 'school', label: 'Class 11', description: 'Senior secondary' },
  { id: 'class_12', category: 'school', label: 'Class 12', description: 'Board examination year' },
  // Competitive
  { id: 'jee_foundation', category: 'competitive', label: 'JEE Foundation', description: 'Class 9-10 competitive' },
  { id: 'jee_main', category: 'competitive', label: 'JEE Main', description: 'Engineering entrance' },
  { id: 'jee_advanced', category: 'competitive', label: 'JEE Advanced', description: 'IIT entrance' },
  { id: 'neet', category: 'competitive', label: 'NEET', description: 'Medical entrance' },
  { id: 'olympiad', category: 'competitive', label: 'Olympiad', description: 'Science/Math olympiad' },
  { id: 'custom_competitive', category: 'competitive', label: 'Custom Competitive', description: 'Custom exam' },
  // College
  { id: 'undergraduate', category: 'college', label: 'Undergraduate', description: 'Bachelor degree' },
  { id: 'engineering', category: 'college', label: 'Engineering', description: 'B.Tech / B.E.' },
  { id: 'bsc', category: 'college', label: 'B.Sc', description: 'Bachelor of Science' },
  { id: 'bca', category: 'college', label: 'BCA', description: 'Bachelor of Computer Applications' },
  { id: 'university_semester', category: 'college', label: 'University Semester', description: 'Semester examination' },
  { id: 'custom_college', category: 'college', label: 'Custom College Level', description: 'Specify your level' },
  // Custom
  { id: 'custom', category: 'custom', label: 'Custom Level', description: 'Define your own standard' },
];

export const SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Computer Science', 'English', 'Social Science',
  'History', 'Geography', 'Economics',
  'Political Science', 'Accountancy', 'Business Studies',
  'Environmental Science', 'Psychology', 'Sociology',
  'Engineering Mathematics', 'Data Structures',
  'Digital Electronics', 'Signals & Systems',
  'Thermodynamics', 'Mechanics', 'Organic Chemistry',
  'Inorganic Chemistry', 'Physical Chemistry',
  'Calculus', 'Linear Algebra', 'Probability & Statistics',
];

export const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: 'single_correct_mcq', label: 'Single Correct MCQ', description: 'One correct option from four' },
  { value: 'multiple_correct_mcq', label: 'Multiple Correct MCQ', description: 'One or more correct options' },
  { value: 'numerical', label: 'Numerical Answer', description: 'Type a numerical value' },
  { value: 'assertion_reason', label: 'Assertion-Reason', description: 'Evaluate assertion and reason' },
  { value: 'true_false', label: 'True/False', description: 'True or false statements' },
  { value: 'statement_based', label: 'Statement-Based', description: 'Evaluate multiple statements' },
  { value: 'match_following', label: 'Match the Following', description: 'Match column pairs' },
  { value: 'short_answer', label: 'Short Answer', description: '2-3 sentence responses' },
  { value: 'long_answer', label: 'Long Answer', description: 'Detailed written responses' },
  { value: 'subjective', label: 'Subjective', description: 'Open-ended evaluation' },
  { value: 'mixed', label: 'Mixed Examination', description: 'Multiple question types in one exam' },
];

export const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'easy', label: 'Easy', color: '#22c55e' },
  { value: 'normal', label: 'Normal', color: '#3b82f6' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'hard', label: 'Hard', color: '#f97316' },
  { value: 'very_hard', label: 'Very Hard', color: '#ef4444' },
  { value: 'extreme', label: 'Extreme', color: '#dc2626' },
  { value: 'custom', label: 'Custom', color: '#8b5cf6' },
];

export const QUESTION_CHARACTERISTICS: { value: QuestionCharacteristic; label: string; icon: string }[] = [
  { value: 'conceptual', label: 'Conceptual', icon: '💡' },
  { value: 'reasoning', label: 'Reasoning', icon: '🧠' },
  { value: 'heavy_reasoning', label: 'Heavy Reasoning', icon: '🔬' },
  { value: 'application', label: 'Application-Based', icon: '⚙️' },
  { value: 'hots', label: 'HOTS', icon: '🎯' },
  { value: 'twisted', label: 'Twisted', icon: '🌀' },
  { value: 'multi_concept', label: 'Multi-Concept', icon: '🔗' },
  { value: 'counterintuitive', label: 'Counterintuitive', icon: '🤯' },
  { value: 'analytical', label: 'Analytical', icon: '📊' },
  { value: 'case_based', label: 'Case-Based', icon: '📋' },
  { value: 'graph_based', label: 'Graph-Based', icon: '📈' },
  { value: 'data_based', label: 'Data-Based', icon: '📉' },
  { value: 'calculation_heavy', label: 'Calculation-Heavy', icon: '🔢' },
  { value: 'concept_calculation', label: 'Concept + Calculation', icon: '💡🔢' },
  { value: 'elimination_based', label: 'Elimination-Based', icon: '❌' },
  { value: 'trap_aware', label: 'Trap-Aware', icon: '⚠️' },
  { value: 'real_world', label: 'Real-World Application', icon: '🌍' },
  { value: 'deep_understanding', label: 'Deep Understanding', icon: '🔍' },
  { value: 'misconception_testing', label: 'Misconception Testing', icon: '🧪' },
  { value: 'pattern_recognition', label: 'Pattern Recognition', icon: '🧩' },
  { value: 'competitive_style', label: 'Competitive-Exam Style', icon: '🏆' },
  { value: 'pyq_inspired', label: 'PYQ-Inspired', icon: '📚' },
  { value: 'teacher_trick', label: 'Teacher-Trick Style', icon: '🎓' },
  { value: 'time_pressure', label: 'Time-Pressure Style', icon: '⏱️' },
];

export const DEFAULT_MARKING = {
  correct: 4,
  incorrect: -1,
  unanswered: 0,
  partial: false,
};

export const EXAM_DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180];

export const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
