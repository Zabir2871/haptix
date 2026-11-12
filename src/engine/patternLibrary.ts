import { EngineParameters, MotorChannels, PatternKeyframe, VibrationPattern } from '../types/haptics';

/**
 * Built-in curated JSON-serializable Haptic Pattern Library (Phase 3).
 */
export const DEFAULT_PATTERNS: VibrationPattern[] = [
  {
    id: 'continuous-drive',
    name: 'Continuous Drive',
    category: 'Wave',
    description: 'Steady unmodulated carrier drive locked directly to manual sliders or XY coordinates.',
    durationMs: 1000,
    keyframes: [
      { timeOffset: 0.0, intensity: 1.0, frequency: 0.5, triggerImpulse: 1.0, curve: 'linear' },
      { timeOffset: 1.0, intensity: 1.0, frequency: 0.5, triggerImpulse: 1.0, curve: 'linear' },
    ],
  },
  {
    id: 'heartbeat-lub-dub',
    name: 'Heartbeat',
    category: 'Organic',
    description: 'Biometric dual-pulse systole/diastole thump with heavy low-frequency ventricular resonance.',
    durationMs: 1000,
    keyframes: [
      { timeOffset: 0.0, intensity: 0.05, frequency: 0.2, triggerImpulse: 0.0, curve: 'step' },
      { timeOffset: 0.08, intensity: 0.95, frequency: 0.15, triggerImpulse: 0.85, curve: 'smooth' },
      { timeOffset: 0.2, intensity: 0.1, frequency: 0.2, triggerImpulse: 0.05, curve: 'step' },
      { timeOffset: 0.32, intensity: 0.68, frequency: 0.65, triggerImpulse: 0.55, curve: 'smooth' },
      { timeOffset: 0.46, intensity: 0.0, frequency: 0.1, triggerImpulse: 0.0, curve: 'linear' },
      { timeOffset: 1.0, intensity: 0.0, frequency: 0.1, triggerImpulse: 0.0, curve: 'linear' },
    ],
  },
  {
    id: 'sine-wave-swell',
    name: 'Wave',
    category: 'Wave',
    description: 'Smooth sinusoidal ocean swell that sweeps from deep sub-bass into crisp high-frequency shimmer.',
    durationMs: 2000,
    keyframes: [
      { timeOffset: 0.0, intensity: 0.12, frequency: 0.1, triggerImpulse: 0.1, curve: 'smooth' },
      { timeOffset: 0.25, intensity: 0.55, frequency: 0.4, triggerImpulse: 0.45, curve: 'smooth' },
      { timeOffset: 0.5, intensity: 1.0, frequency: 0.9, triggerImpulse: 1.0, curve: 'smooth' },
      { timeOffset: 0.75, intensity: 0.55, frequency: 0.4, triggerImpulse: 0.45, curve: 'smooth' },
      { timeOffset: 1.0, intensity: 0.12, frequency: 0.1, triggerImpulse: 0.1, curve: 'smooth' },
    ],
  },
  {
    id: 'stutter-gate',
    name: 'Stutter',
    category: 'Rhythmic',
    description: 'Square-wave gated chopper with sharp micro-transients and crisp trigger bursts.',
    durationMs: 800,
    keyframes: [
      { timeOffset: 0.0, intensity: 1.0, frequency: 0.85, triggerImpulse: 1.0, curve: 'step' },
      { timeOffset: 0.12, intensity: 0.0, frequency: 0.85, triggerImpulse: 0.0, curve: 'step' },
      { timeOffset: 0.25, intensity: 0.85, frequency: 0.6, triggerImpulse: 0.8, curve: 'step' },
      { timeOffset: 0.37, intensity: 0.0, frequency: 0.6, triggerImpulse: 0.0, curve: 'step' },
      { timeOffset: 0.5, intensity: 1.0, frequency: 0.95, triggerImpulse: 1.0, curve: 'step' },
      { timeOffset: 0.62, intensity: 0.0, frequency: 0.95, triggerImpulse: 0.0, curve: 'step' },
      { timeOffset: 0.75, intensity: 0.65, frequency: 0.35, triggerImpulse: 0.5, curve: 'step' },
      { timeOffset: 0.88, intensity: 0.0, frequency: 0.35, triggerImpulse: 0.0, curve: 'step' },
      { timeOffset: 1.0, intensity: 0.0, frequency: 0.35, triggerImpulse: 0.0, curve: 'step' },
    ],
  },
  {
    id: 'polyrhythm-sync',
    name: 'Polyrhythm 3:4',
    category: 'Rhythmic',
    description: 'Interlocking 3-against-4 cross-rhythm alternating heavy grip actuators and impulse triggers.',
    durationMs: 1200,
    keyframes: [
      { timeOffset: 0.0, intensity: 0.95, frequency: 0.15, triggerImpulse: 1.0, curve: 'smooth' },
      { timeOffset: 0.25, intensity: 0.45, frequency: 0.9, triggerImpulse: 0.85, curve: 'smooth' },
      { timeOffset: 0.33, intensity: 0.9, frequency: 0.2, triggerImpulse: 0.2, curve: 'smooth' },
      { timeOffset: 0.5, intensity: 0.5, frequency: 0.85, triggerImpulse: 0.9, curve: 'smooth' },
      { timeOffset: 0.66, intensity: 0.92, frequency: 0.25, triggerImpulse: 0.25, curve: 'smooth' },
      { timeOffset: 0.75, intensity: 0.55, frequency: 0.95, triggerImpulse: 0.95, curve: 'smooth' },
      { timeOffset: 1.0, intensity: 0.15, frequency: 0.5, triggerImpulse: 0.1, curve: 'smooth' },
    ],
  },
  {
    id: 'sub-bass-drop',
    name: 'Sub-Bass Drop',
    category: 'Trigger',
    description: 'Exponential frequency dive from high-RPM trigger whine down into maximum heavy-mass rumble.',
    durationMs: 1600,
    keyframes: [
      { timeOffset: 0.0, intensity: 0.35, frequency: 1.0, triggerImpulse: 1.0, curve: 'linear' },
      { timeOffset: 0.3, intensity: 0.75, frequency: 0.75, triggerImpulse: 0.85, curve: 'smooth' },
      { timeOffset: 0.55, intensity: 1.0, frequency: 0.1, triggerImpulse: 0.4, curve: 'smooth' },
      { timeOffset: 0.85, intensity: 0.8, frequency: 0.05, triggerImpulse: 0.15, curve: 'linear' },
      { timeOffset: 1.0, intensity: 0.1, frequency: 0.0, triggerImpulse: 0.0, curve: 'linear' },
    ],
  },
];

