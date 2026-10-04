import React, { useEffect, useRef } from 'react';

export interface ShapeWavesProps {
  text?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  textSize?: number;
  shapes?: 'mixed' | 'squares' | 'circles' | 'triangles';
  cellSize?: number;
  dotSize?: number;
  color?: string;
  hoverColor?: string;
  backgroundColor?: string;
  speed?: number;
  scale?: number;
  contrast?: number;
  brightness?: number;
  flow?: number;
  direction?: number;
  fade?: number;
  interactive?: boolean;
  splashRadius?: number;
  splashStrength?: number;
  glow?: number;
  intro?: boolean;
  introDuration?: number;
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function ShapeWaves({
  text = '',
  fontFamily = 'Geist, "Geist Sans", system-ui, sans-serif',
  fontWeight = 500,
  textSize = 0.6,
  shapes = 'mixed',
  cellSize = 12,
  dotSize = 0.75,
  color = '#0EA5E9',
  hoverColor = '#38BDF8',
  backgroundColor = 'transparent',
  speed = 1,
  scale = 1,
  contrast = 1,
  brightness = 0.5,
  flow = 0,
  direction = 0,
  fade = 0.25,
  interactive = true,
  splashRadius = 40,
  splashStrength = 0.4,
  glow = 0.35,
  intro = true,
  introDuration = 1.6,
  paused = false,
  className = '',
  style = {},
}: ShapeWavesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean; prevX: number; prevY: number }>({
    x: -1000,
    y: -1000,
    active: false,
    prevX: -1000,
    prevY: -1000,
  });
  const startTimeRef = useRef<number>(performance.now());
  const animFrameRef = useRef<number>(0);

  // Parse color hex to RGB
  const parseHex = (hex: string) => {
    if (!hex || hex === 'transparent') return { r: 18, g: 15, b: 23 };
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };

  const primaryRgb = parseHex(color);
  const hoverRgb = parseHex(hoverColor);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(rect.width, 300);
      height = Math.max(rect.height, 300);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Mouse movement tracking
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.prevX = mouseRef.current.x;
      mouseRef.current.prevY = mouseRef.current.y;
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Dynamic running circles state (circles running in background across pages)
    const runningCircles = [
      { xPct: 0.25, yPct: 0.35, speed: 0.00045, maxRadius: 520, phase: 0 },
      { xPct: 0.75, yPct: 0.65, speed: 0.00035, maxRadius: 680, phase: Math.PI },
      { xPct: 0.5, yPct: 0.5, speed: 0.0005, maxRadius: 440, phase: Math.PI * 0.5 },
      { xPct: 0.85, yPct: 0.2, speed: 0.0004, maxRadius: 580, phase: Math.PI * 1.5 },
    ];

    let running = true;

