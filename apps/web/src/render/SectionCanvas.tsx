import { useEffect, useRef, useState } from 'react';
import { drawSection } from './drawSection';
import type { Scene } from './scene';

const SECTION_HEIGHT_PX = 420;

/** Lienzo de la sección: se adapta al ancho del contenedor (ResizeObserver) y usa devicePixelRatio. */
export function SectionCanvas({ scene }: { scene: Scene }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.floor(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(SECTION_HEIGHT_PX * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawSection(ctx, width, SECTION_HEIGHT_PX, dpr, scene);
  }, [scene, width]);

  return (
    <div ref={wrapRef} className="section-wrap">
      <canvas
        ref={canvasRef}
        className="section-canvas"
        style={{ width: '100%', height: SECTION_HEIGHT_PX }}
        role="img"
        aria-label="Sección del talud con superficie crítica y dovelas"
      />
    </div>
  );
}
