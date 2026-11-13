export interface RecordedFrame {
  strong: number;
  weak: number;
  time: number;
}

export interface SequencerStep {
  strong: number; // 0..1
  weak: number;   // 0..1
  accent: boolean;
}

export interface EnvelopePatch {
  name: string;
  attack: number;    // 0.05..1.0s
  decay: number;     // 0.05..1.0s
  sustain: number;   // 0..1
  release: number;   // 0.05..1.0s
  lfoRate: number;   // 0.5..20 Hz
  lfoDepth: number;  // 0..1
  phaseOffset: number; // 0..1 between strong and weak
}

export type PatternFn = (t: number) => [number, number];

export interface PatternDefinition {
  color: string;
  category?: 'core' | 'custom' | 'sequencer' | 'synth';
  description?: string;
  fn: PatternFn;
}

/**
 * Core mathematical patterns preserved 1:1 from original Haptics Pro engine
 */
export const corePatterns: Record<string, PatternDefinition> = {
  "Constant": {
    color: "blue",
    category: "core",
    description: "Sustained 100% dual-actuator output",
    fn: (t) => {
      void t;
      return [1, 1];
    },
  },
  "Pulse": {
    color: "indigo",
    category: "core",
    description: "1 Hz square wave on/off gate",
    fn: (t) => [
      Math.sin(t * Math.PI * 2) > 0 ? 1 : 0,
      Math.sin(t * Math.PI * 2) > 0 ? 1 : 0,
    ],
  },
  "Heartbeat": {
    color: "rose",
    category: "core",
    description: "Systolic/diastolic double-thump cardiac pulse",
    fn: (t) => {
      const beat = t % 1;
      const mag = beat < 0.1 || (beat > 0.25 && beat < 0.35) ? 1 : 0;
      return [mag, mag];
    },
  },
  "Wave": {
    color: "cyan",
    category: "core",
    description: "Smooth sinusoidal swell across both motors",
    fn: (t) => {
      const val = (Math.sin(t * Math.PI) + 1) / 2;
      return [val, val];
    },
  },
  "Sawtooth": {
    color: "yellow",
    category: "core",
    description: "Linear ramp up with sharp zero-reset drop",
    fn: (t) => {
      const val = t % 1;
      return [val, val];
    },
  },
  "Earthquake": {
    color: "orange",
    category: "core",
    description: "Stochastic seismic tremor across dual channels",
    fn: (t) => {
      void t;
      return [
        Math.random() > 0.2 ? 1 : 0.2,
        Math.random() > 0.5 ? 1 : 0.1,
      ];
    },
  },
  "Middle Strat": {
    color: "emerald",
    category: "core",
    description: "Balanced 40% strong / 60% weak steady equilibrium",
    fn: (t) => {
      void t;
      return [0.4, 0.6];
    },
  },
  "Fireworks": {
    color: "fuchsia",
    category: "core",
    description: "Launch climb, apex detonation, and fizzling tail",
    fn: (t) => {
      const cycle = t % 2;
      if (cycle < 1) return [cycle, 0];
      if (cycle < 1.1) return [1, 1];
      const fade = Math.max(0, 1 - (cycle - 1.1) * 3);
      return [0, fade];
    },
  },
  "Arch": {
    color: "sky",
    category: "core",
    description: "Parabolic half-sine arch cresting at 1.0s",
    fn: (t) => {
      const val = Math.sin((t % 2) * (Math.PI / 2));
      return [val, val];
    },
  },
  "Valley": {
    color: "purple",
    category: "core",
    description: "Inverted cosine trough with crisp rebound",
    fn: (t) => {
      const val = Math.cos((t % 2) * (Math.PI / 2));
      return [val, val];
    },
  },
  "Chirp": {
    color: "teal",
    category: "core",
    description: "Frequency-modulated sweep on high-freq weak rotor",
    fn: (t) => {
      const spd = 10 + (t % 2) * 20;
      const val = (Math.sin(t * spd) + 1) / 2;
      return [0, val];
    },
  },
  "Roller Coaster": {
    color: "pink",
    category: "core",
    description: "Poly-rhythmic 2:3 cross-phase motor oscillation",
    fn: (t) => {
      const strong = (Math.sin(t * 2) + 1) / 2;
      const weak = (Math.cos(t * 3) + 1) / 2;
      return [strong, weak];
    },
  },
  "Randomizer": {
    color: "white",
    category: "core",
    description: "Unpredictable dual-channel burst generator",
    fn: (t) => {
      void t;
      return [
        Math.random() > 0.4 ? Math.random() : 0,
        Math.random() > 0.4 ? Math.random() : 0,
      ];
    },
  },
};

/**
 * Clamps a numeric magnitude to [0, 1] with masterStrength scaling.
 */