/**
 * Cosine smoothstep interpolation between 0 and 1.
 */
function smoothInterpolate(a: number, b: number, t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  const mu = (1 - Math.cos(clampedT * Math.PI)) / 2;
  return a * (1 - mu) + b * mu;
}

/**
 * Pure function that evaluates a VibrationPattern at a given elapsed millisecond timestamp,
 * scaled by the user's current Tempo (BPM), Strength (0-1), Speed (0-1), Trigger Ratio, and Balance.
 */
export function evaluatePatternChannels(
  pattern: VibrationPattern,
  elapsedMs: number,
  params: EngineParameters
): {
  channels: MotorChannels;
  normalizedPhase: number;
  envelopeIntensity: number;
  envelopeFrequency: number;
} {
  // Tempo scales the base cycle speed relative to 120 BPM reference
  const tempoScale = Math.max(20, Math.min(240, params.tempo)) / 120;
  const effectiveDuration = Math.max(100, pattern.durationMs / tempoScale);
  const normalizedPhase = ((elapsedMs % effectiveDuration) + effectiveDuration) % effectiveDuration / effectiveDuration;

  const frames = pattern.keyframes;
  if (!frames || frames.length === 0) {
    return {
      channels: { lowFreqStrong: 0, highFreqWeak: 0, leftImpulseTrigger: 0, rightImpulseTrigger: 0 },
      normalizedPhase,
      envelopeIntensity: 0,
      envelopeFrequency: 0,
    };
  }

  // Find bounding keyframes
  let prevFrame: PatternKeyframe = frames[0];
  let nextFrame: PatternKeyframe = frames[frames.length - 1];

  for (let i = 0; i < frames.length - 1; i++) {
    if (normalizedPhase >= frames[i].timeOffset && normalizedPhase <= frames[i + 1].timeOffset) {
      prevFrame = frames[i];
      nextFrame = frames[i + 1];
      break;
    }
  }

  const span = Math.max(0.0001, nextFrame.timeOffset - prevFrame.timeOffset);
  const localT = Math.max(0, Math.min(1, (normalizedPhase - prevFrame.timeOffset) / span));

  let rawIntensity: number;
  let rawFreq: number;
  let rawTrigger: number;

  const prevTrigger = prevFrame.triggerImpulse ?? prevFrame.intensity;
  const nextTrigger = nextFrame.triggerImpulse ?? nextFrame.intensity;

  if (prevFrame.curve === 'step') {
    rawIntensity = prevFrame.intensity;
    rawFreq = prevFrame.frequency;
    rawTrigger = prevTrigger;
  } else if (prevFrame.curve === 'smooth') {
    rawIntensity = smoothInterpolate(prevFrame.intensity, nextFrame.intensity, localT);
    rawFreq = smoothInterpolate(prevFrame.frequency, nextFrame.frequency, localT);
    rawTrigger = smoothInterpolate(prevTrigger, nextTrigger, localT);
  } else {
    rawIntensity = prevFrame.intensity + (nextFrame.intensity - prevFrame.intensity) * localT;
    rawFreq = prevFrame.frequency + (nextFrame.frequency - prevFrame.frequency) * localT;
    rawTrigger = prevTrigger + (nextTrigger - prevTrigger) * localT;
  }

  // Combine pattern envelope with master Strength & Speed parameters
  const combinedStrength = Math.max(0, Math.min(1, rawIntensity * params.strength));
  const combinedFrequency = Math.max(0, Math.min(1, rawFreq * 0.55 + params.speed * 0.45));

  // Split between Low-Frequency Heavy Motor and High-Frequency Light Motor based on combinedFrequency
  // At speed=0 -> 100% lowFreqStrong, 20% highFreqWeak
  // At speed=0.5 -> 85% lowFreqStrong, 85% highFreqWeak
  // At speed=1.0 -> 30% lowFreqStrong, 100% highFreqWeak
  const lowWeight = Math.max(0.15, Math.min(1, 1.3 - combinedFrequency * 0.95));
  const highWeight = Math.max(0.15, Math.min(1, 0.25 + combinedFrequency * 0.95));

  // Apply Left/Right Stereo Pan (-1.0 Left to +1.0 Right)
  const leftPan = params.leftRightBalance <= 0 ? 1.0 : Math.max(0, 1.0 - params.leftRightBalance);
  const rightPan = params.leftRightBalance >= 0 ? 1.0 : Math.max(0, 1.0 + params.leftRightBalance);

  const lowFreqStrong = Math.max(0, Math.min(1, combinedStrength * lowWeight * leftPan));
  const highFreqWeak = Math.max(0, Math.min(1, combinedStrength * highWeight * rightPan));

  const triggerMaster = Math.max(0, Math.min(1, rawTrigger * params.strength * params.triggerRatio));
  const leftImpulseTrigger = Math.max(0, Math.min(1, triggerMaster * leftPan));
  const rightImpulseTrigger = Math.max(0, Math.min(1, triggerMaster * rightPan));

  return {
    channels: {
      lowFreqStrong,
      highFreqWeak,
      leftImpulseTrigger,
      rightImpulseTrigger,
    },
    normalizedPhase,
    envelopeIntensity: combinedStrength,
    envelopeFrequency: combinedFrequency,
  };
}

