import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  BookOpen,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  FileUp,
  ArrowRight,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import {
  ACADEMIC_LEVELS,
  SUBJECTS,
  QUESTION_TYPES,
  DIFFICULTIES,
  QUESTION_CHARACTERISTICS,
  EXAM_DURATIONS,
  QUESTION_COUNTS
} from '../data/constants';
import { storage } from '../services/storage';
import type { ExamConfig, AcademicLevel, QuestionType, Difficulty, QuestionCharacteristic } from '../types';
import './CreateExam.css';

// Module-level file store so Generating page can access the File objects
// without storing binary data in localStorage
export const pendingFiles = new Map<string, File>();

export default function CreateExam() {
  const navigate = useNavigate();

  // ── State ──
  const [studyFile, setStudyFile] = useState<File | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [instructionFile, setInstructionFile] = useState<File | null>(null);
  const [instructionContent, setInstructionContent] = useState('');

  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel | null>(
    ACADEMIC_LEVELS.find(l => l.id === 'jee_advanced') || ACADEMIC_LEVELS[0]
  );
  const [customLevel, setCustomLevel] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [customSubject, setCustomSubject] = useState('');
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(['single_correct_mcq', 'multiple_correct_mcq']);
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [customDifficulty, setCustomDifficulty] = useState('');
  const [characteristics, setCharacteristics] = useState<QuestionCharacteristic[]>(['conceptual', 'reasoning']);
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
  const [levelCategory, setLevelCategory] = useState<string>('competitive');

  // ── Handlers ──
  const handleFileUpload = useCallback((
    file: File,
    setFile: (f: File | null) => void,
    _setContent?: (c: string) => void,
  ) => {
    setFile(file);
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
    if (!studyFile && !syllabusFile) { setError('Please upload study material or a syllabus document'); return; }

    setError('');
    setProcessing(true);

    const examId = uuid();

    // Store file references in sessionStorage for Generating page
    const fileRefs: Record<string, string> = {};
    if (studyFile) fileRefs.study_material_name = studyFile.name;
    if (syllabusFile) fileRefs.syllabus_name = syllabusFile.name;
    sessionStorage.setItem(`exam_files_${examId}`, JSON.stringify(fileRefs));

    // Store actual File objects
    if (studyFile) pendingFiles.set(`${examId}_study`, studyFile);
    if (syllabusFile) pendingFiles.set(`${examId}_syllabus`, syllabusFile);
    if (instructionFile) pendingFiles.set(`${examId}_instruction`, instructionFile);

    const finalSubject = customSubject || subject;
    const finalLevel = selectedLevel.id === 'custom' ? { ...selectedLevel, label: customLevel || 'Custom Level' } : selectedLevel;

    const config: ExamConfig = {
      id: examId,
      title: `${finalLevel.label} ${finalSubject} — ${DIFFICULTIES.find(d => d.value === difficulty)?.label || difficulty} Examination`,
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
      documents: [],
      version: 1,
    });

    navigate(`/generating/${examId}`);
  };

  const filteredLevels = ACADEMIC_LEVELS.filter(l => l.category === levelCategory);
  const isReady = (studyFile || syllabusFile) && selectedLevel && (subject || customSubject);

  return (
    <div className="create-studio-experience container-wide animate-fade-in">
      {/* Page Header */}
      <div className="studio-topbar">
        <div>
          <span className="eyebrow">EXAMINATION COMPILER</span>
          <h1 className="studio-title">
            Configure Your <span className="font-editorial">Examination.</span>
          </h1>
          <p className="studio-subtitle">
            Provide chapter text or syllabus, set difficulty parameters, and let the AI generate
            an independently verified examination paper.
          </p>
        </div>
      </div>

      {error && (
        <div className="error-banner animate-fade-in">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="error-close-btn" aria-label="Dismiss error">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Dual Pane Studio Layout */}
      <div className="studio-layout">
        {/* ============================================================
            LEFT PANE: Sticky Live Blueprint Preview Console
            ============================================================ */}
        <aside className="studio-blueprint-sidebar">
          <div className="blueprint-console surface-elevated">
            <div className="console-head">
              <div className="console-indicator">
                <span className={`status-dot ${isReady ? 'dot-ready' : 'dot-pending'}`} />
                <span className="console-tag font-mono">
                  {isReady ? 'BLUEPRINT COMPILED' : 'AWAITING PARAMETERS'}
                </span>
              </div>
              <span className="badge badge-cyan">{questionCount} Qs</span>
            </div>

            <div className="console-main-info">
              <span className="console-level-badge">{selectedLevel?.label || 'Select Level'}</span>
              <h3 className="console-exam-title">
                {customSubject || subject || 'Subject Undefined'}
              </h3>
              <p className="console-sub-detail">
                {DIFFICULTIES.find(d => d.value === difficulty)?.label || difficulty} Difficulty • {duration} Minutes
              </p>
            </div>

            <div className="console-specs-list">
              <div className="spec-row">
                <span className="spec-key">Material:</span>
                <span className="spec-val">
                  {studyFile ? studyFile.name.slice(0, 22) + (studyFile.name.length > 22 ? '...' : '') : 'None Uploaded'}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Types:</span>
                <span className="spec-val">{questionTypes.length} Selected</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Marking:</span>
                <span className="spec-val font-mono">+{markCorrect} / {markIncorrect}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Pacing:</span>
                <span className="spec-val font-mono">{(duration / questionCount).toFixed(1)}m / Q</span>
              </div>
            </div>

            {studyFile && (
              <div className="console-file-chip">
                <FileText size={14} className="text-cyan" />
                <span className="file-chip-name">{studyFile.name}</span>
                <span className="file-chip-size">{(studyFile.size / 1024).toFixed(0)} KB</span>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg console-submit-btn"
              onClick={handleGenerate}
              disabled={processing || !isReady}
            >
              <Sparkles size={18} />
              <span>{processing ? 'Compiling Paper...' : 'Generate Examination'}</span>
              <ArrowRight size={16} />
            </button>

            {!isReady && (
              <p className="console-hint font-mono">
                * Please upload chapter material and choose subject to compile.
              </p>
            )}
          </div>
        </aside>

        {/* ============================================================
            RIGHT PANE: Comprehensive Configuration Studio
            ============================================================ */}
        <div className="studio-config-main">
          {/* ── 01. STUDY MATERIAL UPLOAD ── */}
          <section className="studio-card surface-elevated">
            <div className="studio-card-header">
              <span className="card-step-badge font-mono">01</span>
              <div>
                <h2 className="studio-card-title">Study Material & Source Text</h2>
                <p className="studio-card-desc">
                  Upload the chapter PDF, lecture notes, textbook pages, or syllabus to generate questions from.
                </p>
              </div>
            </div>

            {/* Premium Drag and Drop Zone */}
            <div
              className={`luxury-dropzone ${studyFile ? 'has-file' : ''}`}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-active'); }}
              onDragLeave={e => e.currentTarget.classList.remove('drag-active')}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-active');
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file, setStudyFile);
              }}
            >
              <input
                type="file"
                id="study-upload-input"
                accept=".pdf,.txt,.text,.md,.doc,.docx"
                className="hidden-file-input"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, setStudyFile);
                }}
              />
              <label htmlFor="study-upload-input" className="dropzone-label">
                <div className="dropzone-icon-glow">
                  {studyFile ? <CheckCircle2 size={32} className="text-cyan" /> : <FileUp size={32} />}
                </div>
                <div className="dropzone-text-block">
                  <span className="dropzone-headline">
                    {studyFile ? studyFile.name : 'Click to upload or drag & drop chapter PDF'}
                  </span>
                  <span className="dropzone-hint">
                    Supports PDF, Markdown, TXT, DOCX • Up to 50MB
                  </span>
                </div>
                {studyFile && (
                  <div className="dropzone-active-pill">
                    <span className="badge badge-success">
                      ✓ Ready for parsing ({(studyFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      className="clear-file-btn"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStudyFile(null);
                      }}
                      aria-label="Remove uploaded file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </label>
            </div>

            {/* Optional secondary uploads */}
            <div className="secondary-uploads-row">
              <div className="compact-upload-tile">
                <input
                  type="file"
                  id="syllabus-upload"
                  accept=".pdf,.txt,.text,.md"
                  className="hidden-file-input"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, setSyllabusFile);
                  }}
                />
                <label htmlFor="syllabus-upload" className="compact-upload-label">
                  <BookOpen size={16} />
                  <span>{syllabusFile ? syllabusFile.name : 'Attach Syllabus / Topic Weightage (Optional)'}</span>
                  {syllabusFile && <CheckCircle2 size={15} className="text-cyan ml-auto" />}
                </label>
              </div>

              <div className="compact-upload-tile">
                <input
                  type="file"
                  id="instruction-upload"
                  accept=".pdf,.txt,.text,.md"
                  className="hidden-file-input"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, setInstructionFile, setInstructionContent);
                  }}
                />
                <label htmlFor="instruction-upload" className="compact-upload-label">
                  <MessageSquare size={16} />
                  <span>{instructionFile ? instructionFile.name : 'Attach Teacher Guidelines (Optional)'}</span>
                  {instructionFile && <CheckCircle2 size={15} className="text-cyan ml-auto" />}
                </label>
              </div>
            </div>

            {/* Teacher instructions textarea */}
            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label className="label">Custom Teacher Directives</label>
              <textarea
                className="textarea"
                placeholder="e.g. Do not include derivations. Focus strictly on numerical calculations and boundary conditions. Emphasize multi-step conservation laws."
                value={teacherInstructions}
                onChange={e => setTeacherInstructions(e.target.value)}
                rows={2}
              />
            </div>
          </section>

          {/* ── 02. ACADEMIC LEVEL ── */}
          <section className="studio-card surface-elevated">
            <div className="studio-card-header">
              <span className="card-step-badge font-mono">02</span>
              <div>
                <h2 className="studio-card-title">Academic Level & Standard</h2>
                <p className="studio-card-desc">
                  Calibrates the expected mathematical rigor, notation depth, and Bloom's taxonomy.
                </p>
              </div>
            </div>

            {/* Category segmented filter */}
            <div className="category-segmented-bar">
              {[
                { id: 'school', label: 'School (Class 6-10)' },
                { id: 'competitive', label: 'Competitive (JEE / NEET)' },
                { id: 'college', label: 'Higher Ed & Degree' },
                { id: 'custom', label: 'Custom Specification' },
              ].map(cat => (
                <button
                  key={cat.id}
                  className={`segmented-btn ${levelCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setLevelCategory(cat.id)}
                  type="button"
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Level selection cards */}
            <div className="level-selection-grid">
              {filteredLevels.map(level => (
                <div
                  key={level.id}
                  className={`level-tile ${selectedLevel?.id === level.id ? 'selected' : ''}`}
                  onClick={() => setSelectedLevel(level)}
                >
                  <span className="level-tile-name">{level.label}</span>
                  {level.description && (
                    <span className="level-tile-sub">{level.description}</span>
                  )}
                </div>
              ))}
            </div>

            {selectedLevel?.id === 'custom' && (
              <input
                className="input"
                placeholder="Enter custom academic level..."
                value={customLevel}
                onChange={e => setCustomLevel(e.target.value)}
                style={{ marginTop: '1rem' }}
              />
            )}
          </section>

          {/* ── 03. SUBJECT SELECTION ── */}
          <section className="studio-card surface-elevated">
            <div className="studio-card-header">
              <span className="card-step-badge font-mono">03</span>
              <div>
                <h2 className="studio-card-title">Subject & Domain</h2>
                <p className="studio-card-desc">Select the primary scientific or academic discipline.</p>
              </div>
            </div>

            <div className="subject-grid-select">
              <select
                className="select"
                value={subject}
                onChange={e => { setSubject(e.target.value); setCustomSubject(''); }}
              >
                <option value="">Select discipline...</option>
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="custom">Custom Discipline / Cross-Departmental</option>
              </select>

              {subject === 'custom' && (
                <input
                  className="input"
                  placeholder="Enter custom subject name..."
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  style={{ marginTop: '0.85rem' }}
                />
              )}
            </div>
          </section>

          {/* ── 04. QUESTION TYPES & DIFFICULTY ── */}
          <section className="studio-card surface-elevated">
            <div className="studio-card-header">
              <span className="card-step-badge font-mono">04</span>
              <div>
                <h2 className="studio-card-title">Question Typology & Difficulty</h2>
                <p className="studio-card-desc">Choose candidate formats and target cognitive difficulty.</p>
              </div>
            </div>

            {/* Question Types */}
            <div className="form-group">
              <label className="label">Question Typology (Multiple Permitted)</label>
              <div className="types-interactive-grid">
                {QUESTION_TYPES.map(t => {
                  const isSelected = questionTypes.includes(t.value);
                  return (
                    <div
                      key={t.value}
                      className={`type-tile ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleQuestionType(t.value)}
                    >
                      <div className="type-tile-header">
                        <span className="type-tile-title">{t.label}</span>
                        {isSelected && <CheckCircle2 size={16} className="text-cyan" />}
                      </div>
                      <span className="type-tile-desc">{t.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Difficulty Calibration */}
            <div className="form-group" style={{ marginTop: '1.75rem' }}>
              <label className="label">Target Difficulty Curve</label>
              <div className="difficulty-segmented-row">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    className={`diff-btn ${difficulty === d.value ? 'selected' : ''}`}
                    onClick={() => setDifficulty(d.value)}
                    style={{ '--diff-color': d.color } as React.CSSProperties}
                  >
                    <span>{d.label}</span>
                  </button>
                ))}
              </div>
              {difficulty === 'custom' && (
                <input
                  className="input"
                  placeholder="Describe target difficulty profile..."
                  value={customDifficulty}
                  onChange={e => setCustomDifficulty(e.target.value)}
                  style={{ marginTop: '0.85rem' }}
                />
              )}
            </div>

            {/* Characteristics */}
            <div className="form-group" style={{ marginTop: '1.75rem' }}>
              <label className="label">Cognitive Characteristics (Multi-Select)</label>
              <div className="characteristics-chips-wrap">
                {QUESTION_CHARACTERISTICS.map(c => {
                  const isActive = characteristics.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      className={`chip ${isActive ? 'active' : ''}`}
                      onClick={() => toggleCharacteristic(c.value)}
                    >
                      <span>{c.icon}</span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── 05. PARAMETERS & MARKING ── */}
          <section className="studio-card surface-elevated">
            <div className="studio-card-header">
              <span className="card-step-badge font-mono">05</span>
              <div>
                <h2 className="studio-card-title">Duration, Volume & Marking Rules</h2>
                <p className="studio-card-desc">Set question count, time limits, and negative scoring.</p>
              </div>
            </div>

            <div className="params-row-grid">
              <div className="form-group">
                <label className="label">Question Volume</label>
                <select
                  className="select"
                  value={questionCount}
                  onChange={e => setQuestionCount(Number(e.target.value))}
                >
                  {QUESTION_COUNTS.map(n => (
                    <option key={n} value={n}>{n} Questions</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Time Allocation</label>
                <select
                  className="select"
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                >
                  {EXAM_DURATIONS.map(d => (
                    <option key={d} value={d}>{d} min ({Math.floor(d / 60)}h {d % 60}m)</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Marking scheme */}
            <div className="marking-scheme-box">
              <label className="label">Scoring Metrics</label>
              <div className="marking-inputs-row">
                <div className="marking-field">
                  <span className="marking-k">Correct (+)</span>
                  <input
                    type="number"
                    className="input font-mono"
                    value={markCorrect}
                    onChange={e => setMarkCorrect(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className="marking-field">
                  <span className="marking-k">Incorrect (-)</span>
                  <input
                    type="number"
                    className="input font-mono"
                    value={markIncorrect}
                    onChange={e => setMarkIncorrect(Number(e.target.value))}
                    step={0.25}
                  />
                </div>
                <div className="marking-field">
                  <span className="marking-k">Unanswered</span>
                  <input
                    type="number"
                    className="input font-mono"
                    value={markUnanswered}
                    onChange={e => setMarkUnanswered(Number(e.target.value))}
                  />
                </div>
              </div>

              <label className="checkbox-control">
                <input
                  type="checkbox"
                  checked={partialMarking}
                  onChange={e => setPartialMarking(e.target.checked)}
                />
                <span>Enable proportional partial marking for multi-correct questions</span>
              </label>
            </div>

            {/* Advanced toggle */}
            <button
              type="button"
              className="advanced-studio-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>Advanced Verification Protocols</span>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div className="advanced-options-drawer animate-fade-in">
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={enablePYQ}
                    onChange={e => setEnablePYQ(e.target.checked)}
                  />
                  <span>Perform Historical PYQ Pattern Calibration</span>
                </label>
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={enableResearch}
                    onChange={e => setEnableResearch(e.target.checked)}
                  />
                  <span>Activate Independent Cross-Source Validation</span>
                </label>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