export function scaleAndClampMagnitude(raw: number, masterStrength: number): number {
  if (Number.isNaN(raw) || Number.isNaN(masterStrength)) return 0;
  return Math.max(0, Math.min(1, raw * masterStrength));
}

/**
 * Computes Left (Strong) and Right (Weak) motor gain multipliers from a pan balance in [-1, 1].
 * -1.0 = Full Left (Strong 100%, Weak 0%)
 *  0.0 = Center (Strong 100%, Weak 100%)
 * +1.0 = Full Right (Strong 0%, Weak 100%)
 */
export function computeLRBalanceMultipliers(balance: number): {
  leftMultiplier: number;
  rightMultiplier: number;
} {
  if (Number.isNaN(balance)) {
    return { leftMultiplier: 1, rightMultiplier: 1 };
  }
  const clamped = Math.max(-1, Math.min(1, balance));
  if (clamped < 0) {
    return {
      leftMultiplier: 1,
      rightMultiplier: Math.max(0, Math.min(1, 1 + clamped)),
    };
  }
  if (clamped > 0) {
    return {
      leftMultiplier: Math.max(0, Math.min(1, 1 - clamped)),
      rightMultiplier: 1,
    };
  }
  return { leftMultiplier: 1, rightMultiplier: 1 };
}

/**
 * Formats an L/R balance value (-1..1) into a readable hardware telemetry label.
 */
export function formatLRBalanceLabel(balance: number): string {
  if (Number.isNaN(balance) || Math.abs(balance) < 0.02) {
    return 'CENTER (100/100)';
  }
  const clamped = Math.max(-1, Math.min(1, balance));
  if (clamped <= -0.99) return '100% L (STRONG)';
  if (clamped >= 0.99) return '100% R (WEAK)';
  if (clamped < 0) {
    return `L +${Math.round(Math.abs(clamped) * 100)}%`;
  }
  return `R +${Math.round(clamped * 100)}%`;
}

/**
 * Samples a pattern function over a time window [0, durationSec] for waveform rendering.
 */
export function samplePatternCurve(
  fn: PatternFn,
  sampleCount: number,
  durationSec = 2
): Array<{ t: number; strong: number; weak: number }> {
  const count = Math.max(2, Math.floor(sampleCount));
  const samples: Array<{ t: number; strong: number; weak: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * durationSec;
    const [s, w] = fn(t);
    samples.push({
      t,
      strong: Math.max(0, Math.min(1, s)),
      weak: Math.max(0, Math.min(1, w)),
    });
  }
  return samples;
}

/**
 * Evaluates a 16-step sequencer pattern at elapsed time `t` (in seconds) and BPM.
 */
export function evaluateSequencerAtTime(
  steps: SequencerStep[],
  t: number,
  bpm: number,
  gateRatio = 0.8
): { strong: number; weak: number; stepIndex: number } {
  if (!steps.length) return { strong: 0, weak: 0, stepIndex: 0 };
  const safeBpm = Math.max(30, Math.min(300, bpm));
  // 16th note duration in seconds = (60 / bpm) / 4
  const stepDuration = 15 / safeBpm;
  const totalCycle = stepDuration * steps.length;
  const normalizedT = ((t % totalCycle) + totalCycle) % totalCycle;
  const stepIndex = Math.min(
    steps.length - 1,
    Math.floor(normalizedT / stepDuration)
  );
  const posInStep = (normalizedT % stepDuration) / stepDuration;
  const step = steps[stepIndex];

  if (posInStep > gateRatio) {
    return { strong: 0, weak: 0, stepIndex };
  }

  const boost = step.accent ? 1.2 : 1.0;
  const envelope = posInStep < 0.1 ? posInStep / 0.1 : 1 - (posInStep - 0.1) * 0.25;
  return {
    strong: Math.max(0, Math.min(1, step.strong * boost * envelope)),
    weak: Math.max(0, Math.min(1, step.weak * boost * envelope)),
    stepIndex,
  };
}

/**
 * Evaluates an ADSR + LFO tactile synth patch over a 2-second loop cycle.
 */
export function evaluateEnvelopeSynth(patch: EnvelopePatch, t: number): [number, number] {
  const cycleDuration = Math.max(
    0.2,
    patch.attack + patch.decay + 0.6 + patch.release
  );
  const localT = ((t % cycleDuration) + cycleDuration) % cycleDuration;

  let env = 0;
  if (localT < patch.attack) {
    env = localT / Math.max(0.01, patch.attack);
  } else if (localT < patch.attack + patch.decay) {
    const dProgress = (localT - patch.attack) / Math.max(0.01, patch.decay);
    env = 1 - dProgress * (1 - patch.sustain);
  } else if (localT < cycleDuration - patch.release) {
    env = patch.sustain;
  } else {
    const rProgress =
      (localT - (cycleDuration - patch.release)) / Math.max(0.01, patch.release);
    env = patch.sustain * (1 - rProgress);
  }

  const lfoStrong =
    1 - patch.lfoDepth * 0.5 * (1 - Math.sin(t * Math.PI * 2 * patch.lfoRate));
  const lfoWeak =
    1 -
    patch.lfoDepth *
      0.5 *
      (1 - Math.sin((t + patch.phaseOffset) * Math.PI * 2 * patch.lfoRate));

  return [
    Math.max(0, Math.min(1, env * lfoStrong)),
    Math.max(0, Math.min(1, env * lfoWeak)),
  ];
}

