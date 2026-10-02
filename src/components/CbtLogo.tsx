interface CbtLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function CbtLogo({ size = 32, className = '', showText = false }: CbtLogoProps) {
  return (
    <div
      className={`cbt-logo-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.65rem',
        verticalAlign: 'middle',
      }}
    >
      <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <source srcSet="/cbt-logo.webp" type="image/webp" />
        <img
          src="/cbt-logo.png"
          alt="CBT.AI Official Emblem"
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            objectFit: 'contain',
            flexShrink: 0,
            display: 'block',
            filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))',
            transition: 'transform 0.25s ease',
          }}
          loading="eager"
        />
      </picture>

      {showText && (
        <span
          className="logo-brand"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#ffffff',
          }}
        >
          CBT<span style={{ color: '#d4af37' }}>.AI</span>
        </span>
      )}
    </div>
  );
}
