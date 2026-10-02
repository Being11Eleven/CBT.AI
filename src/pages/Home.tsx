import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Clock,
  CheckCircle2,
  Cpu,
  Layers,
  FileCheck2,
  Compass,
  ChevronRight,
  BookOpen,
  Target,
  Sliders,
  Award
} from 'lucide-react';
import HeroVisual from '../components/HeroVisual';
import CbtLogo from '../components/CbtLogo';
import MathText from '../components/MathText';
import './Home.css';

// ── Level Selector Data ──
const LEVEL_TIMELINE = [
  {
    id: 'school',
    badge: 'Secondary',
    label: 'Class 6 – 10',
    headline: 'Foundational Mastery & Conceptual Rigor',
    desc: 'Structured around NCERT, state boards, and fundamental logic. Tests whether students understand the mechanism behind the formula, not just memorization.',
    blueprint: {
      topics: 'Physics, Chemistry, Math, Biology',
      formats: 'Single MCQ • Numerical • Short Answer',
      duration: '45–90 min',
      difficulty: 'Easy to High-Order',
      calibration: 'School Board Standards',
    },
  },
  {
    id: 'senior',
    badge: 'Senior Secondary',
    label: 'Class 11 – 12',
    headline: 'Board Excellence & Competitive Transition',
    desc: 'Bridges deep theoretical proofs with numerical agility. Prepares students for CBSE/ISC board standards while establishing the analytical foundation for entrance exams.',
    blueprint: {
      topics: 'Advanced Calculus, Mechanics, Organic Synthesis',
      formats: 'Assertion-Reasoning • Multi-Part • Subjective',
      duration: '60–180 min',
      difficulty: 'Moderate to Rigorous',
      calibration: 'Pre-University Benchmarks',
    },
  },
  {
    id: 'jee',
    badge: 'Competitive Entrance',
    label: 'JEE Main & Advanced',
    headline: 'Extreme Analytical Depth & Multi-Concept Traps',
    desc: 'Engineered specifically for engineering aspirants. Synthesizes concepts across multiple chapters into single problems with strict negative marking.',
    blueprint: {
      topics: 'Electrodynamics, Complex Numbers, Chemical Energetics',
      formats: 'Multiple Correct • Integer Value • Matrix Match',
      duration: '180 min',
      difficulty: 'Severe / Olympiad Grade',
      calibration: 'NTA & IIT Examination Rubric',
    },
  },
  {
    id: 'neet',
    badge: 'Medical Entrance',
    label: 'NEET UG',
    headline: 'High-Velocity Accuracy & Comprehensive Recall',
    desc: 'Simulates the high-speed, 200-question pressure of medical entrance examinations with deep biological diagrams and precise numerical accuracy.',
    blueprint: {
      topics: 'Botany, Zoology, Organic Chemistry, Mechanics',
      formats: 'Single MCQ • Diagram Interpretation • Match Columns',
      duration: '200 min',
      difficulty: 'High Speed & Precision',
      calibration: 'NTA Medical Specification',
    },
  },
  {
    id: 'university',
    badge: 'Higher Education',
    label: 'University & Degree',
    headline: 'Advanced Technical & Disciplinary Papers',
    desc: 'From engineering semester midterms to economics and computer science modules. Generates university-standard examination papers tailored to syllabus documents.',
    blueprint: {
      topics: 'Computer Science, Electrical, Commerce, Humanities',
      formats: 'Subjective Rubric • Analytical • Problem Sets',
      duration: '60–180 min',
      difficulty: 'University Standard',
      calibration: 'Curriculum-Aligned Rubric',
    },
  },
];

