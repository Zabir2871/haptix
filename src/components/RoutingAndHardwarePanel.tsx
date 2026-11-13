import React, { useRef, useState } from 'react';
import {
  Sliders,
  Cpu,
  Timer,
  Gamepad2,
  Hand,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { engine, HapticsState, state } from '../engine/hapticsEngine';
import {
  computeLRBalanceMultipliers,
  formatLRBalanceLabel,
} from '../engine/hapticsLogic';

interface RoutingAndHardwarePanelProps {
  routing: HapticsState['routing'];
  masterStrength: number;
  patternTempo: number;
  lrBalance: number;
  activeTimerMins: number | null;
  timerText: string | null;
  manualStrong: number;
  manualWeak: number;
  onUpdateRouting: (key: keyof HapticsState['routing'], val: boolean) => void;
  onUpdateStrength: (val: number) => void;
  onUpdateTempo: (val: number) => void;
  onUpdateBalance: (val: number) => void;
  onStartTimer: (mins: number) => void;
  onClearTimer: () => void;
  onManualAdjust: (strongDelta: number, weakDelta: number) => void;
}

export const RoutingAndHardwarePanel: React.FC<RoutingAndHardwarePanelProps> = ({
  routing,
  masterStrength,
  patternTempo,
  lrBalance,
  activeTimerMins,
  timerText,
  manualStrong,
  manualWeak,
  onUpdateRouting,
  onUpdateStrength,
  onUpdateTempo,
  onUpdateBalance,
  onStartTimer,
  onClearTimer,
  onManualAdjust,
}) => {
  const tapTimesRef = useRef<number[]>([]);
  const [tapBpmReadout, setTapBpmReadout] = useState<number | null>(null);
  const phoneSupported =
    typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const { leftMultiplier, rightMultiplier } =
    computeLRBalanceMultipliers(lrBalance);

  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current.filter((t) => now - t < 3000);
    taps.push(now);
    tapTimesRef.current = taps;

    if (taps.length >= 2) {
      let sumIntervals = 0;
      for (let i = 1; i < taps.length; i++) {
        sumIntervals += taps[i] - taps[i - 1];
      }
      const avgMs = sumIntervals / (taps.length - 1);
      const bpm = Math.round(60000 / Math.max(180, avgMs));
      setTapBpmReadout(bpm);
      // Normalize 120 BPM as 1.0x tempo
      const computedTempo = Number(
        Math.max(0.2, Math.min(3.0, bpm / 120)).toFixed(1)
      );
      onUpdateTempo(computedTempo);
    }
  };

  return (
    <div className="space-y-4">
      {/* Global Modifiers Module */}
      <div className="rounded-2xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#FF5500]" />
            <span>Master Gain, L/R Balance & Tempo</span>
          </h2>
          <button
            type="button"
            onClick={handleTapTempo}
            className="min-h-[36px] px-3 py-1 rounded-xl bg-slate-100 dark:bg-[#1C202B] border border-slate-200 dark:border-[#2B3040] hover:border-[#FF5500] text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            title="Tap repeatedly to sync pattern tempo"
          >
            <Hand className="w-3.5 h-3.5 text-[#FF5500]" />
            <span>{tapBpmReadout ? `Tap (${tapBpmReadout} BPM)` : 'Tap Tempo'}</span>
          </button>
        </div>

        <div className="space-y-4">
          {/* Master Strength */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="slider-strength"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Master Strength
              </label>
              <span
                id="strength-val"
                className="text-xs font-mono font-bold text-[#FF5500] tabular-nums"
              >
                {Math.round(masterStrength * 100)}%
              </span>
            </div>
            <input
              id="slider-strength"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterStrength}
              onChange={(e) => onUpdateStrength(parseFloat(e.target.value))}
              className="tactile-fader"
            />
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {[0.25, 0.5, 0.75, 1.0].map((presetVal) => (
                <button
                  key={presetVal}
                  type="button"
                  onClick={() => onUpdateStrength(presetVal)}
                  className={`min-h-[32px] rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                    Math.abs(masterStrength - presetVal) < 0.02
                      ? 'bg-[#FF5500]/15 border-[#FF5500] text-[#FF5500]'
                      : 'bg-slate-50 dark:bg-[#0D0F14] border-slate-200 dark:border-[#222632] text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {Math.round(presetVal * 100)}%
                </button>
              ))}
            </div>
          </div>

          {/* L/R Motor Balancer Crossfader */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-[#222632]">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="slider-balance"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                L/R Motor Balancer
              </label>
              <span
                id="balance-val"
                className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums"
              >
                {formatLRBalanceLabel(lrBalance)}
              </span>
            </div>

            {/* Dual-Channel Gain Ratio Preview Bar */}
            <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
              <span className="text-[#FFB800]">
                L STRONG: {Math.round(leftMultiplier * 100)}%
              </span>
              <span className="text-[#00E5FF]">
                R WEAK: {Math.round(rightMultiplier * 100)}%
              </span>
            </div>

            <div className="relative">
              <input
                id="slider-balance"
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={lrBalance}
                aria-label="L/R Motor Balancer"
                onChange={(e) => onUpdateBalance(parseFloat(e.target.value))}
                className="tactile-fader"
              />
            </div>

            <div className="grid grid-cols-5 gap-1.5 mt-1">
              {[
                { label: '100% L', val: -1.0 },
                { label: 'L 50%', val: -0.5 },
                { label: 'Center', val: 0.0 },
                { label: 'R 50%', val: 0.5 },
                { label: '100% R', val: 1.0 },
              ].map((pan) => {
                const isSelected = Math.abs(lrBalance - pan.val) < 0.03;
                return (
                  <button
                    key={pan.label}
                    type="button"
                    onClick={() => onUpdateBalance(pan.val)}
                    className={`min-h-[32px] rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? pan.val < 0
                          ? 'bg-[#FFB800]/15 border-[#FFB800] text-[#FFB800]'
                          : pan.val > 0
                          ? 'bg-[#00E5FF]/15 border-[#00E5FF] text-[#00E5FF]'
                          : 'bg-[#FF5500]/15 border-[#FF5500] text-[#FF5500]'
                        : 'bg-slate-50 dark:bg-[#0D0F14] border-slate-200 dark:border-[#222632] text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {pan.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pattern Tempo */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-[#222632]">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="slider-tempo"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Pattern Tempo Multiplier
              </label>
              <span
                id="tempo-val"
                className="text-xs font-mono font-bold text-[#00E5FF] tabular-nums"
              >
                {patternTempo.toFixed(1)}x
              </span>
            </div>
            <input
              id="slider-tempo"
              type="range"
              min={0.1}
              max={3.0}
              step={0.1}
              value={patternTempo}
              onChange={(e) => onUpdateTempo(parseFloat(e.target.value))}
              className="tactile-fader"
            />
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {[0.5, 1.0, 1.5, 2.5].map((presetTempo) => (
                <button
                  key={presetTempo}
                  type="button"
                  onClick={() => onUpdateTempo(presetTempo)}
                  className={`min-h-[32px] rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                    Math.abs(patternTempo - presetTempo) < 0.05
                      ? 'bg-[#00E5FF]/15 border-[#00E5FF] text-[#00E5FF]'
                      : 'bg-slate-50 dark:bg-[#0D0F14] border-slate-200 dark:border-[#222632] text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {presetTempo.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Target Routing Matrix */}
      <div className="rounded-2xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] p-4 sm:p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3.5">
          <Cpu className="w-4 h-4 text-[#FFB800]" />
          <span>Actuator Target Routing</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              id: 'target-main',
              key: 'main' as const,
              title: 'Main Grip Motors',
              sub: 'Dual L/R eccentric rotors',
              disabled: false,
            },
            {
              id: 'target-triggers',
              key: 'triggers' as const,
              title: 'Trigger Motors (Xbox)',
              sub: 'Impulse L2/R2 actuators',
              disabled: false,
            },
            {
              id: 'target-sync',
              key: 'syncAll' as const,
              title: 'Sync All Gamepads',
              sub: 'Broadcast to 4 ports',
              disabled: false,
            },
            {
              id: 'target-phone',
              key: 'phone' as const,
              title: phoneSupported ? 'Phone Motor' : 'Phone Motor (Sim)',
              sub: phoneSupported ? 'Navigator Vibration API' : 'Browser API fallback',
              disabled: false,
            },
          ].map((item) => {
            const checked = routing[item.key];
            return (
              <label
                key={item.id}
                htmlFor={item.id}
                className={`min-h-[54px] p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  checked
                    ? 'bg-slate-900/5 dark:bg-[#1B1F2A] border-slate-900 dark:border-[#FFB800]/70'
                    : 'bg-slate-50 dark:bg-[#0D0F14] border-slate-200 dark:border-[#20242F]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {item.sub}
                  </div>
                </div>
                <input
                  id={item.id}
                  type="checkbox"
                  checked={checked}
                  disabled={item.disabled}
                  onChange={(e) => onUpdateRouting(item.key, e.target.checked)}
                  className="w-4 h-4 accent-[#FF5500] rounded cursor-pointer shrink-0"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Auto-Shutoff Sleep Timer */}
      <div className="rounded-2xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#00E5FF]" />
            <span>Auto-Shutoff Sleep Timer</span>
          </h2>
          {timerText && (
            <button
              type="button"
              onClick={onClearTimer}
              className="text-xs font-mono text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel ({timerText})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '5m', mins: 5 },
            { label: '15m', mins: 15 },
            { label: '30m', mins: 30 },
            { label: '1h', mins: 60 },
          ].map((t) => {
            const isSelected = activeTimerMins === t.mins && Boolean(timerText);
            return (
              <button
                key={t.mins}
                type="button"
                data-time={t.mins}
                onClick={() => onStartTimer(t.mins)}
                className={`timer-btn min-h-[42px] py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF5500] border-[#FF5500] text-white'
                    : 'bg-slate-50 dark:bg-[#0D0F14] border-slate-200 dark:border-[#222632] text-slate-700 dark:text-slate-200 hover:border-[#FF5500]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Manual Trim & Gamepad Shortcuts */}
      <div className="rounded-2xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-[#FF5500]" />
            <span>Manual D-Pad Trim & Hardware Map</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-500">
            S:{Math.round(manualStrong * 100)}% · W:{Math.round(manualWeak * 100)}%
          </span>
        </div>

        {/* Interactive D-Pad Stepper Buttons for Touch/Mouse + Physical D-Pad */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <button
            type="button"
            onClick={() => onManualAdjust(0.1, 0)}
            className="min-h-[42px] px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200 dark:border-[#222632] hover:border-[#FFB800] text-xs font-mono text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5 text-[#FFB800]" />
            <span>Strong +10%</span>
          </button>
          <button
            type="button"
            onClick={() => onManualAdjust(-0.1, 0)}
            className="min-h-[42px] px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200 dark:border-[#222632] hover:border-[#FFB800] text-xs font-mono text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5 text-[#FFB800]" />
            <span>Strong -10%</span>
          </button>
          <button
            type="button"
            onClick={() => onManualAdjust(0, 0.1)}
            className="min-h-[42px] px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200 dark:border-[#222632] hover:border-[#00E5FF] text-xs font-mono text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Weak +10%</span>
          </button>
          <button
            type="button"
            onClick={() => onManualAdjust(0, -0.1)}
            className="min-h-[42px] px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200 dark:border-[#222632] hover:border-[#00E5FF] text-xs font-mono text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Weak -10%</span>
          </button>
        </div>

        {/* Clean Unboxed Hardware Shortcut Legend */}
        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-[#222632] pt-3">
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
              B / Circle / Esc
            </span>
            <span>Emergency Stop (Terminate All)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
              A / Cross
            </span>
            <span>Engage Highlighted Pattern</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
              L1 / R1 Bumpers
            </span>
            <span>Cycle Pattern Selection</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
              D-Pad ↕ / ↔
            </span>
            <span>Live Trim Strong / Weak Motors</span>
          </div>
        </div>
      </div>
    </div>
  );
};
