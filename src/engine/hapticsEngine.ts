import {
  corePatterns,
  EnvelopePatch,
  evaluateEnvelopeSynth,
  evaluateSequencerAtTime,
  PatternDefinition,
  RecordedFrame,
  SequencerStep,
} from './hapticsLogic';

/**
 * APP STATE & ROUTING (Preserved from original Haptics Pro engine)
 */
export interface HapticsState {
  masterStrength: number;
  patternTempo: number;
  routing: {
    main: boolean;
    triggers: boolean;
    syncAll: boolean;
    phone: boolean;
    audioSynth: boolean; // Acoustic Sub-Bass Haptic Transducer
  };
  recording: boolean;
  recordedFrames: RecordedFrame[];
  timerEnd: number;
  selectedPatternIndex: number;
  manualStrong: number;
  manualWeak: number;
}

export const state: HapticsState = {
  masterStrength: 1.0,
  patternTempo: 1.0,
  routing: {
    main: true,
    triggers: false,
    syncAll: false,
    phone: typeof navigator !== 'undefined' && 'vibrate' in navigator,
    audioSynth: false,
  },
  recording: false,
  recordedFrames: [],
  timerEnd: 0,
  selectedPatternIndex: 0,
  manualStrong: 0,
  manualWeak: 0,
};

export const patterns: Record<string, PatternDefinition> = {
  ...corePatterns,
};

export function getPatternNames(): string[] {
  return Object.keys(patterns);
}

/**
 * Optional Acoustic-Haptic Sub-Bass Synthesizer for devices without physical gamepads
 * or for multimodal tactile reinforcement.
 */
class AcousticHapticTransducer {
  private ctx: AudioContext | null = null;
  private strongOsc: OscillatorNode | null = null;
  private weakOsc: OscillatorNode | null = null;
  private strongGain: GainNode | null = null;
  private weakGain: GainNode | null = null;

  private ensureInit() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.strongOsc = this.ctx.createOscillator();
      this.weakOsc = this.ctx.createOscillator();
      this.strongGain = this.ctx.createGain();
      this.weakGain = this.ctx.createGain();

      // Strong motor = 58Hz deep sub-bass thump; Weak motor = 165Hz crisp harmonic buzz
      this.strongOsc.type = 'sine';
      this.strongOsc.frequency.value = 58;
      this.weakOsc.type = 'triangle';
      this.weakOsc.frequency.value = 165;

      this.strongGain.gain.value = 0;
      this.weakGain.gain.value = 0;

      this.strongOsc.connect(this.strongGain);
      this.weakOsc.connect(this.weakGain);
      this.strongGain.connect(this.ctx.destination);
      this.weakGain.connect(this.ctx.destination);

      this.strongOsc.start();
      this.weakOsc.start();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  update(strong: number, weak: number, enabled: boolean) {
    if (!enabled || (strong <= 0.005 && weak <= 0.005)) {
      if (this.strongGain && this.weakGain && this.ctx) {
        this.strongGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015);
        this.weakGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015);
      }
      return;
    }
    this.ensureInit();
    if (!this.ctx || !this.strongGain || !this.weakGain || !this.strongOsc || !this.weakOsc) return;

    const now = this.ctx.currentTime;
    this.strongOsc.frequency.setTargetAtTime(48 + strong * 28, now, 0.02);
    this.weakOsc.frequency.setTargetAtTime(135 + weak * 90, now, 0.02);
    this.strongGain.gain.setTargetAtTime(strong * 0.25, now, 0.015);
    this.weakGain.gain.setTargetAtTime(weak * 0.12, now, 0.015);
  }

  stop() {
    if (this.strongGain && this.weakGain && this.ctx) {
      this.strongGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
      this.weakGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    }
  }
}

const acousticTransducer = new AcousticHapticTransducer();

export interface TelemetryFrame {
  strong: number;
  weak: number;
  rawStrong: number;
  rawWeak: number;
  activeMode: string | null;
  activePatternName: string | null;
  connectedControllers: number;
  controllerNames: string[];
  sequencerStep: number;
  timestamp: number;
}

type TelemetryListener = (frame: TelemetryFrame) => void;

/**
 * CORE VIBRATION ENGINE (Preserved core methods and behavior)
 */
export class VibrationEngine {
  public activeMode: string | null = null;
  public animationFrame: number | null = null;
  public startTime = 0;
  public currentPattern: PatternDefinition | null = null;
  public activePatternName: string | null = null;
  public lastPhoneVib = 0;
  public phoneVibActive = false;
  public currentStrong = 0;
  public currentWeak = 0;
  public rawStrong = 0;
  public rawWeak = 0;
  public currentSequencerStep = 0;

  private listeners = new Set<TelemetryListener>();
  public onTimerExpired: (() => void) | null = null;

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notifyListeners(connectedControllers = 0, controllerNames: string[] = []) {
    const frame: TelemetryFrame = {
      strong: this.currentStrong,
      weak: this.currentWeak,
      rawStrong: this.rawStrong,
      rawWeak: this.rawWeak,
      activeMode: this.activeMode,
      activePatternName: this.activePatternName,
      connectedControllers,
      controllerNames,
      sequencerStep: this.currentSequencerStep,
      timestamp: performance.now(),
    };
    this.listeners.forEach((fn) => fn(frame));
  }

