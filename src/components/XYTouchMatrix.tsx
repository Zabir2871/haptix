import React, { useEffect, useRef, useState } from 'react';
import { Lock, Unlock, Orbit, Disc, Play, BookmarkPlus } from 'lucide-react';
import { engine, state } from '../engine/hapticsEngine';
import { RecordedFrame } from '../engine/hapticsLogic';

interface XYTouchMatrixProps {
  onSaveRecordedLoop: (name: string, frames: RecordedFrame[]) => void;
}

export const XYTouchMatrix: React.FC<XYTouchMatrixProps> = ({ onSaveRecordedLoop }) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [padPos, setPadPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [isDragging, setIsDragging] = useState(false);
  const [latchHold, setLatchHold] = useState(false);
  const [orbitMode, setOrbitMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedCount, setRecordedCount] = useState(0);
  const [lastRecording, setLastRecording] = useState<RecordedFrame[]>([]);
  const [loopName, setLoopName] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const centerRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });

  // Handle Orbit LFO modulation when orbitMode is active
  useEffect(() => {
    if (!orbitMode) return;
    let rafId = 0;
    const start = performance.now();

    const step = (now: number) => {
      const t = ((now - start) / 1000) * state.patternTempo;
      const cx = centerRef.current.x;
      const cy = centerRef.current.y;
      const ox = Math.max(0, Math.min(1, cx + Math.cos(t * 2.4) * 0.28));
      const oy = Math.max(0, Math.min(1, cy + Math.sin(t * 3.6) * 0.28));
      setPadPos({ x: ox, y: oy });

      const strong = 1 - oy;
      const weak = ox;
      engine.dispatchVibration(strong, weak);
      if (state.recording) {
        setRecordedCount(state.recordedFrames.length);
      }
      rafId = requestAnimationFrame(step);
    };

    engine.stopAll();
    engine.activeMode = 'xy-orbit';
    engine.activePatternName = 'XY Lissajous Orbit';
    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
      if (engine.activeMode === 'xy-orbit') {
        engine.stopAll();
      }
    };
  }, [orbitMode]);

  const updatePointerCoordinates = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    centerRef.current = { x: normX, y: normY };
    setPadPos({ x: normX, y: normY });

    const weak = normX;
    const strong = 1 - normY;
    engine.activeMode = 'xy-pad';
    engine.activePatternName = latchHold ? 'XY Pad (Latched)' : 'XY Live Pad';
    engine.dispatchVibration(strong, weak);

    if (state.recording) {
      setRecordedCount(state.recordedFrames.length);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    if (!orbitMode) {
      engine.stopAll();
    }
    updatePointerCoordinates(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updatePointerCoordinates(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!latchHold && !orbitMode) {
      engine.stopAll();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      state.recording = false;
      setIsRecording(false);
      const captured = [...state.recordedFrames];
      setLastRecording(captured);
      setRecordedCount(captured.length);
      if (captured.length > 5) {
        engine.startPlayback(captured, 'Recorded XY Loop');
      }
    } else {
      state.recordedFrames = [];
      state.recording = true;
      setIsRecording(true);
      setRecordedCount(0);
      setSavedNotice(null);
    }
  };

  const handleSaveLoop = (e: React.FormEvent) => {
    e.preventDefault();
    if (lastRecording.length < 3) return;
    const finalName =
      loopName.trim() || `XY Loop #${Math.floor(100 + Math.random() * 899)}`;
    onSaveRecordedLoop(finalName, lastRecording);
    setLoopName('');
    setSavedNotice(`Saved "${finalName}" to Pattern Library`);
  };

  const currentStrongPct = Math.round((1 - padPos.y) * 100);
  const currentWeakPct = Math.round(padPos.x * 100);

  return (
    <div className="rounded-2xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            2D Vector Morphing Pad
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Drag anywhere to blend Strong (Y-Axis) and Weak (X-Axis) actuators in real time
          </p>
        </div>

        {/* Tactile Mode Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !latchHold;
              setLatchHold(next);
              if (!next && !isDragging && !orbitMode) {
                engine.stopAll();
              } else if (next) {
                engine.activeMode = 'xy-pad';
                engine.activePatternName = 'XY Pad (Latched)';
                engine.dispatchVibration(1 - padPos.y, padPos.x);
              }
            }}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              latchHold
                ? 'bg-[#FFB800]/15 border-[#FFB800] text-[#FFB800]'
                : 'bg-slate-100 dark:bg-[#1B1E26] border-slate-200 dark:border-[#2A2F3D] text-slate-700 dark:text-slate-300'
            }`}
          >
            {latchHold ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{latchHold ? 'Hold Locked' : 'Hold Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => setOrbitMode((prev) => !prev)}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              orbitMode
                ? 'bg-[#00E5FF]/15 border-[#00E5FF] text-[#00E5FF]'
                : 'bg-slate-100 dark:bg-[#1B1E26] border-slate-200 dark:border-[#2A2F3D] text-slate-700 dark:text-slate-300'
            }`}
          >
            <Orbit className="w-3.5 h-3.5" />
            <span>{orbitMode ? 'Orbiting' : 'Lissajous Orbit'}</span>
          </button>

          <button
            type="button"
            id="btn-record"
            onClick={toggleRecording}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isRecording
                ? 'bg-[#FF5500] border-[#FF5500] text-white'
                : 'bg-slate-100 dark:bg-[#1B1E26] border-slate-200 dark:border-[#2A2F3D] text-slate-700 dark:text-slate-200 hover:border-[#FF5500]'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>
              {isRecording ? `Stop Rec (${recordedCount})` : 'Record Motion'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Interactive XY Surface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-7">
          <div
            ref={padRef}
            id="touch-pad"
            data-testid="xy-touch-pad"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative w-full aspect-square max-h-[360px] mx-auto rounded-2xl bg-[#0A0C10] border-2 border-slate-800 dark:border-[#262A38] overflow-hidden touch-none cursor-crosshair select-none"
          >
            {/* Precision Coordinate Graticule */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="border-r border-b border-slate-800/70 last:border-r-0"
                />
              ))}
            </div>

            {/* Center Crosshair Axes */}
            <div
              className="absolute inset-x-0 pointer-events-none border-t border-dashed border-[#FFB800]/40"
              style={{ top: `${padPos.y * 100}%` }}
            />
            <div
              className="absolute inset-y-0 pointer-events-none border-l border-dashed border-[#00E5FF]/40"
              style={{ left: `${padPos.x * 100}%` }}
            />

            {/* Axis Labels */}
            <div className="absolute top-3 left-3 text-[11px] font-mono text-[#FFB800] pointer-events-none">
              Y: STRONG MOTOR ({currentStrongPct}%)
            </div>
            <div className="absolute bottom-3 right-3 text-[11px] font-mono text-[#00E5FF] pointer-events-none">
              X: WEAK MOTOR ({currentWeakPct}%)
            </div>

            {/* Active Touch Puck */}
            <div
              id="pad-cursor"
              className="absolute w-11 h-11 -ml-[22px] -mt-[22px] rounded-full border-2 border-white bg-[#FF5500]/40 backdrop-blur-xs pointer-events-none flex items-center justify-center transition-transform duration-75"
              style={{
                left: `${padPos.x * 100}%`,
                top: `${padPos.y * 100}%`,
                transform:
                  isDragging || latchHold || orbitMode ? 'scale(1.1)' : 'scale(0.9)',
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </div>
          </div>
        </div>

        {/* Right Column: Quick Vector Presets & Loop Saver */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200/80 dark:border-[#222632] p-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              01. Quick Quadrant Snap
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Max Dual (100/100)', x: 1.0, y: 0.0 },
                { label: 'Sub-Heavy (100/15)', x: 0.15, y: 0.0 },
                { label: 'Razor Fizz (15/100)', x: 1.0, y: 0.85 },
                { label: 'Warm Mid (60/60)', x: 0.6, y: 0.4 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    centerRef.current = { x: preset.x, y: preset.y };
                    setPadPos({ x: preset.x, y: preset.y });
                    setLatchHold(true);
                    engine.stopAll();
                    engine.activeMode = 'xy-pad';
                    engine.activePatternName = preset.label;
                    engine.dispatchVibration(1 - preset.y, preset.x);
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-white dark:bg-[#161922] border border-slate-200 dark:border-[#262B38] hover:border-[#FF5500] text-xs font-medium text-slate-800 dark:text-slate-200 text-left transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recorded Motion Loop Manager */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200/80 dark:border-[#222632] p-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              02. Motion Loop Recorder
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {lastRecording.length > 0
                ? `Captured ${lastRecording.length} motion frames. Replay or save to library:`
                : 'Tap "Record Motion" above and drag across the XY pad to capture a custom gesture loop.'}
            </p>

            {lastRecording.length > 0 && (
              <form onSubmit={handleSaveLoop} className="space-y-2.5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      engine.startPlayback(lastRecording, 'Recorded XY Loop')
                    }
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Replay Loop</span>
                  </button>
                  <input
                    type="text"
                    value={loopName}
                    onChange={(e) => setLoopName(e.target.value)}
                    placeholder="Custom loop name..."
                    aria-label="Custom loop name"
                    className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#161922] border border-slate-200 dark:border-[#262B38] text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  <span>Save Loop to Pattern Library</span>
                </button>
              </form>
            )}

            {savedNotice && (
              <p className="mt-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                {savedNotice}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