/**
 * Converts a recorded array of XY samples into a clean, normalized VibrationPattern.
 */
export function createCustomPatternFromSamples(
  name: string,
  samples: Array<{ x: number; y: number; timestampMs: number }>
): VibrationPattern {
  const cleanName = name.trim() || 'Custom Gesture';
  if (samples.length < 2) {
    return {
      id: `custom-${Date.now()}`,
      name: cleanName,
      category: 'Custom',
      description: 'User-recorded tactile XY trajectory.',
      durationMs: 1200,
      isCustom: true,
      keyframes: [
        { timeOffset: 0, intensity: 0.6, frequency: 0.5, triggerImpulse: 0.6, curve: 'smooth' },
        { timeOffset: 0.5, intensity: 0.9, frequency: 0.8, triggerImpulse: 0.9, curve: 'smooth' },
        { timeOffset: 1, intensity: 0.3, frequency: 0.2, triggerImpulse: 0.3, curve: 'smooth' },
      ],
    };
  }

  const startMs = samples[0].timestampMs;
  const endMs = samples[samples.length - 1].timestampMs;
  const totalDuration = Math.max(400, Math.min(8000, endMs - startMs));

  // Downsample to at most 16 keyframes for crisp JSON storage and visualization
  const maxFrames = 16;
  const step = Math.max(1, Math.floor(samples.length / maxFrames));
  const keyframes: PatternKeyframe[] = [];

  for (let i = 0; i < samples.length; i += step) {
    const s = samples[i];
    const timeOffset = Math.max(0, Math.min(1, (s.timestampMs - startMs) / totalDuration));
    keyframes.push({
      timeOffset: Number(timeOffset.toFixed(3)),
      intensity: Number(Math.max(0, Math.min(1, s.y)).toFixed(3)),
      frequency: Number(Math.max(0, Math.min(1, s.x)).toFixed(3)),
      triggerImpulse: Number(Math.max(0, Math.min(1, s.y * 0.95)).toFixed(3)),
      curve: 'smooth',
    });
  }

  // Ensure first keyframe is at 0.0 and last at 1.0
  if (keyframes[0].timeOffset > 0) {
    keyframes[0].timeOffset = 0;
  }
  const last = keyframes[keyframes.length - 1];
  if (last.timeOffset < 1) {
    keyframes.push({
      ...last,
      timeOffset: 1.0,
    });
  }

  return {
    id: `custom-${Date.now()}`,
    name: cleanName,
    category: 'Custom',
    description: `Recorded ${keyframes.length}-point tactile gesture (${(totalDuration / 1000).toFixed(1)}s loop).`,
    durationMs: Math.round(totalDuration),
    keyframes,
    isCustom: true,
  };
}
