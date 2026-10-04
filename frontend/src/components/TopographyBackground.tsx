import ShapeWaves from './ShapeWaves';
import Topography from './Topography';

export default function TopographyBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050B14]">
      {/* ── Dynamic Animated Running Circles in background (Sky Blue 🩵) ── */}
      <div
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400/30 bg-sky-500/[0.04] blur-[1px] running-circle-pulse pointer-events-none"
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[750px] h-[750px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/25 bg-cyan-500/[0.03] blur-[1px] running-circle-pulse pointer-events-none"
        style={{ animationDelay: '4s' }}
      />
      <div
        className="absolute top-2/3 left-1/2 w-[480px] h-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/25 bg-blue-500/[0.03] blur-[1px] running-circle-pulse pointer-events-none"
        style={{ animationDelay: '2s' }}
      />

      {/* ── React Bits Living Topography Background (Sky Blue Theme 🩵) ── */}
      <Topography
        lowColor="#0284C7"
        midColor="#38BDF8"
        highColor="#F0F9FF"
        speed={0.25}
        morphAmount={2.5}
        morphSpeed={0.04}
        bands={2}
        thickness={0.012}
        scale={2}
        pixelSize={1}
        glow={0.5}
        colorMode="elevation"
        contrast={2.8}
        brightness={0.85}
        fillBands={false}
        opacity={0.5}
        grain
        grainIntensity={0.04}
        mouseInteraction
        mouseRadius={0.3}
        mouseStrength={0.4}
      />

      {/* ── React Bits ShapeWaves Interactive Ambient Layer (Sky Blue 🩵) ── */}
      <ShapeWaves
        text=""
        fontFamily='Geist, "Geist Sans", system-ui, sans-serif'
        fontWeight={500}
        textSize={0.6}
        shapes="mixed"
        cellSize={14}
        dotSize={0.75}
        color="#0EA5E9"
        hoverColor="#38BDF8"
        backgroundColor="transparent"
        speed={1}
        scale={1}
        contrast={1.2}
        brightness={0.55}
        flow={0.15}
        direction={15}
        fade={0.15}
        interactive
        splashRadius={50}
        splashStrength={0.45}
        glow={0.4}
        intro
        introDuration={1.6}
        paused={false}
      />

      {/* ── Balanced vignette overlay to ensure pristine contrast & crisp card visibility ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(5,11,20,0.12) 0%, rgba(5,11,20,0.55) 65%, rgba(5,11,20,0.86) 100%)',
        }}
      />
    </div>
  );
}
