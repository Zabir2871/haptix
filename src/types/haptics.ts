/**
 * Core types for Phase 1-4: WebGamepad, WebHID (Xbox & DualSense),
 * VibrationEngine, Pattern Sequencer, and Controller D-Pad UI Navigation.
 */

export enum ControllerProtocol {
  GAMEPAD_API = 'GAMEPAD_API',
  WEBHID_DUALSENSE = 'WEBHID_DUALSENSE',
  WEBHID_XBOX = 'WEBHID_XBOX',
  MOBILE_VIBRATE = 'MOBILE_VIBRATE',
  VIRTUAL_SYNTH = 'VIRTUAL_SYNTH',
}

export enum TriggerEffectMode {
  OFF = 'OFF',
  CONTINUOUS = 'CONTINUOUS',
  SECTION = 'SECTION',
  PULSE_OSCILLATOR = 'PULSE_OSCILLATOR',
}

export interface ControllerCapabilities {
  basicRumble: boolean;       // Dual-rumble (low-freq heavy + high-freq light)
  triggerHaptics: boolean;    // Independent Left/Right Impulse or Adaptive Triggers
  adaptiveResistance: boolean;// PS5 DualSense continuous/section trigger resistance
  ledControl: boolean;        // DualSense lightbar RGB
  batteryTelemetry: boolean;
}

export interface ConnectedController {
  id: string;
  name: string;
  vendorId?: number;
  productId?: number;
  gamepadIndex: number | null;
  protocol: ControllerProtocol;
  capabilities: ControllerCapabilities;
  connectedAt: number;
  isSimulated?: boolean;
  hidDevice?: unknown; // WebHID HIDDevice instance when connected via WebHID
}

export interface MotorChannels {
  lowFreqStrong: number;       // 0.0 - 1.0 (Left grip heavy eccentric mass)
  highFreqWeak: number;        // 0.0 - 1.0 (Right grip fast eccentric mass)
  leftImpulseTrigger: number;  // 0.0 - 1.0 (LT / L2 trigger actuator)
  rightImpulseTrigger: number; // 0.0 - 1.0 (RT / R2 trigger actuator)
}

export interface EngineParameters {
  strength: number; // 0.0 to 1.0 overall motor intensity
  speed: number;    // 0.0 to 1.0 motor frequency / high-to-low motor balance & pulse pitch
  tempo: number;    // 20 to 240 BPM pulsing speed
  triggerRatio: number; // 0.0 to 1.0 routing into L2/R2 / Impulse triggers
  triggerMode: TriggerEffectMode;
  leftRightBalance: number; // -1.0 (Left) to +1.0 (Right) stereo pan
}

export interface PatternKeyframe {
  /** Normalized position within pattern cycle (0.0 to 1.0) */
  timeOffset: number;
  /** Motor intensity at this keyframe (0.0 to 1.0) */
  intensity: number;
  /** Motor frequency/speed balance at this keyframe (0.0 to 1.0) */
  frequency: number;
  /** Optional trigger impulse spike (0.0 to 1.0) */
  triggerImpulse?: number;
  /** Interpolation curve to next keyframe */
  curve: 'step' | 'linear' | 'smooth';
}

export interface VibrationPattern {
  id: string;
  name: string;
  category: 'Rhythmic' | 'Organic' | 'Wave' | 'Trigger' | 'Custom';
  description: string;
  /** Base cycle duration in milliseconds at 120 BPM */
  durationMs: number;
  keyframes: PatternKeyframe[];
  isCustom?: boolean;
}

export interface WebHIDPacketLog {
  timestamp: number;
  protocol: 'DUALSENSE_0x02' | 'XBOX_GIP_0x09' | 'GAMEPAD_ACTUATOR';
  reportId: number;
  hexPayload: string;
  summary: string;
  isEmergencyStop?: boolean;
}

export type FocusZoneId =
  | 'EMERGENCY_STOP'
  | 'ENGINE_TOGGLE'
  | 'XY_TOUCHPAD'
  | 'SLIDER_STRENGTH'
  | 'SLIDER_SPEED'
  | 'SLIDER_TEMPO'
  | 'SLIDER_TRIGGERS'
  | 'PATTERN_HEARTBEAT'
  | 'PATTERN_WAVE'
  | 'PATTERN_STUTTER'
  | 'PATTERN_POLYRHYTHM'
  | 'PATTERN_SUBBASS'
  | 'PATTERN_CASCADE'
  | 'PATTERN_RECORD'
  | 'SIMULATE_HARDWARE'
  | 'CONNECT_WEBHID';