/**
 * Formats remaining milliseconds into MM:SS countdown string.
 */
export function formatCountdownTimer(remainMs: number): string {
  if (remainMs <= 0) return '0:00';
  const m = Math.floor(remainMs / 60000);
  const s = Math.floor((remainMs % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Computes combined RMS tactile power (0..100%) and estimated mechanical RPM.
 */
export function computeTelemetryMetrics(strong: number, weak: number): {
  rmsPercent: number;
  strongRpm: number;
  weakRpm: number;
  powerWatts: number;
} {
  const s = Math.max(0, Math.min(1, strong));
  const w = Math.max(0, Math.min(1, weak));
  const rms = Math.sqrt((s * s + w * w) / 2);
  return {
    rmsPercent: Math.round(rms * 100),
    strongRpm: Math.round(s * 4200), // Heavy eccentric mass ~4200 RPM max
    weakRpm: Math.round(w * 9600),   // Light high-freq rotor ~9600 RPM max
    powerWatts: Number(((s * 1.85 + w * 0.95)).toFixed(2)),
  };
}

export const defaultSequencerPresets: Record<string, { bpm: number; steps: SequencerStep[] }> = {
  "Cybernetic Pulse": {
    bpm: 120,
    steps: [
      { strong: 1.0, weak: 0.2, accent: true },
      { strong: 0.0, weak: 0.6, accent: false },
      { strong: 0.4, weak: 0.0, accent: false },
      { strong: 0.0, weak: 0.8, accent: false },
      { strong: 0.9, weak: 0.3, accent: true },
      { strong: 0.0, weak: 0.5, accent: false },
      { strong: 0.3, weak: 0.9, accent: false },
      { strong: 0.0, weak: 0.4, accent: false },
      { strong: 1.0, weak: 0.0, accent: true },
      { strong: 0.5, weak: 0.5, accent: false },
      { strong: 0.0, weak: 1.0, accent: true },
      { strong: 0.2, weak: 0.4, accent: false },
      { strong: 0.8, weak: 0.2, accent: true },
      { strong: 0.4, weak: 0.6, accent: false },
      { strong: 0.2, weak: 0.8, accent: false },
      { strong: 0.0, weak: 1.0, accent: true },
    ],
  },
  "Sub-Bass Engine": {
    bpm: 96,
    steps: [
      { strong: 1.0, weak: 0.0, accent: true },
      { strong: 0.8, weak: 0.1, accent: false },
      { strong: 0.5, weak: 0.2, accent: false },
      { strong: 0.2, weak: 0.4, accent: false },
      { strong: 0.0, weak: 0.9, accent: true },
      { strong: 0.0, weak: 0.4, accent: false },
      { strong: 0.9, weak: 0.0, accent: true },
      { strong: 0.6, weak: 0.2, accent: false },
      { strong: 1.0, weak: 0.1, accent: true },
      { strong: 0.7, weak: 0.3, accent: false },
      { strong: 0.4, weak: 0.5, accent: false },
      { strong: 0.0, weak: 1.0, accent: true },
      { strong: 0.8, weak: 0.2, accent: false },
      { strong: 0.5, weak: 0.4, accent: false },
      { strong: 0.3, weak: 0.7, accent: false },
      { strong: 0.1, weak: 0.9, accent: false },
    ],
  },
  "Tactile Gallop": {
    bpm: 138,
    steps: [
      { strong: 1.0, weak: 0.4, accent: true },
      { strong: 0.0, weak: 0.7, accent: false },
      { strong: 0.0, weak: 0.7, accent: false },
      { strong: 0.9, weak: 0.3, accent: true },
      { strong: 0.0, weak: 0.7, accent: false },
      { strong: 0.0, weak: 0.7, accent: false },
      { strong: 0.8, weak: 0.5, accent: true },
      { strong: 0.0, weak: 0.8, accent: false },
      { strong: 1.0, weak: 0.2, accent: true },
      { strong: 0.0, weak: 0.6, accent: false },
      { strong: 0.0, weak: 0.6, accent: false },
      { strong: 0.9, weak: 0.4, accent: true },
      { strong: 0.0, weak: 0.8, accent: false },
      { strong: 0.5, weak: 0.5, accent: false },
      { strong: 0.8, weak: 0.9, accent: true },
      { strong: 1.0, weak: 1.0, accent: true },
    ],
  },
};
