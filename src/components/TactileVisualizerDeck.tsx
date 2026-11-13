import React, { useEffect, useRef } from 'react';
import { OctagonX, Volume2, VolumeX, Timer, Gamepad2, Smartphone } from 'lucide-react';
import { TelemetryFrame } from '../engine/hapticsEngine';
import {
  computeTelemetryMetrics,
  formatLRBalanceLabel,
} from '../engine/hapticsLogic';

interface TactileVisualizerDeckProps {
  telemetry: TelemetryFrame;
  masterStrength: number;
  patternTempo: number;
  lrBalance: number;
  timerText: string | null;
  audioSynthEnabled: boolean;
  onToggleAudioSynth: () => void;
  onEmergencyStop: () => void;
}

export const TactileVisualizerDeck: React.FC<TactileVisualizerDeckProps> = ({
  telemetry,
  masterStrength,
  patternTempo,
  lrBalance,
  timerText,
  audioSynthEnabled,
  onToggleAudioSynth,
  onEmergencyStop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<Array<{ s: number; w: number }>>(
    Array.from({ length: 140 }, () => ({ s: 0, w: 0 }))
  );
  const strongAngleRef = useRef(0);
  const weakAngleRef = useRef(0);

  useEffect(() => {
    historyRef.current.push({ s: telemetry.strong, w: telemetry.weak });
    if (historyRef.current.length > 140) {
      historyRef.current.shift();
    }
    strongAngleRef.current = (strongAngleRef.current + telemetry.strong * 22) % 360;
    weakAngleRef.current = (weakAngleRef.current + telemetry.weak * 45) % 360;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle oscilloscope graticule grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += w / 7) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += h / 4) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    const pts = historyRef.current;
    const stepX = w / Math.max(1, pts.length - 1);

    // Draw Strong Motor trace (Warm Amber #FFB800) with subtle area fill
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = i * stepX;
      const y = h - 7 - pts[i].s * (h - 16);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 2.75;
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 184, 0, 0.12)';
    ctx.fill();

    // Draw Weak Motor trace (Phosphor Cyan #00E5FF) slightly offset by -2px so identical curves remain distinct
    ctx.beginPath();
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 1.75;
    for (let i = 0; i < pts.length; i++) {
      const x = i * stepX;
      const y = h - 9 - pts[i].w * (h - 16);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [telemetry]);

  const metrics = computeTelemetryMetrics(telemetry.strong, telemetry.weak);
  const isRunning = Boolean(
    telemetry.activeMode || telemetry.strong > 0.01 || telemetry.weak > 0.01
  );

  return (
    <section
      aria-label="Live Dual-Motor Telemetry & Master Transport"
      className="rounded-2xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] p-3 sm:p-5"
    >
      {/* Top Instrument Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-200/80 dark:border-[#222632]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-mono font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
            <Gamepad2 className="w-3.5 h-3.5 text-[#FF5500]" />
            {telemetry.connectedControllers > 0
              ? `${telemetry.connectedControllers} Gamepad Ready`
              : 'No Gamepad'}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
            ·
          </span>
          <span className="font-mono hidden sm:flex items-center gap-1 whitespace-nowrap">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            {typeof navigator !== 'undefined' && 'vibrate' in navigator
              ? 'Mobile Haptics Ready'
              : 'Desktop Sim'}
          </span>
          <span
            aria-hidden="true"
            className="hidden sm:inline text-slate-300 dark:text-slate-600"
          >
            ·
          </span>
          <span className="font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Active:{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {telemetry.activePatternName || 'Standby'}
            </strong>
          </span>
          {timerText && (
            <>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="font-mono text-[#FF5500] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                <Timer className="w-3.5 h-3.5" />
                {timerText}
              </span>
            </>
          )}
        </div>

        {/* Acoustic Sub-Bass Haptic Toggle */}
        <button
          type="button"
          onClick={onToggleAudioSynth}
          className={`min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            audioSynthEnabled
              ? 'bg-[#FF5500]/15 border-[#FF5500] text-[#FF5500]'
              : 'bg-slate-100 dark:bg-[#1B1E26] border-slate-200 dark:border-[#2A2F3D] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Hear & feel sub-bass acoustic vibrations through device speakers"
        >
          {audioSynthEnabled ? (
            <Volume2 className="w-3.5 h-3.5" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
          <span>Sub-Bass {audioSynthEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>

      {/* Main Oscilloscope & Dual Rotor Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch">
        {/* Left: Dual Rotor Mechanical Telemetry Readouts */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Strong Motor Module */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200/80 dark:border-[#20242F] p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Strong (L)
              </span>
              <span className="text-[10px] font-mono text-[#FFB800] font-semibold whitespace-nowrap">
                LOW-FREQ
              </span>
            </div>

            <div className="my-1.5 sm:my-2.5 flex items-center gap-2.5">
              {/* Eccentric Counterweight Graphic */}
              <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-slate-300 dark:border-[#2A2E3B] flex items-center justify-center shrink-0 bg-white dark:bg-[#14161B]">
                <div
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-transform duration-75"
                  style={{
                    transform: `rotate(${strongAngleRef.current}deg)`,
                    background:
                      'conic-gradient(from 0deg, #FFB800 0deg 170deg, transparent 170deg 360deg)',
                    opacity: 0.25 + telemetry.strong * 0.75,
                  }}
                />
                <div className="absolute w-2 h-2 rounded-full bg-[#FFB800]" />
              </div>

              <div>
                <div className="text-lg sm:text-xl font-mono font-bold text-slate-900 dark:text-white tabular-nums leading-tight">
                  {Math.round(telemetry.strong * 100)}
                  <span className="text-xs font-normal text-slate-400 ml-0.5">%</span>
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                  {metrics.strongRpm} RPM
                </div>
              </div>
            </div>

            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#1C202B] overflow-hidden">
              <div
                className="h-full bg-[#FFB800] transition-all duration-75"
                style={{ width: `${Math.round(telemetry.strong * 100)}%` }}
              />
            </div>
          </div>

          {/* Weak Motor Module */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200/80 dark:border-[#20242F] p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Weak (R)
              </span>
              <span className="text-[10px] font-mono text-[#00E5FF] font-semibold whitespace-nowrap">
                HI-FREQ
              </span>
            </div>

            <div className="my-1.5 sm:my-2.5 flex items-center gap-2.5">
              {/* High-Freq Harmonic Rotor Graphic */}
              <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-slate-300 dark:border-[#2A2E3B] flex items-center justify-center shrink-0 bg-white dark:bg-[#14161B]">
                <div
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-transform duration-75"
                  style={{
                    transform: `rotate(${weakAngleRef.current}deg)`,
                    background:
                      'conic-gradient(from 0deg, #00E5FF 0deg 90deg, transparent 90deg 180deg, #00E5FF 180deg 270deg, transparent 270deg 360deg)',
                    opacity: 0.25 + telemetry.weak * 0.75,
                  }}
                />
                <div className="absolute w-2 h-2 rounded-full bg-[#00E5FF]" />
              </div>

              <div>
                <div className="text-lg sm:text-xl font-mono font-bold text-slate-900 dark:text-white tabular-nums leading-tight">
                  {Math.round(telemetry.weak * 100)}
                  <span className="text-xs font-normal text-slate-400 ml-0.5">%</span>
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                  {metrics.weakRpm} RPM
                </div>
              </div>
            </div>

            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#1C202B] overflow-hidden">
              <div
                className="h-full bg-[#00E5FF] transition-all duration-75"
                style={{ width: `${Math.round(telemetry.weak * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Real-time Dual-Channel Oscilloscope Canvas */}
        <div className="lg:col-span-5 rounded-xl bg-[#0A0C10] border border-slate-800 p-2.5 sm:p-3 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono text-slate-400 mb-1 z-10">
            <div className="flex items-center gap-2.5 whitespace-nowrap">
              <span className="text-[#FFB800]">CH1 STRONG</span>
              <span className="text-[#00E5FF]">CH2 WEAK</span>
            </div>
            <div className="tabular-nums whitespace-nowrap">
              RMS {metrics.rmsPercent}% · {metrics.powerWatts.toFixed(2)}W ·{' '}
              {patternTempo.toFixed(1)}x
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={420}
            height={72}
            data-testid="live-oscilloscope"
            className="w-full h-[58px] sm:h-[78px] rounded-lg block"
          />

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>GAIN: {Math.round(masterStrength * 100)}%</span>
            <span>BAL: {formatLRBalanceLabel(lrBalance)}</span>
            <span>60 HZ POLLING</span>
          </div>
        </div>

        {/* Right: Master Hardware Emergency Cut-Off Button */}
        <div className="lg:col-span-3 flex flex-col justify-stretch">
          <button
            type="button"
            id="btn-terminate"
            onClick={onEmergencyStop}
            className={`w-full h-full min-h-[48px] lg:min-h-0 px-4 py-2.5 sm:py-3.5 rounded-xl font-bold text-sm sm:text-base flex flex-row lg:flex-col items-center justify-center gap-2 lg:gap-1.5 transition-all active:scale-[0.98] cursor-pointer border ${
              isRunning
                ? 'bg-[#FF5500] hover:bg-[#e64d00] text-white border-[#FF7733] shadow-lg shadow-[#FF5500]/25'
                : 'bg-slate-100 dark:bg-[#1C1F28] hover:bg-rose-500/15 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-[#2E3342]'
            }`}
          >
            <div className="flex items-center gap-2">
              <OctagonX className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="tracking-tight whitespace-nowrap">EMERGENCY STOP</span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-mono font-normal opacity-80 whitespace-nowrap">
              {isRunning ? 'ACTIVE · [B / ESC]' : 'HALTED · [B / ESC]'}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
