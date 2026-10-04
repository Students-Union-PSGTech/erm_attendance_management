import React, { useEffect, useRef } from 'react';

export interface TopographyProps {
  lowColor?: string;
  midColor?: string;
  highColor?: string;
  speed?: number;
  morphAmount?: number;
  morphSpeed?: number;
  bands?: number;
  thickness?: number;
  scale?: number;
  pixelSize?: number;
  glow?: number;
  colorMode?: 'elevation' | 'gradient' | 'mono';
  contrast?: number;
  brightness?: number;
  fillBands?: boolean;
  opacity?: number;
  grain?: boolean;
  grainIntensity?: number;
  mouseInteraction?: boolean;
  mouseRadius?: number;
  mouseStrength?: number;
  className?: string;
  style?: React.CSSProperties;
}

function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = (position + 1.0) * 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform vec3 u_lowColor;
  uniform vec3 u_midColor;
  uniform vec3 u_highColor;
  uniform float u_bands;
  uniform float u_thickness;
  uniform float u_scale;
  uniform float u_glow;
  uniform float u_contrast;
  uniform float u_brightness;
  uniform float u_morphAmount;
  uniform float u_morphSpeed;
  uniform float u_fillBands;
  uniform float u_grain;
  uniform float u_grainIntensity;
  uniform float u_mouseStrength;
  uniform float u_mouseRadius;
  uniform float u_opacity;

  // Simplex noise implementation
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Fractional Brownian Motion for contour heightmap
  float fbm(vec2 p) {
    float total = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 4; i++) {
      total += snoise(p * freq) * amp;
      freq *= 2.05;
      amp *= 0.5;
    }
    return total;
  }

  // Random hash for subtle film grain
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

    // Mouse interaction distortion
    if (u_mouseStrength > 0.0) {
      vec2 m = (u_mouse - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
      float d = length(st - m);
      if (d < u_mouseRadius && d > 0.0001) {
        float factor = (1.0 - smoothstep(0.0, u_mouseRadius, d)) * u_mouseStrength;
        st += normalize(st - m) * factor;
      }
    }

    vec2 pos = st * u_scale;
    float t = u_time;
    float morph = snoise(pos * 0.4 + vec2(t * u_morphSpeed)) * u_morphAmount;

    // Elevation calculation
    float elevation = fbm(pos + vec2(t * 0.15, -t * 0.1) + morph * 0.15) * 0.5 + 0.5;
    elevation = clamp(elevation * u_contrast + (u_brightness - 1.0), 0.0, 1.0);

    // Contours bands
    float bandCount = max(u_bands * 6.0, 1.0);
    float grid = elevation * bandCount;
    float lineDist = abs(fract(grid - 0.5) - 0.5);
    float fw = fwidth(grid);
    float thickness = max(u_thickness * 15.0, 0.005);
    
    // Smooth contour isoline
    float line = 1.0 - smoothstep(thickness - fw, thickness + fw, lineDist);

    // Subtle glow surrounding the lines
    float glowDist = lineDist / (thickness * 8.0 + u_glow * 0.2);
    float glow = exp(-glowDist * glowDist * 3.5) * u_glow * 0.7;

    // Band fill shading
    float fill = 0.0;
    if (u_fillBands > 0.5) {
      fill = floor(grid) / bandCount * 0.25;
    }

    // Color gradient interpolation based on elevation
    vec3 color;
    if (elevation < 0.5) {
      color = mix(u_lowColor, u_midColor, elevation * 2.0);
    } else {
      color = mix(u_midColor, u_highColor, (elevation - 0.5) * 2.0);
    }

    // Blend line, glow, fill on pitch dark obsidian base
    vec3 finalColor = color * (line * 1.2 + glow + fill);

    // Film grain
    if (u_grain > 0.5) {
      float g = (hash(gl_FragCoord.xy + fract(u_time * 10.0)) - 0.5) * u_grainIntensity;
      finalColor += vec3(g);
    }

    gl_FragColor = vec4(finalColor, u_opacity * max(line + glow * 0.8, fill * 0.5));
  }
