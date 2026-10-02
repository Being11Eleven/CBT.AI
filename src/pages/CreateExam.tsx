import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, BookOpen, MessageSquare, ChevronDown, ChevronUp, X, Sparkles, AlertCircle } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { ACADEMIC_LEVELS, SUBJECTS, QUESTION_TYPES, DIFFICULTIES, QUESTION_CHARACTERISTICS, DEFAULT_MARKING, EXAM_DURATIONS, QUESTION_COUNTS } from '../data/constants';
import { extractTextFromFile } from '../services/ai-engine';
import { storage } from '../services/storage';
import type { ExamConfig, UploadedDocument, AcademicLevel, QuestionType, Difficulty, QuestionCharacteristic } from '../types';
import './CreateExam.css';

export default function CreateExam() {
  const navigate = useNavigate();

  // ── State ──
  const [studyFile, setStudyFile] = useState<File | null>(null);
  const [studyContent, setStudyContent] = useState('');
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [syllabusContent, setSyllabusContent] = useState('');
  const [instructionFile, setInstructionFile] = useState<File | null>(null);
  const [instructionContent, setInstructionContent] = useState('');

  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel | null>(null);
  const [customLevel, setCustomLevel] = useState('');
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(['single_correct_mcq']);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [customDifficulty, setCustomDifficulty] = useState('');
  const [characteristics, setCharacteristics] = useState<QuestionCharacteristic[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [duration, setDuration] = useState(60);
  const [markCorrect, setMarkCorrect] = useState(4);
  const [markIncorrect, setMarkIncorrect] = useState(-1);
  const [markUnanswered, setMarkUnanswered] = useState(0);
  const [partialMarking, setPartialMarking] = useState(false);
  const [teacherInstructions, setTeacherInstructions] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [enablePYQ, setEnablePYQ] = useState(false);
  const [enableResearch, setEnableResearch] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [levelCategory, setLevelCategory] = useState<string>('school');

  // ── Handlers ──
  const handleFileUpload = useCallback(async (
    file: File,
    setFile: (f: File | null) => void,
    setContent: (c: string) => void,
  ) => {
    setFile(file);
    setProcessing(true);
    try {
      const text = await extractTextFromFile(file);
      setContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setProcessing(false);
    }
  }, []);

  const toggleCharacteristic = (c: QuestionCharacteristic) => {
    setCharacteristics(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const toggleQuestionType = (t: QuestionType) => {
    setQuestionTypes(prev => {
      if (t === 'mixed') return ['mixed'];
      const filtered = prev.filter(x => x !== 'mixed');
      return filtered.includes(t) ? filtered.filter(x => x !== t) : [...filtered, t];
    });
  };

  const handleGenerate = async () => {
    // Validate
    if (!selectedLevel) { setError('Please select an academic level'); return; }
    if (!subject && !customSubject) { setError('Please select or enter a subject'); return; }
    if (!studyContent && !syllabusContent) { setError('Please upload study material or a syllabus'); return; }

    const aiConfig = storage.getAIConfig();
    if (!aiConfig || !aiConfig.apiKey) {
      setError('AI provider not configured. Please go to Settings and add your API key.');
      return;
    }

    setError('');

    const examId = uuid();
    const documents: UploadedDocument[] = [];

    if (studyContent) {
      documents.push({
        id: uuid(),
        name: studyFile?.name || 'Study Material',
        type: 'study_material',
        mimeType: studyFile?.type || 'text/plain',
        size: studyFile?.size || studyContent.length,
        content: studyContent,
        uploadedAt: Date.now(),
      });
    }

    if (syllabusContent) {
      documents.push({
        id: uuid(),
        name: syllabusFile?.name || 'Syllabus',
        type: 'syllabus',
        mimeType: syllabusFile?.type || 'text/plain',
        size: syllabusFile?.size || syllabusContent.length,
        content: syllabusContent,
        uploadedAt: Date.now(),
      });
    }

    if (instructionContent || teacherInstructions) {
      documents.push({
        id: uuid(),
        name: instructionFile?.name || 'Instructions',
        type: 'instructions',
        mimeType: 'text/plain',
        size: (instructionContent + teacherInstructions).length,
        content: `${instructionContent}\n${teacherInstructions}`.trim(),
        uploadedAt: Date.now(),
      });
    }

    const finalSubject = customSubject || subject;
    const finalLevel = selectedLevel.id === 'custom' ? { ...selectedLevel, label: customLevel || 'Custom Level' } : selectedLevel;

    const config: ExamConfig = {
      id: examId,
      title: `${finalLevel.label} ${finalSubject} — ${DIFFICULTIES.find(d => d.value === difficulty)?.label || difficulty} Test`,
      level: finalLevel,
      subject: finalSubject,
      questionTypes,
      difficulty,
      customDifficulty: difficulty === 'custom' ? customDifficulty : undefined,
      characteristics,
      questionCount,
      duration,
      marking: {
        correct: markCorrect,
        incorrect: markIncorrect,
        unanswered: markUnanswered,
        partial: partialMarking,
      },
      enablePYQAnalysis: enablePYQ,
      enableResearch: enableResearch,
      enableMixed: questionTypes.includes('mixed'),
      enableExplanations: true,
      enableNegativeMarking: markIncorrect < 0,
      enablePartialMarking: partialMarking,
      additionalInstructions: additionalInstructions || undefined,
      teacherInstructions: (instructionContent + '\n' + teacherInstructions).trim() || undefined,
      visibility: 'private',
    };

    // Save the exam skeleton
    storage.saveExam({
      id: examId,
      config,
      questions: [],
      status: 'generating',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      documents,
      version: 1,
    });

    navigate(`/generating/${examId}`);
  };

  const filteredLevels = ACADEMIC_LEVELS.filter(l => l.category === levelCategory);

  return (
    <div className="create-page container animate-fade-in">
      <div className="create-header">
        <h1>Create Examination</h1>
        <p>Upload your material and configure the exam</p>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      <div className="create-form">
        {/* === SECTION: Upload Material === */}
        <div className="form-section">
          <h2 className="form-section-title"><FileText size={18} /> Study Material</h2>

          <div className="upload-area"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file, setStudyFile, setStudyContent);
            }}
          >
            <input
              type="file"
              id="study-upload"
              accept=".pdf,.txt,.text,.md,.doc,.docx"
              className="upload-input"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, setStudyFile, setStudyContent);
              }}
            />
            <label htmlFor="study-upload" className="upload-label">
              <Upload size={32} />
              <span className="upload-title">{studyFile ? studyFile.name : 'Upload Chapter / Study Material'}</span>
              <span className="upload-hint">PDF, TXT, or text documents • Drag & drop supported</span>
              {studyContent && (
                <span className="upload-success badge badge-success">✓ {studyContent.length.toLocaleString()} chars extracted</span>
              )}
            </label>
          </div>
        </div>

        {/* === SECTION: Optional Uploads === */}
        <div className="form-section">
          <h2 className="form-section-title"><BookOpen size={18} /> Optional Materials</h2>

          <div className="optional-uploads">
            <div className="upload-compact">
              <input
                type="file"
                id="syllabus-upload"
                accept=".pdf,.txt,.text,.md"
                className="upload-input"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, setSyllabusFile, setSyllabusContent);
                }}
              />
              <label htmlFor="syllabus-upload" className="btn btn-secondary">
                <Upload size={14} /> {syllabusFile ? syllabusFile.name : 'Upload Syllabus'}
              </label>
              {syllabusContent && <span className="badge badge-success">✓</span>}
            </div>

            <div className="upload-compact">
              <input
                type="file"
                id="instruction-upload"
                accept=".pdf,.txt,.text,.md"
                className="upload-input"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, setInstructionFile, setInstructionContent);
                }}
              />
              <label htmlFor="instruction-upload" className="btn btn-secondary">
                <Upload size={14} /> {instructionFile ? instructionFile.name : 'Upload Instructions'}
              </label>
              {instructionContent && <span className="badge badge-success">✓</span>}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 'var(--sp-4)' }}>
            <label className="label"><MessageSquare size={14} /> Teacher Instructions</label>
            <textarea
              className="textarea"
              placeholder="e.g., Do not ask questions from section 4.3. Focus only on numericals. Do not include derivations."
              value={teacherInstructions}
              onChange={e => setTeacherInstructions(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="label">Additional Instructions</label>
            <textarea
              className="textarea"
              placeholder="Any additional context or requirements for the exam..."
              value={additionalInstructions}
              onChange={e => setAdditionalInstructions(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* === SECTION: Academic Level === */}
        <div className="form-section">
          <h2 className="form-section-title">Academic Level</h2>

          <div className="level-tabs">
            {['school', 'competitive', 'college', 'custom'].map(cat => (
              <button
                key={cat}
                className={`chip ${levelCategory === cat ? 'active' : ''}`}
                onClick={() => setLevelCategory(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          <div className="level-grid">
            {filteredLevels.map(level => (
              <button
                key={level.id}
                className={`level-card ${selectedLevel?.id === level.id ? 'active' : ''}`}
                onClick={() => setSelectedLevel(level)}
              >
                <span className="level-label">{level.label}</span>
                {level.description && <span className="level-desc">{level.description}</span>}
              </button>
            ))}
          </div>

          {selectedLevel?.id === 'custom' && (
            <input
              className="input"
              placeholder="Enter your custom level..."
              value={customLevel}
              onChange={e => setCustomLevel(e.target.value)}
              style={{ marginTop: 'var(--sp-3)' }}
            />
          )}
        </div>

        {/* === SECTION: Subject === */}
        <div className="form-section">
          <h2 className="form-section-title">Subject</h2>
          <select
            className="select"
            value={subject}
            onChange={e => { setSubject(e.target.value); setCustomSubject(''); }}
          >
            <option value="">Select subject...</option>
            {SUBJECTS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="custom">Custom Subject</option>
          </select>
          {subject === 'custom' && (
            <input
              className="input"
              placeholder="Enter your subject..."
              value={customSubject}
              onChange={e => setCustomSubject(e.target.value)}
              style={{ marginTop: 'var(--sp-3)' }}
            />
          )}
        </div>

        {/* === SECTION: Exam Type === */}
        <div className="form-section">
          <h2 className="form-section-title">Question Types</h2>
          <div className="type-grid">
            {QUESTION_TYPES.map(t => (
              <button
                key={t.value}
                className={`type-card ${questionTypes.includes(t.value) ? 'active' : ''}`}
                onClick={() => toggleQuestionType(t.value)}
              >
                <span className="type-label">{t.label}</span>
                <span className="type-desc">{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* === SECTION: Difficulty === */}
        <div className="form-section">
          <h2 className="form-section-title">Difficulty</h2>
          <div className="difficulty-grid">
            {DIFFICULTIES.map(d => (
              <button
                key={d.value}
                className={`difficulty-card ${difficulty === d.value ? 'active' : ''}`}
                onClick={() => setDifficulty(d.value)}
                style={{ '--dc': d.color } as React.CSSProperties}
              >
                {d.label}
              </button>
            ))}
          </div>
          {difficulty === 'custom' && (
            <input
              className="input"
              placeholder="Describe your custom difficulty..."
              value={customDifficulty}
              onChange={e => setCustomDifficulty(e.target.value)}
              style={{ marginTop: 'var(--sp-3)' }}
            />
          )}
        </div>

        {/* === SECTION: Characteristics === */}
        <div className="form-section">
          <h2 className="form-section-title">Question Characteristics</h2>
          <p style={{ color: 'var(--c-text-muted)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
            Select multiple styles for richer examination quality
          </p>
          <div className="chars-grid">
            {QUESTION_CHARACTERISTICS.map(c => (
              <button
                key={c.value}
                className={`chip ${characteristics.includes(c.value) ? 'active' : ''}`}
                onClick={() => toggleCharacteristic(c.value)}
              >
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* === SECTION: Count & Duration === */}
        <div className="form-section">
          <h2 className="form-section-title">Exam Parameters</h2>
          <div className="params-grid">
            <div className="form-group">
              <label className="label">Number of Questions</label>
              <select className="select" value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}>
                {QUESTION_COUNTS.map(n => (
                  <option key={n} value={n}>{n} questions</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Duration (minutes)</label>
              <select className="select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                {EXAM_DURATIONS.map(d => (
                  <option key={d} value={d}>{d} min ({Math.floor(d / 60)}h {d % 60}m)</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* === SECTION: Marking === */}
        <div className="form-section">
          <h2 className="form-section-title">Marking Scheme</h2>
          <div className="marking-grid">
            <div className="form-group">
              <label className="label">Correct (+)</label>
              <input type="number" className="input" value={markCorrect}
                onChange={e => setMarkCorrect(Number(e.target.value))} min={0} />
            </div>
            <div className="form-group">
              <label className="label">Incorrect</label>
              <input type="number" className="input" value={markIncorrect}
                onChange={e => setMarkIncorrect(Number(e.target.value))} step={0.25} />
            </div>
            <div className="form-group">
              <label className="label">Unanswered</label>
              <input type="number" className="input" value={markUnanswered}
                onChange={e => setMarkUnanswered(Number(e.target.value))} />
            </div>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={partialMarking} onChange={e => setPartialMarking(e.target.checked)} />
            Enable partial marking for multiple-correct questions
          </label>
        </div>

        {/* === Advanced === */}
        <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Advanced Controls
        </button>

        {showAdvanced && (
          <div className="form-section animate-scale-in">
            <label className="checkbox-label">
              <input type="checkbox" checked={enablePYQ} onChange={e => setEnablePYQ(e.target.checked)} />
              Enable PYQ / Historical Exam Analysis
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={enableResearch} onChange={e => setEnableResearch(e.target.checked)} />
              Enable Source Research
            </label>
          </div>
        )}

        {/* === Generate Button === */}
        <button
          className="btn btn-primary btn-lg generate-btn"
          onClick={handleGenerate}
          disabled={processing}
        >
          <Sparkles size={20} />
          {processing ? 'Processing...' : 'Generate Examination'}
        </button>
      </div>
    </div>
  );
}