// ── Question Intelligence Categories ──
const INTELLIGENCE_TAXONOMY = [
  {
    id: 'conceptual',
    title: 'Conceptual Foundations',
    tag: 'FIRST PRINCIPLES',
    desc: 'Isolates core axioms from calculation tricks. Identifies whether a student understands why an equation works.',
    sample: 'Which of the following conditions guarantees that a closed conservative system maintains zero entropy change during a non-cyclic process?',
  },
  {
    id: 'multi_concept',
    title: 'Multi-Concept Synthesis',
    tag: 'INTERDISCIPLINARY',
    desc: 'Merges distinct topics — e.g. Thermodynamics and Chemical Equilibrium — requiring students to navigate non-linear problem paths.',
    sample: 'A monoatomic ideal gas undergoes a polytropic expansion with $PV^{1.4} = C$. Calculate the net entropy flux when coupled to a heat reservoir.',
  },
  {
    id: 'misconception',
    title: 'Misconception Diagnostics',
    tag: 'DISTRACTOR RIGOR',
    desc: 'Distractors are crafted from real student errors — sign mistakes, boundary neglects, or false intuition — to reveal true weaknesses.',
    sample: 'A projectile is launched with velocity $v_0$ at angle $\\theta$. If air resistance is proportional to velocity, at what point is kinetic energy minimized?',
  },
  {
    id: 'numerical',
    title: 'Integer & Numerical Precision',
    tag: 'CALCULATION TOLERANCE',
    desc: 'Demands exact calculation without guessing. Evaluated deterministically with precision floating-point tolerance.',
    sample: 'Find the integer value of $\\lim_{x \\to 0} \\frac{\\tan(x) - \\sin(x)}{x^3}$.',
  },
];

