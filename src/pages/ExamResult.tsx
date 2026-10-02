import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, CheckCircle2, XCircle, MinusCircle, Clock, Target, TrendingUp, AlertTriangle, BookOpen, ChevronDown } from 'lucide-react';
import { storage } from '../services/storage';
import MathText from '../components/MathText';
import type { ExamResult as ExamResultType, QuestionResult } from '../types';
import './ExamResult.css';

export default function ExamResult() {
  const { resultId } = useParams<{ resultId: string }>();
  const result = resultId ? storage.getResult(resultId) : null;

  if (!result) {
    return (
      <div className="container" style={{ padding: 'var(--sp-20) 0', textAlign: 'center' }}>
        <h2>Result Not Found</h2>
        <Link to="/my-exams" className="btn btn-secondary" style={{ marginTop: 'var(--sp-4)' }}>Back</Link>
      </div>
    );
  }

  const getScoreColor = (pct: number) =>
    pct >= 80 ? 'var(--c-success)' : pct >= 60 ? 'var(--c-primary)' : pct >= 40 ? 'var(--c-warning)' : 'var(--c-error)';

  const getStatusIcon = (r: QuestionResult) => {
    switch (r.status) {
      case 'correct': return <CheckCircle2 size={18} className="status-correct" />;
      case 'incorrect': return <XCircle size={18} className="status-incorrect" />;
      case 'partial': return <MinusCircle size={18} className="status-partial" />;
      default: return <MinusCircle size={18} className="status-unanswered" />;
    }
  };

  return (
    <div className="result-page container animate-fade-in">
      <Link to="/my-exams" className="btn btn-ghost" style={{ marginBottom: 'var(--sp-4)' }}>
        <ArrowLeft size={16} /> Back to Exams
      </Link>

      {/* Score Hero */}
      <div className="result-hero">
        <div className="score-circle" style={{ '--score-color': getScoreColor(result.percentage) } as React.CSSProperties}>
          <Trophy size={28} />
          <span className="score-value">{result.totalMarks}</span>
          <span className="score-max">/ {result.maxMarks}</span>
        </div>
        <div className="score-details">
          <h1 className="score-percentage" style={{ color: getScoreColor(result.percentage) }}>
            {result.percentage}%
          </h1>
          <p className="score-subtitle">
            {result.percentage >= 80 ? 'Excellent Performance!' :
             result.percentage >= 60 ? 'Good Performance' :
             result.percentage >= 40 ? 'Needs Improvement' :
             'Keep Practicing'}
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="result-stats">
        <div className="result-stat correct">
          <CheckCircle2 size={20} />
          <span className="rstat-num">{result.correct}</span>
          <span className="rstat-label">Correct</span>
        </div>
        <div className="result-stat incorrect">
          <XCircle size={20} />
          <span className="rstat-num">{result.incorrect}</span>
          <span className="rstat-label">Incorrect</span>
        </div>
        <div className="result-stat unanswered">
          <MinusCircle size={20} />
          <span className="rstat-num">{result.unanswered}</span>
          <span className="rstat-label">Unanswered</span>
        </div>
        <div className="result-stat time">
          <Clock size={20} />
          <span className="rstat-num">{Math.floor(result.totalTime / 60)}m</span>
          <span className="rstat-label">Time Used</span>
        </div>
        <div className="result-stat accuracy">
          <Target size={20} />
          <span className="rstat-num">{result.accuracy}%</span>
          <span className="rstat-label">Accuracy</span>
        </div>
        <div className="result-stat avg">
          <TrendingUp size={20} />
          <span className="rstat-num">{result.averageTimePerQuestion}s</span>
          <span className="rstat-label">Avg/Question</span>
        </div>
      </div>

      {/* Topic Performance */}
      {result.topicPerformance.length > 0 && (
        <div className="result-section">
          <h2><BookOpen size={18} /> Topic-wise Performance</h2>
          <div className="topic-list">
            {result.topicPerformance.map((tp, i) => (
              <div key={i} className="topic-item">
                <div className="topic-info">
                  <span className="topic-name">{tp.topic}</span>
                  <span className="topic-score">{tp.correct}/{tp.total} ({Math.round(tp.accuracy)}%)</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${tp.accuracy}%`,
                    background: tp.accuracy >= 70 ? 'var(--c-success)' : tp.accuracy >= 40 ? 'var(--c-warning)' : 'var(--c-error)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Characteristic Performance */}
      {result.characteristicPerformance.length > 0 && (
        <div className="result-section">
          <h2><Target size={18} /> Characteristic-wise Performance</h2>
          <div className="topic-list">
            {result.characteristicPerformance.map((cp, i) => (
              <div key={i} className="topic-item">
                <div className="topic-info">
                  <span className="topic-name" style={{ textTransform: 'capitalize' }}>{cp.characteristic.replace(/_/g, ' ')}</span>
                  <span className="topic-score">{cp.correct}/{cp.total} ({Math.round(cp.accuracy)}%)</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${cp.accuracy}%`,
                    background: cp.accuracy >= 70 ? 'var(--c-success)' : cp.accuracy >= 40 ? 'var(--c-warning)' : 'var(--c-error)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weakness Analysis */}
      {result.weaknessAnalysis.length > 0 && (
        <div className="result-section weakness-section">
          <h2><AlertTriangle size={18} /> Weakness Analysis</h2>
          <div className="weakness-list">
            {result.weaknessAnalysis.map((w, i) => (
              <div key={i} className="weakness-item">
                <AlertTriangle size={14} />
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question-by-Question */}
      <div className="result-section">
        <h2>Detailed Question Analysis</h2>
        <div className="questions-result-list">
          {result.questionResults.map((qr, i) => (
            <details key={qr.questionId} className={`qr-card ${qr.status}`}>
              <summary className="qr-summary">
                <div className="qr-left">
                  {getStatusIcon(qr)}
                  <span className="qr-num">Q{qr.questionIndex}</span>
                  <span className="qr-marks">{qr.marksObtained}/{qr.maxMarks}</span>
                </div>
                <div className="qr-right">
                  <span className={`badge badge-${qr.status === 'correct' ? 'success' : qr.status === 'incorrect' ? 'error' : qr.status === 'partial' ? 'warning' : 'info'}`}>
                    {qr.status}
                  </span>
                  <ChevronDown size={14} className="qr-chevron" />
                </div>
              </summary>

              <div className="qr-detail">
                <div className="qr-question">
                  <MathText text={qr.questionText} />
                </div>

                <div className="qr-answers">
                  <div className="qr-answer-row">
                    <span className="qr-label">Your Answer:</span>
                    <span className={`qr-value ${qr.status === 'correct' ? 'correct' : 'incorrect'}`}>
                      {qr.studentAnswer || '(Not answered)'}
                    </span>
                  </div>
                  <div className="qr-answer-row">
                    <span className="qr-label">Correct Answer:</span>
                    <span className="qr-value correct">
                      <MathText text={qr.correctAnswer} />
                    </span>
                  </div>
                </div>

                {qr.status !== 'correct' && qr.whatShouldHaveBeenWritten && (
                  <div className="qr-should-written">
                    <h4>📝 What You Should Have Written</h4>
                    <div className="qr-expected">
                      <MathText text={qr.whatShouldHaveBeenWritten} />
                    </div>
                  </div>
                )}

                {qr.whyIncorrect && (
                  <div className="qr-why-wrong">
                    <h4>❌ Why It's Wrong</h4>
                    <p>{qr.whyIncorrect}</p>
                  </div>
                )}

                <div className="qr-explanation">
                  <h4>💡 Explanation</h4>
                  <MathText text={qr.explanation} />
                </div>

                {qr.commonMisconception && (
                  <div className="qr-misconception">
                    <h4>⚠️ Common Misconception</h4>
                    <p>{qr.commonMisconception}</p>
                  </div>
                )}

                {qr.rubricEvaluation && (
                  <div className="qr-rubric">
                    <h4>📊 Rubric Evaluation ({qr.rubricEvaluation.obtained}/{qr.rubricEvaluation.totalMarks})</h4>
                    <div className="rubric-components">
                      {qr.rubricEvaluation.components.map((comp, j) => (
                        <div key={j} className="rubric-row">
                          <span>{comp.name}</span>
                          <span>{comp.obtained}/{comp.maxMarks}</span>
                          <span className="rubric-feedback">{comp.feedback}</span>
                        </div>
                      ))}
                    </div>
                    {qr.rubricEvaluation.suggestedImprovement && (
                      <p className="rubric-improve"><strong>Improvement:</strong> {qr.rubricEvaluation.suggestedImprovement}</p>
                    )}
                  </div>
                )}

                <div className="qr-meta">
                  <span>Topic: {qr.conceptTested}</span>
                  <span>Time: {qr.timeSpent}s</span>
                  <span>Difficulty: {qr.difficulty}</span>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