  public dispatchVibration(strong: number, weak: number) {
    this.rawStrong = Math.max(0, Math.min(1, strong));
    this.rawWeak = Math.max(0, Math.min(1, weak));

    strong = Math.max(0, Math.min(1, strong * state.masterStrength));
    weak = Math.max(0, Math.min(1, weak * state.masterStrength));

    this.currentStrong = strong;
    this.currentWeak = weak;

    if (state.recording) {
      state.recordedFrames.push({ strong, weak, time: Date.now() });
    }

    // Acoustic Sub-Bass Transducer Routing
    acousticTransducer.update(strong, weak, state.routing.audioSynth);

    // Phone Routing (Preserved from core engine)
    if (state.routing.phone && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const combinedMag = Math.max(strong, weak);
      const now = Date.now();
      if (combinedMag > 0.05) {
        if (now - this.lastPhoneVib > 50) {
          try {
            navigator.vibrate(Math.floor(combinedMag * 50));
          } catch {
            // Ignore blocked vibrate call before user gesture
          }
          this.lastPhoneVib = now;
          this.phoneVibActive = true;
        }
      } else if (this.phoneVibActive) {
        try {
          navigator.vibrate(0);
        } catch {
          // Ignore
        }
        this.phoneVibActive = false;
      }
    }

    // Gamepad Routing (Preserved from core engine)
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        const actuator = gp ? (gp as unknown as { vibrationActuator?: { playEffect?: (type: string, params: Record<string, number>) => void } }).vibrationActuator : null;
        if (!gp || !actuator) continue;
        if (!state.routing.syncAll && i > 0) break;

        const effectParams = {
          duration: 50,
          startDelay: 0,
          strongMagnitude: state.routing.main ? strong : 0,
          weakMagnitude: state.routing.main ? weak : 0,
          leftTrigger: state.routing.triggers ? strong : 0,
          rightTrigger: state.routing.triggers ? weak : 0,
        };

        try {
          if (actuator.playEffect) {
            actuator.playEffect('dual-rumble', effectParams);
          }
        } catch (e) {
          console.error('Vibration failed:', e);
        }
      }
    }
  }

  public stopAll() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.activeMode = null;
    this.activePatternName = null;
    this.dispatchVibration(0, 0);
    acousticTransducer.stop();

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore
      }
    }
  }

  public startManualMode() {
    if (this.activeMode !== 'manual') {
      this.stopAll();
      this.activeMode = 'manual';
      this.activePatternName = 'Manual Control';

      const loop = () => {
        if (this.activeMode !== 'manual') return;
        this.dispatchVibration(state.manualStrong, state.manualWeak);
        this.animationFrame = requestAnimationFrame(loop);
      };
      this.animationFrame = requestAnimationFrame(loop);
    }
  }

  public startPattern(patternName: string) {
    if (!patterns[patternName]) return;
    this.stopAll();
    this.activeMode = 'pattern';
    this.activePatternName = patternName;
    this.currentPattern = patterns[patternName];
    this.startTime = performance.now();

    const loop = (timestamp: number) => {
      if (this.activeMode !== 'pattern' || !this.currentPattern) return;
      if (state.timerEnd > 0 && Date.now() > state.timerEnd) {
        if (this.onTimerExpired) this.onTimerExpired();
        this.stopAll();
        return;
      }

      const elapsed = (timestamp - this.startTime) / 1000;
      const adjustedTime = elapsed * state.patternTempo;

      const [strong, weak] = this.currentPattern.fn(adjustedTime);
      this.dispatchVibration(strong, weak);

      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  public startPlayback(frames: RecordedFrame[], label = 'Custom Loop') {
    this.stopAll();
    this.activeMode = 'recordPlayback';
    this.activePatternName = label;
    this.startTime = performance.now();
    if (frames.length === 0) return;

    const totalDuration = Math.max(50, frames[frames.length - 1].time - frames[0].time);

    const loop = (timestamp: number) => {
      if (this.activeMode !== 'recordPlayback') return;
      if (state.timerEnd > 0 && Date.now() > state.timerEnd) {
        if (this.onTimerExpired) this.onTimerExpired();
        this.stopAll();
        return;
      }

      let elapsedMs = (timestamp - this.startTime) * state.patternTempo;
      elapsedMs = elapsedMs % totalDuration;

      let targetFrame = frames[0];
      for (let i = 0; i < frames.length; i++) {
        const relTime = frames[i].time - frames[0].time;
        if (relTime > elapsedMs) break;
        targetFrame = frames[i];
      }

      this.dispatchVibration(targetFrame.strong, targetFrame.weak);
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  public startSequencer(steps: SequencerStep[], bpm: number, gateRatio = 0.8) {
    this.stopAll();
    this.activeMode = 'sequencer';
    this.activePatternName = '16-Step Sequencer';
    this.startTime = performance.now();

    const loop = (timestamp: number) => {
      if (this.activeMode !== 'sequencer') return;
      if (state.timerEnd > 0 && Date.now() > state.timerEnd) {
        if (this.onTimerExpired) this.onTimerExpired();
        this.stopAll();
        return;
      }

      const elapsed = ((timestamp - this.startTime) / 1000) * state.patternTempo;
      const res = evaluateSequencerAtTime(steps, elapsed, bpm, gateRatio);
      this.currentSequencerStep = res.stepIndex;
      this.dispatchVibration(res.strong, res.weak);

      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  public startSynthPatch(patch: EnvelopePatch) {
    this.stopAll();
    this.activeMode = 'synth';
    this.activePatternName = patch.name;
    this.startTime = performance.now();

    const loop = (timestamp: number) => {
      if (this.activeMode !== 'synth') return;
      if (state.timerEnd > 0 && Date.now() > state.timerEnd) {
        if (this.onTimerExpired) this.onTimerExpired();
        this.stopAll();
        return;
      }

      const elapsed = ((timestamp - this.startTime) / 1000) * state.patternTempo;
      const [strong, weak] = evaluateEnvelopeSynth(patch, elapsed);
      this.dispatchVibration(strong, weak);

      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }
}

export const engine = new VibrationEngine();

/**
 * Register a custom pattern into the shared pattern dictionary
 */
export function registerCustomPattern(name: string, def: PatternDefinition) {
  patterns[name] = def;
}

/**
 * BACKGROUND INPUT POLLER (GAMEPAD CONTROLS) - Preserved from original Haptics Pro
 */
const lastButtonStates: Record<number, boolean[]> = {};
let pollerStarted = false;

export function startGamepadPoller(onStateSync?: () => void) {
  if (pollerStarted || typeof window === 'undefined') return;
  pollerStarted = true;

  function pollGamepadSystem() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let connected = 0;
    const names: string[] = [];
    const patternNames = getPatternNames();

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;

      names.push(gp.id || `Controller #${i + 1}`);
      if ((gp as unknown as { vibrationActuator?: unknown }).vibrationActuator) {
        connected++;
      } else {
        connected++;
      }
      if (!lastButtonStates[i]) lastButtonStates[i] = [];

      const pressed = (btnIndex: number) =>
        Boolean(gp.buttons[btnIndex] && gp.buttons[btnIndex].pressed);
      const justPressed = (btnIndex: number) =>
        pressed(btnIndex) && !lastButtonStates[i][btnIndex];

      // 1 (B / Circle) - Terminate
      if (justPressed(1)) {
        engine.stopAll();
        state.timerEnd = 0;
        state.manualStrong = 0;
        state.manualWeak = 0;
        if (onStateSync) onStateSync();
      }

      // 0 (A / Cross) - Play highlighted pattern
      if (justPressed(0)) {
        const selectedName = patternNames[state.selectedPatternIndex] || patternNames[0];
        engine.startPattern(selectedName);
        if (onStateSync) onStateSync();
      }

      // 4 (L1) - Previous Pattern
      if (justPressed(4)) {
        state.selectedPatternIndex--;
        if (state.selectedPatternIndex < 0) {
          state.selectedPatternIndex = patternNames.length - 1;
        }
        if (engine.activeMode === 'pattern') {
          engine.startPattern(patternNames[state.selectedPatternIndex]);
        }
        if (onStateSync) onStateSync();
      }

      // 5 (R1) - Next Pattern
      if (justPressed(5)) {
        state.selectedPatternIndex++;
        if (state.selectedPatternIndex >= patternNames.length) {
          state.selectedPatternIndex = 0;
        }
        if (engine.activeMode === 'pattern') {
          engine.startPattern(patternNames[state.selectedPatternIndex]);
        }
        if (onStateSync) onStateSync();
      }

      // --- Manual Control via D-Pad ---
      let manualChanged = false;

      // 12 (D-Pad Up) - Increase Strong Motor
      if (pressed(12)) {
        state.manualStrong = Math.min(1.0, state.manualStrong + 0.02);
        manualChanged = true;
      }

      // 13 (D-Pad Down) - Decrease Strong Motor
      if (pressed(13)) {
        state.manualStrong = Math.max(0.0, state.manualStrong - 0.02);
        manualChanged = true;
      }

      // 15 (D-Pad Right) - Increase Weak Motor
      if (pressed(15)) {
        state.manualWeak = Math.min(1.0, state.manualWeak + 0.02);
        manualChanged = true;
      }

      // 14 (D-Pad Left) - Decrease Weak Motor
      if (pressed(14)) {
        state.manualWeak = Math.max(0.0, state.manualWeak - 0.02);
        manualChanged = true;
      }

      if (manualChanged) {
        engine.startManualMode();
        if (onStateSync) onStateSync();
      }

      for (let b = 0; b < gp.buttons.length; b++) {
        lastButtonStates[i][b] = pressed(b);
      }
    }

    engine.notifyListeners(connected, names);
    requestAnimationFrame(pollGamepadSystem);
  }

  requestAnimationFrame(pollGamepadSystem);
}
