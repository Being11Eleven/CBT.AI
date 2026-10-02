import { useEffect, useRef } from 'react';

interface HeroVisualProps {
  className?: string;
}

export default function HeroVisual({ className = '' }: HeroVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const isMobile = window.innerWidth < 768;
    const particleCount = prefersReducedMotion ? 20 : isMobile ? 65 : 190;

    interface Particle {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      baseAlpha: number;
      angle: number;
      speed: number;
      orbitRadius: number;
      focalNode: number; // 0: cognitive node, 1: evaluation node
      color: string;
    }

    const particles: Particle[] = [];
    const colors = [
      'rgba(56, 189, 248, ',  // Cyan/Electric Blue
      'rgba(99, 102, 241, ',  // Indigo
      'rgba(147, 197, 253, ', // Soft Ice Blue
      'rgba(168, 85, 247, ',  // Subtle Violet
      'rgba(248, 250, 252, ', // Pure starlight
    ];

    const initParticles = () => {
      particles.length = 0;
      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < particleCount; i++) {
        const focalNode = i % 2;
        const nodeOffsetX = focalNode === 0 ? -width * 0.12 : width * 0.12;
        const nodeOffsetY = focalNode === 0 ? -height * 0.05 : height * 0.05;

        const orbitRadius = Math.random() * (isMobile ? 140 : 280) + 30;
        const angle = Math.random() * Math.PI * 2;
        const color = colors[Math.floor(Math.random() * colors.length)];

        particles.push({
          x: centerX + nodeOffsetX + Math.cos(angle) * orbitRadius,
          y: centerY + nodeOffsetY + Math.sin(angle) * (orbitRadius * 0.55),
          baseX: centerX + nodeOffsetX,
          baseY: centerY + nodeOffsetY,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          size: Math.random() * 2 + 0.8,
          alpha: Math.random() * 0.65 + 0.2,
          baseAlpha: Math.random() * 0.65 + 0.2,
          angle,
          speed: (Math.random() * 0.003 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
          orbitRadius,
          focalNode,
          color,
        });
      }
    };

    initParticles();

    // Resize Handler
    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    // Mouse Interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.targetX = e.clientX - rect.left - width / 2;
      mouseRef.current.targetY = e.clientY - rect.top - height / 2;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    let time = 0;

    const render = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const parallaxX = mouseRef.current.x * 0.15;
      const parallaxY = mouseRef.current.y * 0.15;

      // Draw faint luminous focal gradients
      const focal1X = width / 2 - width * 0.1 + parallaxX;
      const focal1Y = height / 2 - height * 0.04 + parallaxY;
      const focal2X = width / 2 + width * 0.1 + parallaxX;
      const focal2Y = height / 2 + height * 0.04 + parallaxY;

      // Core ambient glow 1 (Cyan/Electric)
      const grad1 = ctx.createRadialGradient(focal1X, focal1Y, 0, focal1X, focal1Y, isMobile ? 180 : 340);
      grad1.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
      grad1.addColorStop(0.5, 'rgba(6, 182, 212, 0.02)');
      grad1.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      // Core ambient glow 2 (Indigo/Violet)
      const grad2 = ctx.createRadialGradient(focal2X, focal2Y, 0, focal2X, focal2Y, isMobile ? 200 : 380);
      grad2.addColorStop(0, 'rgba(99, 102, 241, 0.09)');
      grad2.addColorStop(0.5, 'rgba(99, 102, 241, 0.02)');
      grad2.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // Draw particles & delicate constellation lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          p.angle += p.speed;
          // Organic breathing wobble
          const wobble = Math.sin(time + i * 0.1) * 6;
          const currentRadius = p.orbitRadius + wobble;

          const baseNodeX = p.focalNode === 0 ? focal1X : focal2X;
          const baseNodeY = p.focalNode === 0 ? focal1Y : focal2Y;

          p.x = baseNodeX + Math.cos(p.angle) * currentRadius;
          p.y = baseNodeY + Math.sin(p.angle) * (currentRadius * 0.58);
        }

        // Draw particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fill();

        // Connect nearby particles within threshold
        const maxDist = isMobile ? 48 : 75;
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDist * maxDist) {
            const dist = Math.sqrt(distSq);
            const lineAlpha = (1 - dist / maxDist) * 0.18;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className={`hero-visual-container ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      {/* Subtle vignette layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(7, 8, 11, 0.85) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
