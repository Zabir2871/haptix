/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Waves,
  Move,
  Sliders,
  Grid,
  Sun,
  Moon,
  OctagonX,
} from 'lucide-react';
import {
  engine,
  getPatternNames,
  patterns,
  registerCustomPattern,
  startGamepadPoller,
  state,
  TelemetryFrame,
} from './engine/hapticsEngine';
import {
  formatCountdownTimer,
  PatternDefinition,
  RecordedFrame,
} from './engine/hapticsLogic';
import { TactileVisualizerDeck } from './components/TactileVisualizerDeck';
import { PatternStudioGrid } from './components/PatternStudioGrid';
import { XYTouchMatrix } from './components/XYTouchMatrix';
import { StepSequencerLab } from './components/StepSequencerLab';
import { RoutingAndHardwarePanel } from './components/RoutingAndHardwarePanel';
import { PWAInstallControl } from './components/PWAInstallControl';

type WorkspaceSection = 'patterns' | 'xypad' | 'sequencer' | 'hardware';

const FAVORITES_STORAGE_KEY = 'haptics_pro_favorites_v1';
const CUSTOM_LOOPS_STORAGE_KEY = 'haptics_pro_custom_loops_v1';

interface StoredLoopRecord {
  name: string;
  frames: RecordedFrame[];
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('patterns');
  const [masterStrength, setMasterStrength] = useState(state.masterStrength);
  const [patternTempo, setPatternTempo] = useState(state.patternTempo);
  const [lrBalance, setLrBalance] = useState(state.lrBalance);
  const [routing, setRouting] = useState({ ...state.routing });
  const [highlightedIndex, setHighlightedIndex] = useState(state.selectedPatternIndex);
  const [manualStrong, setManualStrong] = useState(0);
  const [manualWeak, setManualWeak] = useState(0);
  const [activeTimerMins, setActiveTimerMins] = useState<number | null>(null);
  const [timerText, setTimerText] = useState<string | null>(null);
  const [patternVersion, setPatternVersion] = useState(0);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : ['Heartbeat', 'Fireworks', 'Roller Coaster'];
    } catch {
      return ['Heartbeat', 'Fireworks', 'Roller Coaster'];
    }
  });

  const [telemetry, setTelemetry] = useState<TelemetryFrame>({
    strong: 0,
    weak: 0,
    rawStrong: 0,
    rawWeak: 0,
    activeMode: null,
    activePatternName: null,
    connectedControllers: 0,
    controllerNames: [],
    sequencerStep: 0,
    timestamp: 0,
  });

  // Restore saved custom XY loops from localStorage for offline persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_LOOPS_STORAGE_KEY);
      if (raw) {
        const list: StoredLoopRecord[] = JSON.parse(raw);
        list.forEach((item) => {
          if (item.name && Array.isArray(item.frames) && item.frames.length > 2) {
            const totalDuration = Math.max(
              50,
              item.frames[item.frames.length - 1].time - item.frames[0].time
            );
            registerCustomPattern(item.name, {
              color: 'orange',
              category: 'custom',
              description: 'Recorded XY motion loop',
              fn: (t: number) => {
                const elapsedMs = (t * 1000) % totalDuration;
                let target = item.frames[0];
                for (let i = 0; i < item.frames.length; i++) {
                  if (item.frames[i].time - item.frames[0].time > elapsedMs) break;
                  target = item.frames[i];
                }
                return [target.strong, target.weak];
              },
            });
          }
        });
        setPatternVersion((v) => v + 1);
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  // Sync dark/light class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Subscribe to VibrationEngine telemetry & start gamepad poller
  useEffect(() => {
    const unsubscribe = engine.subscribe((frame) => {
      setTelemetry({ ...frame });
    });

    engine.onTimerExpired = () => {
      state.timerEnd = 0;
      setTimerText(null);
      setActiveTimerMins(null);
    };

    startGamepadPoller(() => {
      setHighlightedIndex(state.selectedPatternIndex);
      setManualStrong(state.manualStrong);
      setManualWeak(state.manualWeak);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        engine.stopAll();
        state.timerEnd = 0;
        setTimerText(null);
        setActiveTimerMins(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Sleep Timer interval
  useEffect(() => {
    if (!activeTimerMins || state.timerEnd <= 0) return;
    const id = setInterval(() => {
      const remain = state.timerEnd - Date.now();
      if (remain <= 0) {
        state.timerEnd = 0;
        setTimerText(null);
        setActiveTimerMins(null);
        engine.stopAll();
        clearInterval(id);
      } else {
        setTimerText(formatCountdownTimer(remain));
      }
    }, 500);
    return () => clearInterval(id);
  }, [activeTimerMins]);

  const handleEmergencyStop = () => {
    engine.stopAll();
    state.timerEnd = 0;
    state.manualStrong = 0;
    state.manualWeak = 0;
    setManualStrong(0);
    setManualWeak(0);
    setTimerText(null);
    setActiveTimerMins(null);
  };

  const handleSelectPattern = (name: string, index: number) => {
    state.selectedPatternIndex = index;
    setHighlightedIndex(index);
    engine.startPattern(name);
  };

  const handleToggleFavorite = (name: string) => {
    setFavorites((prev) => {
      const next = prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name];
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleUpdateStrength = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    state.masterStrength = clamped;
    setMasterStrength(clamped);
  };

  const handleUpdateTempo = (val: number) => {
    const clamped = Math.max(0.1, Math.min(3.0, val));
    state.patternTempo = clamped;
    setPatternTempo(clamped);
  };

  const handleUpdateBalance = (val: number) => {
    const clamped = Math.max(-1.0, Math.min(1.0, val));
    state.lrBalance = clamped;
    setLrBalance(clamped);
    // If currently in manual or XY pad static state, re-dispatch so balance updates live
    if (
      engine.activeMode === 'manual' ||
      engine.activeMode === 'xy-pad' ||
      engine.activeMode === null
    ) {
      if (engine.rawStrong > 0 || engine.rawWeak > 0) {
        engine.dispatchVibration(engine.rawStrong, engine.rawWeak);
      }
    }
  };

  const handleUpdateRouting = (key: keyof typeof state.routing, val: boolean) => {
    state.routing[key] = val;
    setRouting({ ...state.routing });
  };

  const handleStartTimer = (mins: number) => {
    state.timerEnd = Date.now() + mins * 60 * 1000;
    setActiveTimerMins(mins);
    setTimerText(formatCountdownTimer(mins * 60 * 1000));
  };

  const handleClearTimer = () => {
    state.timerEnd = 0;
    setActiveTimerMins(null);
    setTimerText(null);
  };

  const handleManualAdjust = (strongDelta: number, weakDelta: number) => {
    state.manualStrong = Math.max(0, Math.min(1, state.manualStrong + strongDelta));
    state.manualWeak = Math.max(0, Math.min(1, state.manualWeak + weakDelta));
    setManualStrong(state.manualStrong);
    setManualWeak(state.manualWeak);
    engine.startManualMode();
  };

  const handleSaveRecordedLoop = (name: string, frames: RecordedFrame[]) => {
    if (frames.length < 2) return;
    const totalDuration = Math.max(50, frames[frames.length - 1].time - frames[0].time);
    registerCustomPattern(name, {
      color: 'orange',
      category: 'custom',
      description: 'Recorded XY motion loop',
      fn: (t: number) => {
        const elapsedMs = (t * 1000) % totalDuration;
        let target = frames[0];
        for (let i = 0; i < frames.length; i++) {
          if (frames[i].time - frames[0].time > elapsedMs) break;
          target = frames[i];
        }
        return [target.strong, target.weak];
      },
    });

    try {
      const existingRaw = localStorage.getItem(CUSTOM_LOOPS_STORAGE_KEY);
      const list: StoredLoopRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
      list.unshift({ name, frames });
      localStorage.setItem(CUSTOM_LOOPS_STORAGE_KEY, JSON.stringify(list.slice(0, 12)));
    } catch {
      // Ignore
    }

    setPatternVersion((v) => v + 1);
    const names = getPatternNames();
    const idx = names.indexOf(name);
    if (idx >= 0) {
      handleSelectPattern(name, idx);
    }
  };

  const handleSaveCustomPattern = (name: string, def: PatternDefinition) => {
    registerCustomPattern(name, def);
    setPatternVersion((v) => v + 1);
    const names = getPatternNames();
    const idx = names.indexOf(name);
    if (idx >= 0) {
      handleSelectPattern(name, idx);
    }
  };

  const handleDeleteCustomPattern = (name: string) => {
    if (telemetry.activePatternName === name) {
      engine.stopAll();
    }
    delete patterns[name];
    try {
      const existingRaw = localStorage.getItem(CUSTOM_LOOPS_STORAGE_KEY);
      if (existingRaw) {
        const list: StoredLoopRecord[] = JSON.parse(existingRaw);
        localStorage.setItem(
          CUSTOM_LOOPS_STORAGE_KEY,
          JSON.stringify(list.filter((item) => item.name !== name))
        );
      }
    } catch {
      // Ignore
    }
    setPatternVersion((v) => v + 1);
  };

  // Reference patternVersion so React re-evaluates patterns map when custom patterns are added
  void patternVersion;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F3EF] dark:bg-[#0C0D10] text-slate-900 dark:text-slate-100 pb-20 lg:pb-10">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 lg:px-8 bg-[#F4F3EF]/90 dark:bg-[#0C0D10]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-[#1E222D] flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('patterns');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          Haptics Pro
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary Studio Navigation"
          className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400"
        >
          {(
            [
              { id: 'patterns', label: 'Pattern Studio' },
              { id: 'xypad', label: 'XY Vector Pad' },
              { id: 'sequencer', label: 'Step Sequencer' },
              { id: 'hardware', label: 'Routing & Gain' },
            ] as const
          ).map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveSection(item.id);
                if (item.id === 'hardware') {
                  document.getElementById('hardware-rack')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeSection === item.id
                  ? 'text-slate-900 dark:text-white border-[#FF5500]'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Primary Action (PWA Offline Install + Theme Switch) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={darkMode ? 'Switch to Daylight Studio theme' : 'Switch to Obsidian Studio theme'}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-white dark:bg-[#161922] border border-slate-200 dark:border-[#262B38] flex items-center justify-center text-slate-700 dark:text-slate-200 hover:border-[#FF5500] transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <PWAInstallControl />
        </div>
      </header>

      {/* Main Responsive Studio Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5 space-y-4 sm:space-y-5">
        {/* Top Real-Time Dual-Motor Oscilloscope & Transport Deck */}
        <TactileVisualizerDeck
          telemetry={telemetry}
          masterStrength={masterStrength}
          patternTempo={patternTempo}
          lrBalance={lrBalance}
          timerText={timerText}
          audioSynthEnabled={routing.audioSynth}
          onToggleAudioSynth={() =>
            handleUpdateRouting('audioSynth', !routing.audioSynth)
          }
          onEmergencyStop={handleEmergencyStop}
        />

        {/* Desktop Asymmetric Split Console / Mobile Tab-Switched Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Left / Main Stage Column (8 cols on Desktop) */}
          <div className="lg:col-span-8 space-y-5">
            {/* Active Primary Module */}
            {(activeSection === 'patterns' || activeSection === 'hardware') && (
              <div className={activeSection === 'hardware' ? 'hidden lg:block' : 'block'}>
                <PatternStudioGrid
                  patternsMap={patterns}
                  activePatternName={telemetry.activePatternName}
                  highlightedIndex={highlightedIndex}
                  favorites={favorites}
                  onSelectPattern={handleSelectPattern}
                  onStopPattern={handleEmergencyStop}
                  onToggleFavorite={handleToggleFavorite}
                  onDeleteCustomPattern={handleDeleteCustomPattern}
                />
              </div>
            )}

            {activeSection === 'xypad' && (
              <XYTouchMatrix onSaveRecordedLoop={handleSaveRecordedLoop} />
            )}

            {activeSection === 'sequencer' && (
              <StepSequencerLab
                activeMode={telemetry.activeMode}
                currentStepIndex={telemetry.sequencerStep}
                onSaveCustomPattern={handleSaveCustomPattern}
              />
            )}
          </div>

          {/* Right Parameter & Hardware Column (Always visible on Desktop 4 cols; visible on Mobile when 'hardware' tab selected) */}
          <aside
            id="hardware-rack"
            aria-label="Global Modifiers and Target Routing"
            className={`lg:col-span-4 ${
              activeSection === 'hardware' ? 'block' : 'hidden lg:block'
            }`}
          >
            <RoutingAndHardwarePanel
              routing={routing}
              masterStrength={masterStrength}
              patternTempo={patternTempo}
              lrBalance={lrBalance}
              activeTimerMins={activeTimerMins}
              timerText={timerText}
              manualStrong={manualStrong}
              manualWeak={manualWeak}
              onUpdateRouting={handleUpdateRouting}
              onUpdateStrength={handleUpdateStrength}
              onUpdateTempo={handleUpdateTempo}
              onUpdateBalance={handleUpdateBalance}
              onStartTimer={handleStartTimer}
              onClearTimer={handleClearTimer}
              onManualAdjust={handleManualAdjust}
            />
          </aside>
        </div>
      </main>

      {/* Mobile Ergonomic Bottom Thumb Navigation Bar (<= 15% viewport height cap) */}
      <nav
        aria-label="Mobile Bottom Thumb Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-[#111318]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#232733] grid grid-cols-5 items-center px-2"
      >
        {(
          [
            { id: 'patterns', label: 'Patterns', icon: Waves },
            { id: 'xypad', label: 'XY Pad', icon: Move },
            { id: 'sequencer', label: 'Sequencer', icon: Grid },
            { id: 'hardware', label: 'Controls', icon: Sliders },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const isSelected = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                isSelected
                  ? 'text-[#FF5500]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold tracking-tight mt-0.5 whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Instant Thumb-Zone Stop Button on Mobile */}
        <button
          type="button"
          onClick={handleEmergencyStop}
          aria-label="Mobile Quick Emergency Stop"
          className="min-h-[46px] mx-1 rounded-xl bg-[#FF5500] text-white flex flex-col items-center justify-center font-bold active:scale-95 transition-transform cursor-pointer"
        >
          <OctagonX className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
            STOP
          </span>
        </button>
      </nav>
    </div>
  );
}
