import {
  ConnectedController,
  ControllerProtocol,
  EngineParameters,
  MotorChannels,
  TriggerEffectMode,
  VibrationPattern,
  WebHIDPacketLog,
} from '../types/haptics';
import { DEFAULT_PATTERNS, evaluatePatternChannels } from './patternLibrary';
import {
  buildDualSenseOutputReport,
  buildEmergencyStopPayloads,
  buildXboxImpulseReport,
  formatHexPayload,
} from './webhidPayloads';

export interface EngineTelemetrySnapshot {
  isRunning: boolean;
  isEmergencyStopped: boolean;
  parameters: EngineParameters;
  activePattern: VibrationPattern;
  channels: MotorChannels;
  normalizedPhase: number;
  lastPacketLogs: WebHIDPacketLog[];
  activeMotorLoopCount: number;
  audioMonitorEnabled: boolean;
}

type TelemetryListener = (snapshot: EngineTelemetrySnapshot) => void;

/**
 * Minimal interface for WebHID Device to remain safe in Node test environments and browsers without WebHID types.
 */
interface MinimalHIDDevice {
  opened?: boolean;
  vendorId?: number;
  productId?: number;
  productName?: string;
  sendReport?: (reportId: number, data: Uint8Array | BufferSource) => Promise<void>;
}

/**
 * Phase 2: Core VibrationEngine Service.
 *
 * Isolated from UI components. Manages high-precision tempo/oscillation loops,
 * routes motor channels to both standard Gamepad `vibrationActuator.playEffect()`
 * and WebHID `sendReport()` for Xbox Impulse Triggers & PS5 DualSense adaptive haptics,
 * and enforces highest-priority `emergencyStop()`.
 */
export class VibrationEngine {
  private isRunning = false;
  private isEmergencyStopped = false;
  private parameters: EngineParameters = {
    strength: 0.72,
    speed: 0.58,
    tempo: 118,
    triggerRatio: 0.85,
    triggerMode: TriggerEffectMode.PULSE_OSCILLATOR,
    leftRightBalance: 0.0,
  };

  private activePattern: VibrationPattern = DEFAULT_PATTERNS[1]; // Heartbeat default
  private channels: MotorChannels = {
    lowFreqStrong: 0,
    highFreqWeak: 0,
    leftImpulseTrigger: 0,
    rightImpulseTrigger: 0,
  };
  private normalizedPhase = 0;

  private rafId: number | null = null;
  private hardwareIntervalId: ReturnType<typeof setInterval> | null = null;
  private startTimeMs = 0;
  private lastHardwareDispatchMs = 0;

  private connectedControllers: ConnectedController[] = [];
  private packetLogs: WebHIDPacketLog[] = [];
  private listeners: Set<TelemetryListener> = new Set();