    const render = (timeNow: number) => {
      if (!running) return;

      if (!paused) {
        ctx.save();
        ctx.scale(dpr, dpr);

        // Background fill
        if (backgroundColor && backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.clearRect(0, 0, width, height);
        }

        const elapsed = (timeNow - startTimeRef.current) * 0.001 * speed;
        const introElapsed = (timeNow - startTimeRef.current) * 0.001;
        const introFactor = intro
          ? Math.min(1, introElapsed / Math.max(0.1, introDuration))
          : 1;

        // Effective grid calculations
        const actualCell = Math.max(8, cellSize * scale);
        const cols = Math.ceil(width / actualCell) + 1;
        const rows = Math.ceil(height / actualCell) + 1;
        const baseRadius = (actualCell * 0.45 * dotSize);

        // Precompute running circles current positions & radii
        const activeWaveRings = runningCircles.map((rc) => {
          const cx = width * rc.xPct + Math.sin(elapsed * 0.5 + rc.phase) * 60;
          const cy = height * rc.yPct + Math.cos(elapsed * 0.4 + rc.phase) * 45;
          const cycle = ((elapsed * rc.speed * 1000 + rc.phase) % (Math.PI * 2)) / (Math.PI * 2);
          const currentRadius = cycle * rc.maxRadius;
          const intensity = Math.sin(cycle * Math.PI); // fades in and out smoothly
          return { cx, cy, radius: currentRadius, intensity };
        });

        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const isMouseActive = mouseRef.current.active;
        const splashRad = splashRadius * scale;

        // Render each shape on the grid
        for (let r = 0; r < rows; r++) {
          const cy = r * actualCell;
          for (let c = 0; c < cols; c++) {
            const cx = c * actualCell;

            // Wave pattern calculation
            const waveX = cx * 0.012 + elapsed * (0.8 + flow * 0.5);
            const waveY = cy * 0.015 - elapsed * 0.6;
            const dirAngle = (direction * Math.PI) / 180;
            const rotX = cx * Math.cos(dirAngle) - cy * Math.sin(dirAngle);
            const waveVal =
              Math.sin(rotX * 0.008 + elapsed * 1.2) * 0.5 +
              Math.cos(waveX * 1.5 + waveY * 1.2) * 0.5;

            // Running circle waves influence
            let circleBoost = 0;
            for (let i = 0; i < activeWaveRings.length; i++) {
              const ring = activeWaveRings[i];
              const distToRing = Math.hypot(cx - ring.cx, cy - ring.cy);
              const ringThickness = 65;
              const diff = Math.abs(distToRing - ring.radius);
              if (diff < ringThickness) {
                const ringFactor = 1 - diff / ringThickness;
                circleBoost = Math.max(circleBoost, ringFactor * ring.intensity);
              }
            }

            // Mouse splash influence
            let mouseBoost = 0;
            if (isMouseActive) {
              const mDist = Math.hypot(cx - mx, cy - my);
              if (mDist < splashRad) {
                mouseBoost = (1 - mDist / splashRad) * splashStrength * 2.2;
              }
            }

            // Overall brightness and energy
            const combinedEnergy =
              (waveVal * 0.4 + 0.5) * brightness * contrast +
              circleBoost * 0.55 +
              mouseBoost;

            const alpha = Math.max(
              0.04,
              Math.min(0.92, (combinedEnergy * 0.75 + 0.1) * introFactor)
            );

            // Shape sizing
            const dynamicScale = Math.max(
              0.2,
              Math.min(1.6, (0.5 + combinedEnergy * 0.7) * introFactor)
            );
            const size = baseRadius * dynamicScale;

            if (size < 0.5) continue;

            // Shape selection: mixed, squares, circles, triangles
            let shapeType = shapes;
            if (shapes === 'mixed') {
              const hash = (r * 73856093) ^ (c * 19349663);
              const mod = Math.abs(hash) % 3;
              shapeType = mod === 0 ? 'circles' : mod === 1 ? 'squares' : 'triangles';
            }

            // Color interpolation: blend between primary and hover
            const blendRatio = Math.min(1, mouseBoost * 1.2 + circleBoost * 0.4);
            const cr = Math.round(primaryRgb.r + (hoverRgb.r - primaryRgb.r) * blendRatio);
            const cg = Math.round(primaryRgb.g + (hoverRgb.g - primaryRgb.g) * blendRatio);
            const cb = Math.round(primaryRgb.b + (hoverRgb.b - primaryRgb.b) * blendRatio);

            ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;

            // Draw shape
            ctx.beginPath();
            if (shapeType === 'circles') {
              ctx.arc(cx, cy, size, 0, Math.PI * 2);
              ctx.fill();
            } else if (shapeType === 'squares') {
              ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
            } else {
              // Equilateral triangle
              const h = size * 1.5;
              ctx.moveTo(cx, cy - h * 0.6);
              ctx.lineTo(cx - size, cy + h * 0.4);
              ctx.lineTo(cx + size, cy + h * 0.4);
              ctx.closePath();
              ctx.fill();
            }

            // Optional glow on energetic nodes
            if (glow > 0 && (circleBoost > 0.4 || mouseBoost > 0.3)) {
              ctx.shadowColor = `rgba(${hoverRgb.r}, ${hoverRgb.g}, ${hoverRgb.b}, ${glow})`;
              ctx.shadowBlur = 8;
            } else {
              ctx.shadowBlur = 0;
            }
          }
        }

        // Running circle aura rings rendering (delicate visible glowing waves)
        for (let i = 0; i < activeWaveRings.length; i++) {
          const ring = activeWaveRings[i];
          if (ring.intensity > 0.05) {
            ctx.beginPath();
            ctx.arc(ring.cx, ring.cy, ring.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${ring.intensity * 0.22 * brightness})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Inner harmonic ring
            if (ring.radius > 60) {
              ctx.beginPath();
              ctx.arc(ring.cx, ring.cy, ring.radius * 0.7, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(125, 211, 252, ${ring.intensity * 0.14 * brightness})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }

        // Optional Center Text Cutout Watermark
        if (text && text.trim().length > 0) {
          const fontSize = Math.min(width * 0.12, 72) * textSize;
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = `rgba(255, 255, 255, ${0.08 * introFactor})`;
          ctx.fillText(text, width / 2, height / 2);
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      ro.disconnect();
    };
  }, [
    text,
    fontFamily,
    fontWeight,
    textSize,
    shapes,
    cellSize,
    dotSize,
    color,
    hoverColor,
    backgroundColor,
    speed,
    scale,
    contrast,
    brightness,
    flow,
    direction,
    fade,
    interactive,
    splashRadius,
    splashStrength,
    glow,
    intro,
    introDuration,
    paused,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full pointer-events-none"
      />
    </div>
  );
}
