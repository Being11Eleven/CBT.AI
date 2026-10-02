import { useEffect, useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import CbtLogo from './CbtLogo';
import './CinematicIntro.css';

interface CinematicIntroProps {
  onComplete: () => void;
}

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const [phase, setPhase] = useState<number>(0);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  const handleFinish = useCallback(() => {
    try {
      sessionStorage.setItem('cbtai_intro_seen', 'true');
    } catch {
      // storage quota or incognito fallback
    }
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  }, [onComplete]);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      handleFinish();
      return;
    }

    // Check if already viewed in this session
    try {
      if (sessionStorage.getItem('cbtai_intro_seen') === 'true') {
        onComplete();
        return;
      }
    } catch {
      // ignore
    }

    const t1 = setTimeout(() => setPhase(1), 700);    // Light fragments align
    const t2 = setTimeout(() => setPhase(2), 1700);   // CBT.AI logo reveal
    const t3 = setTimeout(() => setPhase(3), 2700);   // Editorial tagline
    const t4 = setTimeout(() => handleFinish(), 4100);// Complete & transition

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [handleFinish, onComplete]);

  return (
    <div className={`cinematic-intro ${isFadingOut ? 'fade-out' : ''}`}>
      <button
        className="intro-skip-btn"
        onClick={handleFinish}
        aria-label="Skip introduction animation"
      >
        <span>Skip intro</span>
        <ArrowRight size={13} />
      </button>

      {/* Ambient background particles & luminous aura */}
      <div className="intro-light-field">
        <div className={`intro-orb orb-primary ${phase >= 1 ? 'orb-active' : ''}`} />
        <div className={`intro-orb orb-cyan ${phase >= 1 ? 'orb-active' : ''}`} />
      </div>

      <div className="intro-stage">
        {/* Canonical Emblem transformation */}
        <div className={`intro-emblem ${phase >= 1 ? 'revealed' : ''}`}>
          <CbtLogo size={96} />
        </div>

        {/* Brand name */}
        <div className={`intro-brand ${phase >= 2 ? 'revealed' : ''}`}>
          <span className="intro-wordmark">
            CBT<span className="intro-wordmark-ai">.AI</span>
          </span>
        </div>

        {/* Editorial Subtitle */}
        <div className={`intro-tagline ${phase >= 3 ? 'revealed' : ''}`}>
          <p className="intro-statement">Your intelligent examination workspace.</p>
          <p className="intro-substatement font-editorial">
            Prepare with precision. Test with purpose.
          </p>
        </div>
      </div>
    </div>
  );
}