  // Optional tactile acoustic sub-bass monitor (Web Audio API) so users feel/hear pulse envelopes
  private audioMonitorEnabled = false;
  private audioCtx: AudioContext | null = null;
  private subOsc: OscillatorNode | null = null;
  private subGain: GainNode | null = null;

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): EngineTelemetrySnapshot {
    return {
      isRunning: this.isRunning,
      isEmergencyStopped: this.isEmergencyStopped,
      parameters: { ...this.parameters },
      activePattern: this.activePattern,
      channels: { ...this.channels },
      normalizedPhase: this.normalizedPhase,
      lastPacketLogs: [...this.packetLogs],
      activeMotorLoopCount:
        (this.rafId !== null ? 1 : 0) + (this.hardwareIntervalId !== null ? 1 : 0),
      audioMonitorEnabled: this.audioMonitorEnabled,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  public setConnectedControllers(controllers: ConnectedController[]): void {
    this.connectedControllers = controllers;
    this.emit();
  }

  public setParameters(partial: Partial<EngineParameters>): void {
    if (this.isEmergencyStopped) return; // Blocked while E-Stop latch is engaged
    this.parameters = {
      ...this.parameters,
      ...partial,
    };
    if (partial.strength !== undefined) {
      this.parameters.strength = Math.max(0, Math.min(1, partial.strength));
    }
    if (partial.speed !== undefined) {
      this.parameters.speed = Math.max(0, Math.min(1, partial.speed));
    }
    if (partial.tempo !== undefined) {
      this.parameters.tempo = Math.max(20, Math.min(240, partial.tempo));
    }
    if (partial.triggerRatio !== undefined) {
      this.parameters.triggerRatio = Math.max(0, Math.min(1, partial.triggerRatio));
    }
    if (partial.leftRightBalance !== undefined) {
      this.parameters.leftRightBalance = Math.max(-1, Math.min(1, partial.leftRightBalance));
    }

    // Re-evaluate immediately so telemetry stays responsive even when paused
    this.evaluateCurrentStep(this.now());
    this.emit();
  }

  /**
   * Direct XY Pad Vector update (Phase 3):
   * X-axis controls Speed (0.0 - 1.0) and scales Tempo (40 - 220 BPM).
   * Y-axis controls Strength / Intensity (0.0 - 1.0).
   */
  public setXYVector(x: number, y: number, autoStartIfIdle = true): void {
    if (this.isEmergencyStopped) return;
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));
    const mappedTempo = Math.round(40 + clampedX * 180);

    this.parameters = {
      ...this.parameters,
      speed: clampedX,
      strength: clampedY,
      tempo: mappedTempo,
    };

    if (autoStartIfIdle && !this.isRunning && clampedY > 0.02) {
      this.start();
    } else {
      this.evaluateCurrentStep(this.now());
      this.emit();
    }
  }

  public setPattern(pattern: VibrationPattern): void {
    this.activePattern = pattern;
    this.evaluateCurrentStep(this.now());
    this.emit();
  }

  public setAudioMonitorEnabled(enabled: boolean): void {
    this.audioMonitorEnabled = enabled;
    if (!enabled) {
      this.stopAudioMonitor();
    } else if (this.isRunning && !this.isEmergencyStopped) {
      this.ensureAudioMonitor();
    }
    this.emit();
  }

  public start(): void {
    if (this.isEmergencyStopped) {
      this.isEmergencyStopped = false;
    }
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTimeMs = this.now();
    this.lastHardwareDispatchMs = 0;

    if (this.audioMonitorEnabled) {
      this.ensureAudioMonitor();
    }

    // Use requestAnimationFrame for 60fps UI/waveform telemetry AND a 25ms setInterval
    // fallback loop to prevent background tab throttling of hardware motor packets.
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      const tickRaf = () => {
        if (!this.isRunning || this.isEmergencyStopped) return;
        this.stepLoop(this.now());
        this.rafId = window.requestAnimationFrame(tickRaf);
      };
      this.rafId = window.requestAnimationFrame(tickRaf);
    }

    this.hardwareIntervalId = setInterval(() => {
      if (!this.isRunning || this.isEmergencyStopped) return;
      this.stepLoop(this.now());
    }, 30);

    this.stepLoop(this.now());
    this.emit();
  }

  public pause(): void {
    this.isRunning = false;
    this.clearTimers();
    this.channels = {
      lowFreqStrong: 0,
      highFreqWeak: 0,
      leftImpulseTrigger: 0,
      rightImpulseTrigger: 0,
    };
    this.stopAudioMonitor();
    void this.dispatchZeroToAllHardware(false);
    this.emit();
  }

  /**
   * HIGHEST PRIORITY EXECUTION: Emergency Stop (Phase 2).
   * Instantly zeroes out all vibration states, sends immediate stop payloads
   * via WebHID and Gamepad API, disconnects active motor loops, and latches safety lockout.
   */
  public emergencyStop(): void {
    // 1. Immediately halt all timing loops
    this.isRunning = false;
    this.isEmergencyStopped = true;
    this.clearTimers();

    // 2. Zero out all internal motor state parameters & channels
    this.parameters = {
      ...this.parameters,
      strength: 0,
    };
    this.channels = {
      lowFreqStrong: 0,
      highFreqWeak: 0,
      leftImpulseTrigger: 0,
      rightImpulseTrigger: 0,
    };
    this.normalizedPhase = 0;

    // 3. Immediately silence any audio haptic monitor
    this.stopAudioMonitor();

    // 4. Dispatch hardware kill packets across WebHID, Gamepad API, and Mobile Vibration
    void this.dispatchZeroToAllHardware(true);

    // 5. Notify all subscribers synchronously
    this.emit();
  }

  public clearEmergencyStopLatch(): void {
    this.isEmergencyStopped = false;
    this.parameters = {
      ...this.parameters,
      strength: 0.65,
    };
    this.emit();
  }

  /**
   * Sends a subtle 25ms tactile micro-pulse when navigating UI focus elements via D-Pad.
   */
  public triggerNavigationHapticTick(intensity = 0.25): void {
    if (this.isEmergencyStopped || this.isRunning) return;
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad) continue;
        const actuator = (pad as Gamepad & {
          vibrationActuator?: {
            playEffect: (
              type: string,
              params: {
                startDelay: number;
                duration: number;
                weakMagnitude: number;
                strongMagnitude: number;
              }
            ) => Promise<unknown>;
          };
        }).vibrationActuator;

        if (actuator && typeof actuator.playEffect === 'function') {
          void actuator
            .playEffect('dual-rumble', {
              startDelay: 0,
              duration: 28,
              weakMagnitude: Math.min(1, intensity),
              strongMagnitude: Math.min(1, intensity * 0.4),
            })
            .catch(() => {});
        }
      }
    }
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private clearTimers(): void {
    if (this.rafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.hardwareIntervalId !== null) {
      clearInterval(this.hardwareIntervalId);
      this.hardwareIntervalId = null;
    }
  }

  private evaluateCurrentStep(timestampMs: number): void {
    const elapsed = Math.max(0, timestampMs - this.startTimeMs);
    const result = evaluatePatternChannels(this.activePattern, elapsed, this.parameters);
    this.channels = this.isRunning ? result.channels : {
      lowFreqStrong: result.channels.lowFreqStrong,
      highFreqWeak: result.channels.highFreqWeak,
      leftImpulseTrigger: result.channels.leftImpulseTrigger,
      rightImpulseTrigger: result.channels.rightImpulseTrigger,
    };
    this.normalizedPhase = result.normalizedPhase;
  }

  private stepLoop(timestampMs: number): void {
    if (!this.isRunning || this.isEmergencyStopped) return;

    this.evaluateCurrentStep(timestampMs);
    this.updateAudioMonitor();

    // Throttle physical hardware USB/Bluetooth report dispatches to ~30Hz (every 32ms)
    // to prevent saturating Bluetooth HID buffers while keeping UI at 60fps.
    if (timestampMs - this.lastHardwareDispatchMs >= 32) {
      this.lastHardwareDispatchMs = timestampMs;
      void this.dispatchChannelsToHardware(this.channels);
    }

    this.emit();
  }

  private async dispatchChannelsToHardware(channels: MotorChannels): Promise<void> {
    if (this.isEmergencyStopped) return;

    // 1. Standard Web Gamepad API `vibrationActuator.playEffect`
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad) continue;
        const actuator = (pad as Gamepad & {
          vibrationActuator?: {
            playEffect: (
              type: string,
              params: {
                startDelay: number;
                duration: number;
                weakMagnitude: number;
                strongMagnitude: number;
                leftTrigger?: number;
                rightTrigger?: number;
              }
            ) => Promise<unknown>;
          };
        }).vibrationActuator;

        if (actuator && typeof actuator.playEffect === 'function') {
          try {
            await actuator.playEffect('dual-rumble', {
              startDelay: 0,
              duration: 60, // Short overlapping sustain window for continuous modulation
              strongMagnitude: channels.lowFreqStrong,
              weakMagnitude: channels.highFreqWeak,
              leftTrigger: channels.leftImpulseTrigger,
              rightTrigger: channels.rightImpulseTrigger,
            });
          } catch {
            // Ignore transient playEffect interruptions
          }
        }
      }
    }

    // 2. WebHID Direct Reports for DualSense (0x02) and Xbox Impulse Triggers (0x03)
    const oscHz = Math.round(15 + this.parameters.speed * 195);
    for (const ctrl of this.connectedControllers) {
      if (ctrl.protocol === ControllerProtocol.WEBHID_DUALSENSE) {
        const { reportId, payload } = buildDualSenseOutputReport(
          channels,
          this.parameters.triggerMode,
          oscHz
        );
        const hid = ctrl.hidDevice as MinimalHIDDevice | undefined;
        if (hid && hid.opened && typeof hid.sendReport === 'function') {
          try {
            await hid.sendReport(reportId, payload);
          } catch {
            // Device may have disconnected mid-frame
          }
        }
        this.pushPacketLog({
          timestamp: Date.now(),
          protocol: 'DUALSENSE_0x02',
          reportId,
          hexPayload: formatHexPayload(reportId, payload, 14),
          summary: `L:${Math.round(channels.lowFreqStrong * 100)}% R:${Math.round(
            channels.highFreqWeak * 100
          )}% L2:${Math.round(channels.leftImpulseTrigger * 100)}% R2:${Math.round(
            channels.rightImpulseTrigger * 100
          )}%`,
        });
      } else if (ctrl.protocol === ControllerProtocol.WEBHID_XBOX) {
        const { reportId, payload } = buildXboxImpulseReport(channels);
        const hid = ctrl.hidDevice as MinimalHIDDevice | undefined;
        if (hid && hid.opened && typeof hid.sendReport === 'function') {
          try {
            await hid.sendReport(reportId, payload);
          } catch {
            // Ignore transient HID error
          }
        }
        this.pushPacketLog({
          timestamp: Date.now(),
          protocol: 'XBOX_GIP_0x09',
          reportId,
          hexPayload: formatHexPayload(reportId, payload, 8),
          summary: `LT:${Math.round(channels.leftImpulseTrigger * 100)}% RT:${Math.round(
            channels.rightImpulseTrigger * 100
          )}% LH:${Math.round(channels.lowFreqStrong * 100)}% RL:${Math.round(
            channels.highFreqWeak * 100
          )}%`,
        });
      } else if (ctrl.isSimulated) {
        // Log DualSense & Xbox packets for simulated studio inspection
        const { reportId, payload } = buildDualSenseOutputReport(
          channels,
          this.parameters.triggerMode,
          oscHz
        );
        this.pushPacketLog({
          timestamp: Date.now(),
          protocol: 'DUALSENSE_0x02',
          reportId,
          hexPayload: formatHexPayload(reportId, payload, 14),
          summary: `L:${Math.round(channels.lowFreqStrong * 100)}% R:${Math.round(
            channels.highFreqWeak * 100
          )}% L2:${Math.round(channels.leftImpulseTrigger * 100)}% R2:${Math.round(
            channels.rightImpulseTrigger * 100
          )}%`,
        });
      }
    }

    // 3. Smartphone Navigator Vibrate API fallback
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function' &&
      this.connectedControllers.some((c) => c.protocol === ControllerProtocol.MOBILE_VIBRATE)
    ) {
      if (channels.lowFreqStrong > 0.15 || channels.highFreqWeak > 0.15) {
        navigator.vibrate(25);
      }
    }
  }

  private async dispatchZeroToAllHardware(isEmergency: boolean): Promise<void> {
    const stopPayloads = buildEmergencyStopPayloads();

    // 1. Stop Web Gamepad Actuators via reset() or zero-magnitude playEffect()
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad) continue;
        const actuator = (pad as Gamepad & {
          vibrationActuator?: {
            reset?: () => Promise<unknown>;
            playEffect?: (
              type: string,
              params: {
                startDelay: number;
                duration: number;
                weakMagnitude: number;
                strongMagnitude: number;
              }
            ) => Promise<unknown>;
          };
        }).vibrationActuator;

        if (actuator) {
          if (typeof actuator.reset === 'function') {
            void actuator.reset().catch(() => {});
          }
          if (typeof actuator.playEffect === 'function') {
            void actuator
              .playEffect('dual-rumble', {
                startDelay: 0,
                duration: 0,
                weakMagnitude: 0,
                strongMagnitude: 0,
              })
              .catch(() => {});
          }
        }
      }
    }

    // 2. Send zero-out HID reports to all connected WebHID devices
    for (const ctrl of this.connectedControllers) {
      const hid = ctrl.hidDevice as MinimalHIDDevice | undefined;
      if (ctrl.protocol === ControllerProtocol.WEBHID_DUALSENSE) {
        if (hid && hid.opened && typeof hid.sendReport === 'function') {
          void hid
            .sendReport(stopPayloads.dualSense.reportId, stopPayloads.dualSense.payload)
            .catch(() => {});
        }
      } else if (ctrl.protocol === ControllerProtocol.WEBHID_XBOX) {
        if (hid && hid.opened && typeof hid.sendReport === 'function') {
          void hid.sendReport(stopPayloads.xbox.reportId, stopPayloads.xbox.payload).catch(() => {});
        }
      }
    }

    // 3. Stop mobile vibration
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore in unsupported contexts
      }
    }

    if (isEmergency) {
      this.pushPacketLog({
        timestamp: Date.now(),
        protocol: 'DUALSENSE_0x02',
        reportId: stopPayloads.dualSense.reportId,
        hexPayload: formatHexPayload(
          stopPayloads.dualSense.reportId,
          stopPayloads.dualSense.payload,
          14
        ),
        summary: 'EMERGENCY STOP · ALL MOTORS & TRIGGERS ZEROED (0x00)',
        isEmergencyStop: true,
      });
    }
  }

  private pushPacketLog(entry: WebHIDPacketLog): void {
    this.packetLogs = [entry, ...this.packetLogs.slice(0, 19)];
  }

  private ensureAudioMonitor(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextCtor();
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      if (!this.subOsc && this.audioCtx) {
        this.subOsc = this.audioCtx.createOscillator();
        this.subGain = this.audioCtx.createGain();
        this.subOsc.type = 'sine';
        this.subOsc.frequency.value = 55;
        this.subGain.gain.value = 0;
        this.subOsc.connect(this.subGain);
        this.subGain.connect(this.audioCtx.destination);
        this.subOsc.start();
      }
    } catch {
      // Ignore audio initialization errors if blocked by autoplay policy
    }
  }

  private updateAudioMonitor(): void {
    if (!this.audioMonitorEnabled || !this.subOsc || !this.subGain || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const targetFreq = 38 + this.parameters.speed * 110 + this.channels.highFreqWeak * 45;
    const targetGain = Math.min(0.18, (this.channels.lowFreqStrong * 0.7 + this.channels.highFreqWeak * 0.3) * 0.16);
    this.subOsc.frequency.setTargetAtTime(targetFreq, now, 0.02);
    this.subGain.gain.setTargetAtTime(targetGain, now, 0.02);
  }

  private stopAudioMonitor(): void {
    if (this.subGain && this.audioCtx) {
      try {
        this.subGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.01);
      } catch {
        // Ignore
      }
    }
  }
}

export const vibrationEngine = new VibrationEngine();