`;

export default function Topography({
  lowColor = '#5227FF',
  midColor = '#FF9FFC',
  highColor = '#FFFFFF',
  speed = 0.35,
  morphAmount = 3,
  morphSpeed = 0.05,
  bands = 2,
  thickness = 0.01,
  scale = 2,
  pixelSize = 1,
  glow = 0.5,
  contrast = 3,
  brightness = 1,
  fillBands = false,
  opacity = 1,
  grain = true,
  grainIntensity = 0.05,
  mouseInteraction = true,
  mouseRadius = 0.3,
  mouseStrength = 0.4,
  className = '',
  style = {},
}: TopographyProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    if (!gl) return;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertShader || !fragShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(program));
      return;
    }

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);

    // Uniform locations
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uLow = gl.getUniformLocation(program, 'u_lowColor');
    const uMid = gl.getUniformLocation(program, 'u_midColor');
    const uHigh = gl.getUniformLocation(program, 'u_highColor');
    const uBands = gl.getUniformLocation(program, 'u_bands');
    const uThick = gl.getUniformLocation(program, 'u_thickness');
    const uScale = gl.getUniformLocation(program, 'u_scale');
    const uGlow = gl.getUniformLocation(program, 'u_glow');
    const uCont = gl.getUniformLocation(program, 'u_contrast');
    const uBright = gl.getUniformLocation(program, 'u_brightness');
    const uMorphAmt = gl.getUniformLocation(program, 'u_morphAmount');
    const uMorphSpd = gl.getUniformLocation(program, 'u_morphSpeed');
    const uFill = gl.getUniformLocation(program, 'u_fillBands');
    const uGrain = gl.getUniformLocation(program, 'u_grain');
    const uGrainInt = gl.getUniformLocation(program, 'u_grainIntensity');
    const uMouseStr = gl.getUniformLocation(program, 'u_mouseStrength');
    const uMouseRad = gl.getUniformLocation(program, 'u_mouseRadius');
    const uOpac = gl.getUniformLocation(program, 'u_opacity');

    // Parse Colors
    const lowRgb = hexToRgb(lowColor);
    const midRgb = hexToRgb(midColor);
    const highRgb = hexToRgb(highColor);

    gl.uniform3f(uLow, lowRgb[0], lowRgb[1], lowRgb[2]);
    gl.uniform3f(uMid, midRgb[0], midRgb[1], midRgb[2]);
    gl.uniform3f(uHigh, highRgb[0], highRgb[1], highRgb[2]);
    gl.uniform1f(uBands, bands);
    gl.uniform1f(uThick, thickness);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uGlow, glow);
    gl.uniform1f(uCont, contrast);
    gl.uniform1f(uBright, brightness);
    gl.uniform1f(uMorphAmt, morphAmount);
    gl.uniform1f(uMorphSpd, morphSpeed);
    gl.uniform1f(uFill, fillBands ? 1.0 : 0.0);
    gl.uniform1f(uGrain, grain ? 1.0 : 0.0);
    gl.uniform1f(uGrainInt, grainIntensity);
    gl.uniform1f(uMouseStr, mouseInteraction ? mouseStrength : 0.0);
    gl.uniform1f(uMouseRad, mouseRadius);
    gl.uniform1f(uOpac, opacity);

    const resize = () => {
      const container = containerRef.current || canvas.parentElement;
      const width = container ? container.clientWidth : window.innerWidth;
      const height = container ? container.clientHeight : window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2) / pixelSize;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseInteraction) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2) / pixelSize;
      mousePos.current = {
        x: (e.clientX - rect.left) * dpr,
        y: (rect.height - (e.clientY - rect.top)) * dpr,
      };
    };

    window.addEventListener('mousemove', handleMouseMove);

    let startTime = performance.now();
    const render = (now: number) => {
      const elapsed = ((now - startTime) / 1000) * speed;
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, mousePos.current.x, mousePos.current.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      gl.deleteBuffer(posBuffer);
    };
  }, [
    lowColor,
    midColor,
    highColor,
    speed,
    morphAmount,
    morphSpeed,
    bands,
    thickness,
    scale,
    pixelSize,
    glow,
    contrast,
    brightness,
    fillBands,
    opacity,
    grain,
    grainIntensity,
    mouseInteraction,
    mouseRadius,
    mouseStrength,
  ]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden ${className}`}
      style={{ position: 'relative', ...style }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