export default function Home() {
  const [activeLevelIdx, setActiveLevelIdx] = useState(2); // Default to JEE
  const [activeTaxonomyIdx, setActiveTaxonomyIdx] = useState(1);
  const [activePipelineStage, setActivePipelineStage] = useState(3);

  const currentLevel = LEVEL_TIMELINE[activeLevelIdx];
  const currentTaxonomy = INTELLIGENCE_TAXONOMY[activeTaxonomyIdx];

  return (
    <div className="home-experience">
      {/* ============================================================
          SECTION 01: Full-Viewport Cinematic Hero
          ============================================================ */}
      <section className="hero-cinematic">
        {/* Interactive canvas particle field */}
        <HeroVisual className="hero-particles-layer" />

        <div className="hero-cinematic-inner container">
          <div className="hero-eyebrow-container animate-fade-in">
            <span className="eyebrow-pill">
              <span className="eyebrow-dot" />
              <span>THE AI EXAMINATION LABORATORY</span>
              <span className="eyebrow-version">v2.5</span>
            </span>
          </div>

          <h1 className="hero-massive-title animate-slide-up">
            Practice with purpose.
            <br />
            <span className="font-editorial hero-editorial-accent">
              Perform with authority.
            </span>
          </h1>

          <p className="hero-lead-text animate-slide-up" style={{ animationDelay: '0.12s' }}>
            Transform syllabus chapters, textbooks, and notes into rigorous,
            independently verified examinations. Experience an authentic proctored CBT
            environment across school, university, and competitive preparation.
          </p>

          <div className="hero-action-group animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link to="/create" className="btn btn-primary btn-lg hero-cta-btn">
              <span>Create Examination</span>
              <ArrowRight size={17} />
            </Link>
            <a href="#pipeline" className="btn btn-secondary btn-lg hero-secondary-btn">
              <Compass size={17} />
              <span>Explore How It Works</span>
            </a>
          </div>

          {/* Micro-proof indicator bar */}
          <div className="hero-proof-bar animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="proof-item">
              <ShieldCheck size={16} className="proof-icon text-cyan" />
              <span>Zero-Hallucination Protocol</span>
            </div>
            <div className="proof-separator" />
            <div className="proof-item">
              <Cpu size={16} className="proof-icon text-indigo" />
              <span>Dual-Pass Math Verification</span>
            </div>
            <div className="proof-separator" />
            <div className="proof-item">
              <Layers size={16} className="proof-icon text-champagne" />
              <span>Calibrated Difficulty Curves</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 02: "From Chapter to Examination" (Visual Pipeline)
          ============================================================ */}
      <section id="pipeline" className="section-pipeline container">
        <div className="section-header-editorial text-center">
          <span className="eyebrow">SYSTEM ARCHITECTURE</span>
          <h2 className="editorial-section-title">
            From raw chapter to <span className="font-editorial">rigorous examination.</span>
          </h2>
          <p className="editorial-section-desc">
            CBT.AI does not prompt generic chatbots for quizzes. It orchestrates a
            multi-phase pipeline to parse, blueprint, formulate, and independently check every question.
          </p>
        </div>

        <div className="pipeline-flow-container">
          <div className="pipeline-steps-rail">
            {[
              { id: 0, label: '01. Material Ingestion', sub: 'PDF, text, syllabus extraction' },
              { id: 1, label: '02. Cognitive Blueprinting', sub: 'Bloom taxonomy & weightage' },
              { id: 2, label: '03. Question Synthesis', sub: 'Multi-concept problem generation' },
              { id: 3, label: '04. Proof & Verification', sub: 'Deterministic LaTeX & math check' },
              { id: 4, label: '05. Real-Time CBT Engine', sub: 'Proctored test simulator' },
              { id: 5, label: '06. Diagnostic Insight', sub: 'Score, topic radar & errors' },
            ].map(step => (
              <button
                key={step.id}
                className={`pipeline-rail-btn ${activePipelineStage === step.id ? 'active' : ''}`}
                onClick={() => setActivePipelineStage(step.id)}
              >
                <div className="pipeline-rail-indicator" />
                <div className="pipeline-rail-text">
                  <span className="pipeline-rail-title">{step.label}</span>
                  <span className="pipeline-rail-sub">{step.sub}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="pipeline-visual-chamber">
            <div className="chamber-glow-bg" />
            <div className="chamber-card">
              {activePipelineStage === 0 && (
                <div className="chamber-content">
                  <div className="chamber-badge"><FileCheck2 size={15} /> STAGE 01</div>
                  <h3>Deep Document Parsing & Chunking</h3>
                  <p>
                    Your uploaded PDF, syllabus document, or teacher notes are parsed through our
                    multi-tier extraction engine. Tables, LaTeX formulas, and key chapter concepts
                    are indexed with semantic boundaries preserved.
                  </p>
                  <div className="chamber-demo-box">
                    <span className="demo-label">PARSED CHUNKS</span>
                    <code>✓ Thermodynamics_Ch4.pdf: 14 Concepts Extracted • 22 Equations Normalized</code>
                  </div>
                </div>
              )}
              {activePipelineStage === 1 && (
                <div className="chamber-content">
                  <div className="chamber-badge"><Sliders size={15} /> STAGE 02</div>
                  <h3>Cognitive Blueprint Formulation</h3>
                  <p>
                    Rather than random generation, the blueprinting engine maps out exact question
                    distributions: 40% Conceptual Foundations, 35% Multi-Step Calculations,
                    and 25% Higher-Order Thinking Skills (HOTS).
                  </p>
                  <div className="chamber-demo-box">
                    <span className="demo-label">BLUEPRINT CALIBRATION</span>
                    <code>Target Difficulty: JEE Advanced | Negative Marking: -1 | Time Allocation: 3.2m/Q</code>
                  </div>
                </div>
              )}
              {activePipelineStage === 2 && (
                <div className="chamber-content">
                  <div className="chamber-badge"><Zap size={15} /> STAGE 03</div>
                  <h3>High-Order Problem Synthesis</h3>
                  <p>
                    Specialized AI generation personas draft novel problems directly from the blueprint.
                    Questions feature rigorous problem statements, plausible mathematical distractors,
                    and comprehensive step-by-step solutions.
                  </p>
                  <div className="chamber-demo-box">
                    <span className="demo-label">SYNTHESIZED QUESTION</span>
                    <MathText text="Determine the magnetic flux $\Phi_B = \oint \vec{B} \cdot d\vec{A}$ across the closed toroidal boundary." />
                  </div>
                </div>
              )}
              {activePipelineStage === 3 && (
                <div className="chamber-content">
                  <div className="chamber-badge"><ShieldCheck size={15} /> STAGE 04</div>
                  <h3>Independent Verification & Rubric Check</h3>
                  <p>
                    Every question undergoes an autonomous validation pass. The engine recalculates
                    the mathematical proof, verifies that exactly one answer option is correct,
                    and inspects LaTeX formatting for zero visual errors.
                  </p>
                  <div className="chamber-demo-box">
                    <span className="demo-label">VERIFICATION PASSED</span>
                    <code>✓ LaTeX Valid • Unique Solution Verified • Bloom Level Confirmed (Application)</code>
                  </div>
                </div>
              )}
              {activePipelineStage === 4 && (
                <div className="chamber-content">
                  <div className="chamber-badge"><Clock size={15} /> STAGE 05</div>
                  <h3>Authentic Computer-Based Test Environment</h3>
                  <p>
                    Experience exam conditions matching genuine national examinations: countdown
                    clock, color-coded question palette, mark-for-review tags, auto-saving every keystroke,
                    and fullscreen integrity monitoring.
                  </p>
                  <div className="chamber-demo-box">
                    <span className="demo-label">CBT SESSION RUNNING</span>
                    <code>Time Remaining: 01:29:40 | Answered: 14 | Marked: 3 | Autosave: Synced</code>
                  </div>
                </div>
              )}
              {activePipelineStage === 5 && (
                <div className="chamber-content">
                  <div className="chamber-badge"><BarChart3 size={15} /> STAGE 06</div>
                  <h3>Deep Diagnostic & Misconception Report</h3>
                  <p>
                    Receive immediate, deep feedback. Compare time spent per question, uncover
                    conceptual traps that caught you, and review step-by-step master derivations
                    for every single problem.
                  </p>
                  <div className="chamber-demo-box">
                    <span className="demo-label">DIAGNOSTIC REPORT</span>
                    <code>Score: 88/100 (91st Percentile) • Weak Area: Rotational Dynamics (-6 marks)</code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 03: Editorial Warm Ivory / Cream World: How It Works
          ============================================================ */}
      <section className="section-editorial-world world-editorial">
        <div className="container">
          <div className="editorial-world-header">
            <span className="editorial-world-eyebrow">FOUR MOVEMENTS</span>
            <h2 className="editorial-world-title">
              Designed around how <br />
              <span className="font-editorial">serious students actually prepare.</span>
            </h2>
            <p className="editorial-world-lead">
              A streamlined, purposeful workflow. No tedious prompt engineering or manual
              formatting required — just your syllabus and your ambition.
            </p>
          </div>

          <div className="editorial-steps-grid">
            <div className="editorial-step-col">
              <span className="editorial-step-num">01</span>
              <h3 className="editorial-step-title">Supply the Territory</h3>
              <p className="editorial-step-text">
                Upload your chapter PDF, lecture notes, textbook excerpt, or curriculum syllabus.
                You can also include teacher notes and custom focus directives.
              </p>
            </div>

            <div className="editorial-step-col">
              <span className="editorial-step-num">02</span>
              <h3 className="editorial-step-title">Set the Parameters</h3>
              <p className="editorial-step-text">
                Select your academic standard, target difficulty, question formats (MCQ, numerical,
                multi-correct, subjective), and custom marking schemes including negative marks.
              </p>
            </div>

            <div className="editorial-step-col">
              <span className="editorial-step-num">03</span>
              <h3 className="editorial-step-title">Simulate the Test</h3>
              <p className="editorial-step-text">
                Enter a distraction-free, proctored examination console with authentic palette
                navigation, countdown timers, and LaTeX rendering.
              </p>
            </div>

            <div className="editorial-step-col">
              <span className="editorial-step-num">04</span>
              <h3 className="editorial-step-title">Diagnose & Advance</h3>
              <p className="editorial-step-text">
                Study your accuracy curves, time allocation metrics, and full step-by-step
                solutions to turn every mistake into permanent conceptual mastery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 04: "Built for Every Level" (Interactive Timeline)
          ============================================================ */}
      <section className="section-levels container">
        <div className="section-header-editorial text-center">
          <span className="eyebrow">ACADEMIC SPECTRUM</span>
          <h2 className="editorial-section-title">
            Built for <span className="font-editorial">every stage of study.</span>
          </h2>
          <p className="editorial-section-desc">
            Select your discipline to see how CBT.AI calibrates question rigor, formats,
            and evaluation standards.
          </p>
        </div>

        {/* Timeline selector */}
        <div className="levels-timeline-nav">
          {LEVEL_TIMELINE.map((lvl, index) => (
            <button
              key={lvl.id}
              className={`timeline-nav-pill ${activeLevelIdx === index ? 'active' : ''}`}
              onClick={() => setActiveLevelIdx(index)}
            >
              <span className="timeline-pill-badge">{lvl.badge}</span>
              <span className="timeline-pill-label">{lvl.label}</span>
            </button>
          ))}
        </div>

        {/* Active level blueprint preview */}
        <div className="level-card-display surface-elevated">
          <div className="level-card-left">
            <span className="level-card-tag">{currentLevel.badge}</span>
            <h3 className="level-card-heading">{currentLevel.headline}</h3>
            <p className="level-card-desc">{currentLevel.desc}</p>
            <Link to="/create" className="btn btn-primary btn-sm level-action-btn">
              <span>Configure {currentLevel.label} Exam</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="level-card-right">
            <div className="blueprint-box">
              <div className="blueprint-header">
                <span className="blueprint-title">EXAMINATION BLUEPRINT</span>
                <span className="badge badge-cyan">{currentLevel.label}</span>
              </div>
              <div className="blueprint-rows">
                <div className="blueprint-row">
                  <span className="blueprint-k">Subjects:</span>
                  <span className="blueprint-v">{currentLevel.blueprint.topics}</span>
                </div>
                <div className="blueprint-row">
                  <span className="blueprint-k">Question Formats:</span>
                  <span className="blueprint-v">{currentLevel.blueprint.formats}</span>
                </div>
                <div className="blueprint-row">
                  <span className="blueprint-k">Typical Duration:</span>
                  <span className="blueprint-v">{currentLevel.blueprint.duration}</span>
                </div>
                <div className="blueprint-row">
                  <span className="blueprint-k">Difficulty Target:</span>
                  <span className="blueprint-v">{currentLevel.blueprint.difficulty}</span>
                </div>
                <div className="blueprint-row">
                  <span className="blueprint-k">Standard:</span>
                  <span className="blueprint-v">{currentLevel.blueprint.calibration}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 05: Question Intelligence Taxonomy
          ============================================================ */}
      <section className="section-taxonomy container">
        <div className="section-header-editorial text-center">
          <span className="eyebrow">COGNITIVE RIGOR</span>
          <h2 className="editorial-section-title">
            Questions that test understanding, <br />
            <span className="font-editorial">not lucky guesses.</span>
          </h2>
          <p className="editorial-section-desc">
            CBT.AI avoids predictable rote questions. Every item is synthesized according
            to specific cognitive archetypes.
          </p>
        </div>

        <div className="taxonomy-interactive-layout">
          <div className="taxonomy-selector-col">
            {INTELLIGENCE_TAXONOMY.map((tax, idx) => (
              <div
                key={tax.id}
                className={`taxonomy-card ${activeTaxonomyIdx === idx ? 'active' : ''}`}
                onClick={() => setActiveTaxonomyIdx(idx)}
              >
                <div className="taxonomy-card-head">
                  <span className="taxonomy-tag">{tax.tag}</span>
                  <h4>{tax.title}</h4>
                </div>
                <p>{tax.desc}</p>
              </div>
            ))}
          </div>

          <div className="taxonomy-preview-col">
            <div className="taxonomy-preview-card surface-elevated">
              <div className="preview-top-bar">
                <span className="preview-label">SAMPLE SYNTHESIZED ITEM</span>
                <span className="badge badge-primary">{currentTaxonomy.tag}</span>
              </div>
              <div className="preview-question-body">
                <p className="preview-question-title">{currentTaxonomy.title} Demonstration</p>
                <div className="preview-math-box">
                  <MathText text={currentTaxonomy.sample} />
                </div>
              </div>
              <div className="preview-footer-intel">
                <div className="intel-pill">
                  <CheckCircle2 size={13} className="text-cyan" />
                  <span>Verified Deterministic Answer</span>
                </div>
                <div className="intel-pill">
                  <ShieldCheck size={13} className="text-indigo" />
                  <span>Cognitive Calibration: 99.4%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 06: Deep Verification Protocol (Inspection Demo)
          ============================================================ */}
      <section className="section-verification container">
        <div className="verification-card-hero surface-elevated">
          <div className="verification-header">
            <span className="eyebrow">QUALITY ASSURANCE PIPELINE</span>
            <h2 className="verification-title">
              The Autonomous <span className="font-editorial">Verification Protocol.</span>
            </h2>
            <p className="verification-desc">
              Before any examination is presented, every candidate question undergoes an
              automated multi-stage mathematical and rubric proof check.
            </p>
          </div>

          <div className="verification-pipeline-grid">
            <div className="v-step-box">
              <div className="v-step-icon"><Zap size={20} /></div>
              <h4>1. Generation</h4>
              <p>Problem statement formulated with verified technical notation.</p>
              <div className="v-status-tag tag-done">Drafted</div>
            </div>

            <div className="v-arrow-divider"><ChevronRight size={18} /></div>

            <div className="v-step-box">
              <div className="v-step-icon"><ShieldCheck size={20} /></div>
              <h4>2. Proof Check</h4>
              <p>Autonomous recalculation of solution steps to eliminate logic flaws.</p>
              <div className="v-status-tag tag-done">Validated</div>
            </div>

            <div className="v-arrow-divider"><ChevronRight size={18} /></div>

            <div className="v-step-box">
              <div className="v-step-icon"><FileCheck2 size={20} /></div>
              <h4>3. LaTeX Audit</h4>
              <p>Syntax rendering check ensures formulas render with zero errors.</p>
              <div className="v-status-tag tag-done">Audited</div>
            </div>

            <div className="v-arrow-divider"><ChevronRight size={18} /></div>

            <div className="v-step-box">
              <div className="v-step-icon"><Award size={20} /></div>
              <h4>4. Final Calibrated</h4>
              <p>Balanced against time constraints and marking scheme.</p>
              <div className="v-status-tag tag-certified">Certified Ready</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 07: The Examination Experience (Simulated CBT Window)
          ============================================================ */}
      <section className="section-cbt-demo container">
        <div className="section-header-editorial text-center">
          <span className="eyebrow">EXAMINATION INTERFACE</span>
          <h2 className="editorial-section-title">
            An authentic test environment — <br />
            <span className="font-editorial">not a quiz widget.</span>
          </h2>
          <p className="editorial-section-desc">
            Designed for genuine simulation. Serious students require realistic exam
            palettes, precision timers, autosave, and proctored integrity.
          </p>
        </div>

        {/* Mock CBT Examination Frame */}
        <div className="mock-cbt-window surface-elevated">
          {/* Top Bar */}
          <div className="mock-cbt-topbar">
            <div className="mock-cbt-title-info">
              <span className="mock-title">JEE Advanced Physics — Mechanics & Rotational Dynamics</span>
              <span className="mock-sub-info">Section 1: Multi-Correct Questions</span>
            </div>
            <div className="mock-timer-box">
              <Clock size={16} className="text-cyan" />
              <span className="mock-time font-mono">02:14:38</span>
            </div>
          </div>

          {/* Main Question Area + Palette */}
          <div className="mock-cbt-body">
            <div className="mock-question-pane">
              <div className="mock-q-header">
                <span className="badge badge-primary">Question 7 of 30</span>
                <span className="mock-marks-info font-mono">+4 / -2 Marking</span>
              </div>
              <div className="mock-q-text">
                <MathText text="A uniform disc of mass $M$ and radius $R$ is pivoted at its center. A small particle of mass $m = \frac{M}{2}$ collides elastically with the rim with speed $v_0$. Which of the following statements are correct immediately following the collision?" />
              </div>

              {/* Mock Answer Choices */}
              <div className="mock-options-list">
                <div className="mock-option-item selected">
                  <span className="opt-letter font-mono">A</span>
                  <MathText text="The angular velocity of the disc is $\omega = \frac{2v_0}{3R}$." />
                </div>
                <div className="mock-option-item selected">
                  <span className="opt-letter font-mono">B</span>
                  <MathText text="The total angular momentum about the center is strictly conserved." />
                </div>
                <div className="mock-option-item">
                  <span className="opt-letter font-mono">C</span>
                  <MathText text="The particle rebounds with speed $\frac{v_0}{2}$." />
                </div>
                <div className="mock-option-item">
                  <span className="opt-letter font-mono">D</span>
                  <MathText text="Kinetic energy is dissipated into thermal oscillations." />
                </div>
              </div>

              {/* Bottom Control Actions */}
              <div className="mock-cbt-actions">
                <button className="btn btn-secondary btn-sm">Previous</button>
                <button className="btn btn-secondary btn-sm">Mark for Review</button>
                <button className="btn btn-primary btn-sm">Save & Next</button>
              </div>
            </div>

            {/* Question Palette Sidebar */}
            <div className="mock-palette-pane">
              <div className="palette-legend">
                <div className="legend-item"><span className="legend-dot dot-answered" /> Answered (14)</div>
                <div className="legend-item"><span className="legend-dot dot-review" /> Marked (3)</div>
                <div className="legend-item"><span className="legend-dot dot-unvisited" /> Unvisited (13)</div>
              </div>
              <div className="palette-grid">
                {Array.from({ length: 30 }, (_, i) => {
                  const num = i + 1;
                  let status = 'unvisited';
                  if (num < 15 && num !== 7) status = 'answered';
                  if (num === 7) status = 'active';
                  if (num === 18 || num === 22 || num === 25) status = 'review';

                  return (
                    <div key={num} className={`palette-cell ${status} font-mono`}>
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 08: Performance Insights (Editorial Analytics)
          ============================================================ */}
      <section className="section-analytics container">
        <div className="section-header-editorial text-center">
          <span className="eyebrow">POST-EXAM INTELLIGENCE</span>
          <h2 className="editorial-section-title">
            Understand where you stand, <br />
            <span className="font-editorial">with clinical clarity.</span>
          </h2>
          <p className="editorial-section-desc">
            Evaluation goes far deeper than a raw percentage. Inspect topic strengths,
            speed efficiency, and habitual error patterns.
          </p>
        </div>

        <div className="analytics-editorial-grid">
          {/* Main Scorecard */}
          <div className="analytics-card-primary surface-elevated">
            <div className="analytics-score-top">
              <div>
                <span className="badge badge-success">EXAMINATION COMPLETED</span>
                <h3 className="score-hero-num font-mono">168 <span className="score-total">/ 200</span></h3>
                <p className="score-pct font-editorial">84% Accuracy • 94th Percentile</p>
              </div>
              <div className="circular-gauge-container">
                <svg viewBox="0 0 100 100" className="gauge-svg">
                  <circle cx="50" cy="50" r="42" className="gauge-bg" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="gauge-fill"
                    strokeDasharray="264"
                    strokeDashoffset="42"
                  />
                </svg>
                <div className="gauge-inner-label font-mono">84%</div>
              </div>
            </div>

            <div className="analytics-breakdown-row">
              <div className="breakdown-stat">
                <span className="b-val text-success font-mono">42</span>
                <span className="b-lbl">Correct</span>
              </div>
              <div className="breakdown-stat">
                <span className="b-val text-error font-mono">5</span>
                <span className="b-lbl">Incorrect</span>
              </div>
              <div className="breakdown-stat">
                <span className="b-val text-muted font-mono">3</span>
                <span className="b-lbl">Skipped</span>
              </div>
              <div className="breakdown-stat">
                <span className="b-val font-mono">1.8m</span>
                <span className="b-lbl">Avg / Question</span>
              </div>
            </div>
          </div>

          {/* Topic Performance Radar */}
          <div className="analytics-card-secondary surface-elevated">
            <h4>Topic Mastery Analysis</h4>
            <div className="topic-bars-list">
              {[
                { name: 'Classical Mechanics', score: 92, status: 'Mastered' },
                { name: 'Rotational Kinematics', score: 68, status: 'Needs Review' },
                { name: 'Fluid Statics & Dynamics', score: 85, status: 'Proficient' },
                { name: 'Wave Optics & Interference', score: 79, status: 'Proficient' },
              ].map(t => (
                <div key={t.name} className="topic-bar-item">
                  <div className="topic-bar-info">
                    <span className="topic-name">{t.name}</span>
                    <span className="topic-pct font-mono">{t.score}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${t.score}%`,
                        background: t.score < 70 ? 'var(--c-warning)' : 'var(--c-cyan)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 09: Final Cinematic Call to Action
          ============================================================ */}
      <section className="section-final-cta">
        <div className="final-cta-glow-mesh" />
        <div className="container final-cta-inner text-center">
          <span className="eyebrow">YOUR NEXT TEST AWAITS</span>
          <h2 className="final-cta-headline">
            Ready to see what you <br />
            <span className="font-editorial">truly understand?</span>
          </h2>
          <p className="final-cta-lead">
            Upload your first chapter or syllabus now. No credit card, no complex configuration.
            Generate your first examination in under two minutes.
          </p>
          <div className="final-cta-actions">
            <Link to="/create" className="btn btn-primary btn-lg hero-cta-btn">
              <span>Create Your Examination</span>
              <ArrowRight size={17} />
            </Link>
            <Link to="/my-exams" className="btn btn-secondary btn-lg">
              <BookOpen size={17} />
              <span>Review Past Attempts</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 10: Luxury Editorial Footer
          ============================================================ */}
      <footer className="footer-luxury">
        <div className="container footer-inner">
          <div className="footer-brand-col">
            <div className="footer-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <CbtLogo size={28} />
              <span className="logo-brand">CBT<span className="logo-dot-ai">.AI</span></span>
            </div>
            <p className="footer-mission-text">
              The autonomous examination laboratory. Built for learners, educators,
              and competitive candidates demanding rigorous self-assessment.
            </p>
            <div className="footer-status-pill font-mono">
              <span className="status-indicator-dot" />
              <span>Engine Status: Operational</span>
            </div>
          </div>

          <div className="footer-links-grid">
            <div className="footer-col">
              <h5>Platform</h5>
              <Link to="/create">Create Exam</Link>
              <Link to="/my-exams">My Examinations</Link>
              <Link to="/settings">System Settings</Link>
              <a href="#pipeline">Architecture</a>
            </div>

            <div className="footer-col">
              <h5>Academic Levels</h5>
              <span>Secondary (Class 6-10)</span>
              <span>Senior Secondary (11-12)</span>
              <span>JEE Main & Advanced</span>
              <span>NEET UG Medical</span>
              <span>University Semesters</span>
            </div>

            <div className="footer-col">
              <h5>Verification</h5>
              <span>Deterministic Checking</span>
              <span>LaTeX Math Validation</span>
              <span>Bloom Taxonomy Rigor</span>
              <span>Zero-Hallucination Core</span>
            </div>
          </div>
        </div>

        <div className="container footer-bottom-bar">
          <span className="footer-copy">
            © {new Date().getFullYear()} CBT.AI Examination Laboratory. All rights reserved.
          </span>
          <span className="footer-sub font-mono">
            ENGINEERED FOR RIGOROUS ASSESSMENT
          </span>
        </div>
      </footer>
    </div>
  );
}
