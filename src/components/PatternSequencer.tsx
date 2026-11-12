import React, { useMemo, useState } from 'react';
import { useHaptics } from '../context/HapticsContext';
import { FocusZoneId, VibrationPattern } from '../types/haptics';

const PATTERN_FOCUS_MAP: Record<string, FocusZoneId> = {
  'heartbeat-lub-dub': 'PATTERN_HEARTBEAT',
  'sine-wave-swell': 'PATTERN_WAVE',
  'stutter-gate': 'PATTERN_STUTTER',
  'polyrhythm-sync': 'PATTERN_POLYRHYTHM',
  'sub-bass-drop': 'PATTERN_SUBBASS',
  'continuous-drive': 'PATTERN_CASCADE',
};

function buildEnvelopeSvgPoints(pattern: VibrationPattern): string {
  const width = 180;
  const height = 38;
  return pattern.keyframes
    .map((kf) => {
      const x = Math.round(kf.timeOffset * width);
      const y = Math.round(height - 4 - kf.intensity * (height - 8));
      return `${x},${y}`;
    })
    .join(' ');
}

export const PatternSequencer: React.FC = () => {
  const {
    telemetry,
    patterns,
    selectPattern,
    deleteCustomPattern,
    focusedZone,
    setFocusedZone,
    toggleEngineRunning,
  } = useHaptics();

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const categories = ['ALL', 'Organic', 'Wave', 'Rhythmic', 'Trigger', 'Custom'];

  const filteredPatterns = useMemo(() => {
    if (categoryFilter === 'ALL') return patterns;
    return patterns.filter((p) => p.category === categoryFilter);
  }, [patterns, categoryFilter]);

  return (
    <section
      id="pattern-sequencer"
      aria-label="Haptic Pattern Sequencer Library"
      className="bg-[#111827] border border-slate-800 rounded-lg p-5 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100 tracking-tight">
            Pattern Envelope Library
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Active: <span className="text-cyan-400 font-medium">{telemetry.activePattern.name}</span> · Phase:{' '}
            <span className="font-mono tabular-nums">
              {Math.round(telemetry.normalizedPhase * 100)}%
            </span>
          </p>
        </div>

        {/* Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="Pattern Category Filter"
          className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded"
        >
          {categories.map((cat) => {
            const isSelected = categoryFilter === cat;
            return (
              <button
                key={cat}
                role="tab"
                aria-selected={isSelected}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-slate-800 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pattern Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredPatterns.map((pattern) => {
          const isActive = telemetry.activePattern.id === pattern.id;
          const mappedFocusZone = PATTERN_FOCUS_MAP[pattern.id];
          const isFocused = Boolean(
            mappedFocusZone && focusedZone === mappedFocusZone
          );
          const polyPoints = buildEnvelopeSvgPoints(pattern);

          return (
            <div
              key={pattern.id}
              className={`bg-[#07090E] border rounded p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                isFocused
                  ? 'border-cyan-400 ring-2 ring-cyan-400/50'
                  : isActive
                  ? 'border-cyan-500/80'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (mappedFocusZone) setFocusedZone(mappedFocusZone);
                      selectPattern(pattern);
                      if (!telemetry.isRunning) {
                        toggleEngineRunning();
                      }
                    }}
                    className="text-left focus:outline-none group"
                  >
                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors">
                      {pattern.name}
                    </h3>
                  </button>

                  {pattern.isCustom && (
                    <button
                      type="button"
                      aria-label={`Delete ${pattern.name}`}
                      onClick={() => deleteCustomPattern(pattern.id)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-mono"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Unboxed metadata line per Zero-Pill rule */}
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                  <span>{pattern.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{pattern.durationMs}ms cycle</span>
                  <span aria-hidden="true">·</span>
                  <span>{pattern.keyframes.length} pts</span>
                </div>

                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {pattern.description}
                </p>
              </div>

              {/* SVG Envelope Visualizer + Select Action */}
              <div className="pt-1 flex flex-col gap-2">
                <div className="relative bg-[#111827] border border-slate-800/80 rounded p-1.5 overflow-hidden">
                  <svg
                    viewBox="0 0 180 38"
                    className="w-full h-9 block overflow-visible"
                  >
                    <polyline
                      fill="none"
                      stroke={isActive ? '#06B6D4' : '#64748B'}
                      strokeWidth="2"
                      points={polyPoints}
                    />
                    {isActive && (
                      <line
                        x1={telemetry.normalizedPhase * 180}
                        y1={0}
                        x2={telemetry.normalizedPhase * 180}
                        y2={38}
                        stroke="#F59E0B"
                        strokeWidth="1.5"
                      />
                    )}
                  </svg>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (mappedFocusZone) setFocusedZone(mappedFocusZone);
                    selectPattern(pattern);
                    if (!telemetry.isRunning) {
                      toggleEngineRunning();
                    }
                  }}
                  className={`w-full py-1.5 px-3 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'bg-[#111827] text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {isActive ? '● Active Envelope' : 'Load Pattern'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
