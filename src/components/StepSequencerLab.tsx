import React, { useState } from 'react';
import { Play, Square, BookmarkPlus, RotateCcw, Sparkles } from 'lucide-react';
import { engine } from '../engine/hapticsEngine';
import {
  defaultSequencerPresets,
  EnvelopePatch,
  evaluateEnvelopeSynth,
  evaluateSequencerAtTime,
  PatternDefinition,
  SequencerStep,
} from '../engine/hapticsLogic';

interface StepSequencerLabProps {
  activeMode: string | null;
  currentStepIndex: number;
  onSaveCustomPattern: (name: string, def: PatternDefinition) => void;
}

export const StepSequencerLab: React.FC<StepSequencerLabProps> = ({
  activeMode,
  currentStepIndex,
  onSaveCustomPattern,
}) => {
  const [labTab, setLabTab] = useState<'sequencer' | 'synth'>('sequencer');
  const [bpm, setBpm] = useState(120);
  const [gateRatio, setGateRatio] = useState(0.8);
  const [steps, setSteps] = useState<SequencerStep[]>(
    () => defaultSequencerPresets['Cybernetic Pulse'].steps.map((s) => ({ ...s }))
  );
  const [seqName, setSeqName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // ADSR + LFO Synth state
  const [patch, setPatch] = useState<EnvelopePatch>({
    name: 'Harmonic Swell',
    attack: 0.25,
    decay: 0.25,
    sustain: 0.65,
    release: 0.35,
    lfoRate: 8,
    lfoDepth: 0.45,
    phaseOffset: 0.3,
  });

  const isSequencerPlaying = activeMode === 'sequencer';
  const isSynthPlaying = activeMode === 'synth';

  const handleCycleStepValue = (idx: number, channel: 'strong' | 'weak') => {
    const levels = [0, 0.35, 0.7, 1.0];
    setSteps((prev) => {
      const next = prev.map((s, i) => {
        if (i !== idx) return s;
        const curr = s[channel];
        const nextLevel =
          levels.find((lvl) => lvl > curr + 0.05) ?? 0;
        return { ...s, [channel]: nextLevel };
      });
      if (isSequencerPlaying) {
        engine.startSequencer(next, bpm, gateRatio);
      }
      return next;
    });
  };

  const handleToggleAccent = (idx: number) => {
    setSteps((prev) => {
      const next = prev.map((s, i) =>
        i === idx ? { ...s, accent: !s.accent } : s
      );
      if (isSequencerPlaying) {
        engine.startSequencer(next, bpm, gateRatio);
      }
      return next;
    });
  };

  const handleLoadPreset = (presetName: string) => {
    const preset = defaultSequencerPresets[presetName];
    if (!preset) return;
    const cloned = preset.steps.map((s) => ({ ...s }));
    setBpm(preset.bpm);
    setSteps(cloned);
    engine.startSequencer(cloned, preset.bpm, gateRatio);
  };

  const handleSaveSequencerToLibrary = (e: React.FormEvent) => {
    e.preventDefault();
    const title =
      seqName.trim() || `Seq ${bpm}BPM #${Math.floor(10 + Math.random() * 89)}`;
    const snapshotSteps = steps.map((s) => ({ ...s }));
    const snapshotBpm = bpm;
    const snapshotGate = gateRatio;

    onSaveCustomPattern(title, {
      color: 'orange',
      category: 'sequencer',
      description: `16-step sequence at ${snapshotBpm} BPM`,
      fn: (t: number) => {
        const res = evaluateSequencerAtTime(
          snapshotSteps,
          t,
          snapshotBpm,
          snapshotGate
        );
        return [res.strong, res.weak];
      },
    });
    setSeqName('');
    setStatusMessage(`Saved "${title}" to Pattern Library`);
  };

  const handleSaveSynthToLibrary = () => {
    const snapshotPatch = { ...patch };
    const title = snapshotPatch.name.trim() || 'ADSR Synth Patch';
    onSaveCustomPattern(title, {
      color: 'cyan',
      category: 'synth',
      description: `ADSR + ${snapshotPatch.lfoRate}Hz LFO synth patch`,
      fn: (t: number) => evaluateEnvelopeSynth(snapshotPatch, t),
    });
    setStatusMessage(`Saved "${title}" to Pattern Library`);
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] p-4 sm:p-6 space-y-5">
      {/* Top Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Tactile Step Sequencer & Envelope Synthesizer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compose 16-step poly-motor rhythms or sculpt ADSR + LFO tactile envelopes
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-[#0D0F14] border border-slate-300/60 dark:border-[#232733]">
          <button
            type="button"
            onClick={() => setLabTab('sequencer')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              labTab === 'sequencer'
                ? 'bg-white dark:bg-[#232734] text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            16-Step Sequencer
          </button>
          <button
            type="button"
            onClick={() => setLabTab('synth')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              labTab === 'synth'
                ? 'bg-white dark:bg-[#232734] text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            ADSR + LFO Synth
          </button>
        </div>
      </div>

      {labTab === 'sequencer' ? (
        <div className="space-y-5">
          {/* Transport & Preset Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200/80 dark:border-[#20242F]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isSequencerPlaying) {
                    engine.stopAll();
                  } else {
                    engine.startSequencer(steps, bpm, gateRatio);
                  }
                }}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                  isSequencerPlaying
                    ? 'bg-[#FF5500] text-white'
                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                }`}
              >
                {isSequencerPlaying ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Sequence</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run 16-Step Loop</span>
                  </>
                )}
              </button>

              {Object.keys(defaultSequencerPresets).map((presetName) => (
                <button
                  key={presetName}
                  type="button"
                  onClick={() => handleLoadPreset(presetName)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-[#272C3A] hover:border-[#FF5500] text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap"
                >
                  {presetName}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  const cleared = steps.map(() => ({
                    strong: 0,
                    weak: 0,
                    accent: false,
                  }));
                  setSteps(cleared);
                  if (isSequencerPlaying) engine.stopAll();
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-[#272C3A] text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>

            {/* BPM & Gate Sliders */}
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex-1 sm:w-36">
                <div className="flex justify-between text-[11px] font-mono mb-0.5">
                  <span className="text-slate-500">TEMPO</span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {bpm} BPM
                  </span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={220}
                  value={bpm}
                  aria-label="Sequencer Tempo BPM"
                  onChange={(e) => {
                    const nextBpm = Number(e.target.value);
                    setBpm(nextBpm);
                    if (isSequencerPlaying) {
                      engine.startSequencer(steps, nextBpm, gateRatio);
                    }
                  }}
                  className="tactile-fader"
                />
              </div>
              <div className="flex-1 sm:w-32">
                <div className="flex justify-between text-[11px] font-mono mb-0.5">
                  <span className="text-slate-500">GATE</span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {Math.round(gateRatio * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={gateRatio}
                  aria-label="Sequencer Step Gate Ratio"
                  onChange={(e) => {
                    const nextGate = Number(e.target.value);
                    setGateRatio(nextGate);
                    if (isSequencerPlaying) {
                      engine.startSequencer(steps, bpm, nextGate);
                    }
                  }}
                  className="tactile-fader"
                />
              </div>
            </div>
          </div>

          {/* 16-Step Matrix Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-16 gap-2">
            {steps.map((step, idx) => {
              const isCurrent = isSequencerPlaying && currentStepIndex === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-xl p-2 border flex flex-col items-center gap-2 transition-colors ${
                    isCurrent
                      ? 'bg-[#FF5500]/15 border-[#FF5500]'
                      : 'bg-slate-50 dark:bg-[#0D0F14] border-slate-200/80 dark:border-[#222632]'
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-400">
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {/* Dual Channel Step Bars (Tap to cycle 0 -> 35% -> 70% -> 100%) */}
                  <div className="w-full grid grid-cols-2 gap-1 h-20 items-end">
                    <button
                      type="button"
                      onClick={() => handleCycleStepValue(idx, 'strong')}
                      aria-label={`Step ${idx + 1} Strong Motor ${Math.round(
                        step.strong * 100
                      )}%`}
                      className="h-full w-full rounded-md bg-slate-200 dark:bg-[#191C26] overflow-hidden flex flex-col justify-end cursor-pointer"
                      title="Tap to cycle Strong motor level"
                    >
                      <div
                        className="w-full bg-[#FFB800] transition-all"
                        style={{ height: `${Math.round(step.strong * 100)}%` }}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCycleStepValue(idx, 'weak')}
                      aria-label={`Step ${idx + 1} Weak Motor ${Math.round(
                        step.weak * 100
                      )}%`}
                      className="h-full w-full rounded-md bg-slate-200 dark:bg-[#191C26] overflow-hidden flex flex-col justify-end cursor-pointer"
                      title="Tap to cycle Weak motor level"
                    >
                      <div
                        className="w-full bg-[#00E5FF] transition-all"
                        style={{ height: `${Math.round(step.weak * 100)}%` }}
                      />
                    </button>
                  </div>

                  {/* Accent Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleAccent(idx)}
                    aria-label={`Step ${idx + 1} Accent`}
                    className={`w-full min-h-[24px] rounded text-[10px] font-mono font-semibold cursor-pointer ${
                      step.accent
                        ? 'bg-[#FF5500] text-white'
                        : 'bg-slate-200/70 dark:bg-[#191C26] text-slate-500'
                    }`}
                  >
                    ACC
                  </button>
                </div>
              );
            })}
          </div>

          {/* Save Sequence to Pattern Library */}
          <form
            onSubmit={handleSaveSequencerToLibrary}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-slate-200 dark:border-[#222632]"
          >
            <input
              type="text"
              value={seqName}
              onChange={(e) => setSeqName(e.target.value)}
              placeholder="Name your 16-step sequence..."
              aria-label="Sequence name"
              className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200 dark:border-[#242834] text-xs text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Save Sequence to Pattern Library</span>
            </button>
          </form>
        </div>
      ) : (
        /* ADSR + LFO Texture Synthesizer Tab */
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                key: 'attack',
                label: 'Attack Time',
                min: 0.05,
                max: 1.0,
                step: 0.05,
                unit: 's',
              },
              {
                key: 'decay',
                label: 'Decay Time',
                min: 0.05,
                max: 1.0,
                step: 0.05,
                unit: 's',
              },
              {
                key: 'sustain',
                label: 'Sustain Level',
                min: 0.1,
                max: 1.0,
                step: 0.05,
                unit: '',
              },
              {
                key: 'release',
                label: 'Release Tail',
                min: 0.05,
                max: 1.0,
                step: 0.05,
                unit: 's',
              },
              {
                key: 'lfoRate',
                label: 'LFO Tremolo Rate',
                min: 1,
                max: 20,
                step: 0.5,
                unit: ' Hz',
              },
              {
                key: 'lfoDepth',
                label: 'LFO Modulation Depth',
                min: 0,
                max: 1.0,
                step: 0.05,
                unit: '',
              },
            ].map((param) => {
              const val = patch[param.key as keyof EnvelopePatch] as number;
              return (
                <div
                  key={param.key}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200/80 dark:border-[#20242F]"
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {param.label}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {val.toFixed(2)}
                      {param.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={val}
                    aria-label={param.label}
                    onChange={(e) => {
                      const nextPatch = {
                        ...patch,
                        [param.key]: Number(e.target.value),
                      };
                      setPatch(nextPatch);
                      if (isSynthPlaying) {
                        engine.startSynthPatch(nextPatch);
                      }
                    }}
                    className="tactile-fader"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-[#222632]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isSynthPlaying) {
                    engine.stopAll();
                  } else {
                    engine.startSynthPatch(patch);
                  }
                }}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer ${
                  isSynthPlaying
                    ? 'bg-[#FF5500] text-white'
                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isSynthPlaying ? 'Stop Synth Patch' : 'Audition ADSR Patch'}
                </span>
              </button>

              <input
                type="text"
                value={patch.name}
                onChange={(e) => setPatch({ ...patch, name: e.target.value })}
                aria-label="Synth patch name"
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200 dark:border-[#242834] text-xs text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveSynthToLibrary}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF5500] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Save Patch to Library</span>
            </button>
          </div>
        </div>
      )}

      {statusMessage && (
        <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
          {statusMessage}
        </p>
      )}
    </div>
  );
};
