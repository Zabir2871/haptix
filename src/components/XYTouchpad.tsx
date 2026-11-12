import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHaptics } from '../context/HapticsContext';

interface RecordedSample {
  x: number;
  y: number;
  timestampMs: number;
}

export const XYTouchpad: React.FC = () => {
  const {
    telemetry,
    updateXYVector,
    focusedZone,
    setFocusedZone,
    saveCustomPattern,
    toggleEngineRunning,
  } = useHaptics();

  const padRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Parallax tilt angles (degrees) driven by cursor/touch position
  const [tilt, setTilt] = useState<{ rotateX: number; rotateY: number }>({
    rotateX: 0,
    rotateY: 0,
  });

  // Live Custom Pattern Gesture Recording state
  const [isRecordingGesture, setIsRecordingGesture] = useState(false);
  const [customPatternName, setCustomPatternName] = useState('Custom Vector Pulse');
  const recordedSamplesRef = useRef<RecordedSample[]>([]);
  const [sampleCount, setSampleCount] = useState(0);

  // Waveform history buffer for 60fps canvas oscilloscope
  const historyRef = useRef<
    Array<{ low: number; high: number; trig: number }>
  >(Array.from({ length: 120 }, () => ({ low: 0, high: 0, trig: 0 })));

  // Keep latest channels in a ref so canvas loop never tears down
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number | null = null;

    const renderScope = () => {
      const snap = telemetryRef.current;
      const hist = historyRef.current;
      hist.push({
        low: snap.channels.lowFreqStrong,
        high: snap.channels.highFreqWeak,
        trig: Math.max(
          snap.channels.leftImpulseTrigger,
          snap.channels.rightImpulseTrigger
        ),
      });
      if (hist.length > 120) hist.shift();

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle coordinate graticule lines
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.65)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw Low-Frequency Heavy Motor Curve (Cyan)
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      hist.forEach((pt, idx) => {
        const x = (idx / (hist.length - 1)) * w;
        const y = h - 8 - pt.low * (h - 18);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw High-Frequency Weak Motor Curve (Sky Light)
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      hist.forEach((pt, idx) => {
        const x = (idx / (hist.length - 1)) * w;
        const y = h - 8 - pt.high * (h - 18);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Impulse Trigger Envelope (Amber)
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      hist.forEach((pt, idx) => {
        const x = (idx / (hist.length - 1)) * w;
        const y = h - 8 - pt.trig * (h - 18);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      rafId = window.requestAnimationFrame(renderScope);
    };

    rafId = window.requestAnimationFrame(renderScope);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const updateFromClientCoords = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      // Y=1 at top (max intensity), Y=0 at bottom (zero intensity)
      const normY = Math.max(
        0,
        Math.min(1, 1 - (clientY - rect.top) / rect.height)
      );

      // Update parallax tilt (-6deg to +6deg)
      setTilt({
        rotateX: (normY - 0.5) * 9,
        rotateY: (normX - 0.5) * 9,
      });

      updateXYVector(normX, normY, true);

      if (isRecordingGesture) {
        recordedSamplesRef.current.push({
          x: normX,
          y: normY,
          timestampMs: performance.now(),
        });
        setSampleCount(recordedSamplesRef.current.length);
      }
    },
    [isRecordingGesture, updateXYVector]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setFocusedZone('XY_TOUCHPAD');
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientCoords(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const hoverX = (e.clientX - rect.left) / rect.width;
      const hoverY = 1 - (e.clientY - rect.top) / rect.height;
      setTilt({
        rotateX: (hoverY - 0.5) * 5,
        rotateY: (hoverX - 0.5) * 5,
      });
      return;
    }
    updateFromClientCoords(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      const primary = e.touches[0];
      updateFromClientCoords(primary.clientX, primary.clientY);
    }
  };

  const handleStartOrSaveRecording = () => {
    if (!isRecordingGesture) {
      recordedSamplesRef.current = [];
      setSampleCount(0);
      setIsRecordingGesture(true);
    } else {
      setIsRecordingGesture(false);
      saveCustomPattern(customPatternName, recordedSamplesRef.current);
      recordedSamplesRef.current = [];
      setSampleCount(0);
    }
  };

  const cursorXPercent = Math.round(telemetry.parameters.speed * 100);
  const cursorYPercent = Math.round(telemetry.parameters.strength * 100);
  const isPadFocused = focusedZone === 'XY_TOUCHPAD';

  return (
    <section
      aria-label="2D XY Tactile Vector Pad and Oscilloscope"
      className={`bg-[#111827] border transition-colors rounded-lg p-5 flex flex-col gap-4 ${
        isPadFocused ? 'border-cyan-400 ring-1 ring-cyan-400/50' : 'border-slate-800'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100 tracking-tight">
            XY Tactile Vector Surface
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            X-Axis: Motor Frequency & Tempo ({telemetry.parameters.tempo} BPM) · Y-Axis: Actuator Force ({cursorYPercent}%)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFocusedZone('ENGINE_TOGGLE');
              toggleEngineRunning();
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              focusedZone === 'ENGINE_TOGGLE' ? 'ring-2 ring-cyan-400 ' : ''
            }${
              telemetry.isRunning
                ? 'bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {telemetry.isRunning ? '■ Pause Oscillator' : '▶ Engage Motor Loop'}
          </button>
        </div>
      </div>

      {/* 2D XY Interactive Pad with Parallax Response */}
      <div className="perspective-[900px]">
        <div
          ref={padRef}
          data-testid="xy-touchpad-surface"
          role="slider"
          aria-label="XY Haptic Modulation Pad"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={cursorYPercent}
          tabIndex={0}
          onFocus={() => setFocusedZone('XY_TOUCHPAD')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setIsDragging(false);
            setTilt({ rotateX: 0, rotateY: 0 });
          }}
          onTouchMove={handleTouchMove}
          style={{
            transform: `rotateX(${tilt.rotateX.toFixed(2)}deg) rotateY(${tilt.rotateY.toFixed(2)}deg)`,
            transition: isDragging ? 'transform 60ms linear' : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative w-full h-[300px] sm:h-[340px] bg-[#07090E] border border-slate-800 rounded-md overflow-hidden select-none touch-none cursor-crosshair"
        >
          {/* Coordinate Grid SVG Background */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="xy-grid"
                width="36"
                height="36"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 36 0 L 0 0 0 36"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#xy-grid)" />
            <line
              x1="50%"
              y1="0"
              x2="50%"
              y2="100%"
              stroke="#334155"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              y1="50%"
              x2="100%"
              y2="50%"
              stroke="#334155"
              strokeDasharray="4 4"
            />
          </svg>

          {/* Corner Axis Readout Overlays */}
          <div className="absolute top-3 left-3 pointer-events-none font-mono text-xs text-slate-400">
            <span>MAX INTENSITY · 100%</span>
          </div>
          <div className="absolute top-3 right-3 pointer-events-none font-mono text-xs text-cyan-400 tabular-nums">
            <span>
              X:{cursorXPercent.toString().padStart(3, '0')}% · Y:
              {cursorYPercent.toString().padStart(3, '0')}%
            </span>
          </div>
          <div className="absolute bottom-3 left-3 pointer-events-none font-mono text-xs text-slate-500">
            <span>LOW FREQ SUB (20Hz)</span>
          </div>
          <div className="absolute bottom-3 right-3 pointer-events-none font-mono text-xs text-slate-400">
            <span>HIGH FREQ IMPULSE (240BPM) →</span>
          </div>

          {/* Active Crosshair Lines */}
          <div
            className="absolute top-0 bottom-0 w-px bg-cyan-500/40 pointer-events-none"
            style={{ left: `${cursorXPercent}%` }}
          />
          <div
            className="absolute left-0 right-0 h-px bg-cyan-500/40 pointer-events-none"
            style={{ top: `${100 - cursorYPercent}%` }}
          />

          {/* Dynamic Harmonic Pulse Reticle */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${cursorXPercent}%`,
              top: `${100 - cursorYPercent}%`,
            }}
          >
            {/* Outer expanding ring proportional to real-time motor strength */}
            <div
              className="rounded-full border border-cyan-400/60 transition-transform duration-75"
              style={{
                width: `${36 + telemetry.channels.lowFreqStrong * 56}px`,
                height: `${36 + telemetry.channels.lowFreqStrong * 56}px`,
                backgroundColor: isRecordingGesture
                  ? 'rgba(245, 158, 11, 0.18)'
                  : 'rgba(6, 182, 212, 0.14)',
              }}
            />
            {/* Core precision reticle */}
            <div
              className={`w-4 h-4 rounded-full border-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
                isRecordingGesture
                  ? 'bg-amber-400 border-white'
                  : 'bg-cyan-400 border-slate-950'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Live Multi-Channel Waveform Oscilloscope + Gesture Recorder Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
        <div className="lg:col-span-7 bg-[#07090E] border border-slate-800 rounded p-2.5">
          <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-400 mb-1.5">
            <span className="whitespace-nowrap">MOTOR WAVEFORM SCOPE</span>
            <span className="tabular-nums whitespace-nowrap text-slate-400">
              CYAN: GRIP · AMBER: TRIGGERS
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={460}
            height={68}
            className="w-full h-[68px] block"
          />
        </div>

        {/* Live XY Gesture Recorder Box */}
        <div className="lg:col-span-5 bg-[#07090E] border border-slate-800 rounded p-3 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-200">
              XY Pattern Gesture Recorder
            </span>
            <span className="font-mono text-slate-400 tabular-nums">
              {isRecordingGesture ? `● REC (${sampleCount} pts)` : 'STANDBY'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Custom Pattern Name"
              value={customPatternName}
              onChange={(e) => setCustomPatternName(e.target.value)}
              placeholder="Pattern name..."
              className="w-full bg-[#111827] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={() => {
                setFocusedZone('PATTERN_RECORD');
                handleStartOrSaveRecording();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                focusedZone === 'PATTERN_RECORD' ? 'ring-2 ring-cyan-400 ' : ''
              }${
                isRecordingGesture
                  ? 'bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400'
                  : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {isRecordingGesture ? 'Save Gesture' : 'Record XY'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
