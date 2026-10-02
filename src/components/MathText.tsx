import { useEffect, useRef } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

export default function MathText({ text, className }: MathTextProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !text) return;

    // Process text: replace $$...$$ and $...$ with rendered KaTeX
    let html = text;

    // Display math: $$...$$
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      } catch { return `<span class="math-error">${math}</span>`; }
    });

    // Inline math: $...$
    html = html.replace(/\$([^$]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      } catch { return `<span class="math-error">${math}</span>`; }
    });

    // Convert \n to <br>
    html = html.replace(/\n/g, '<br/>');

    ref.current.innerHTML = html;
  }, [text]);

  return <div ref={ref} className={className} />;
}
