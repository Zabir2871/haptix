import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDualSenseOutputReport,
  buildEmergencyStopPayloads,
  buildXboxImpulseReport,
  floatToUint8,
  floatToXboxPercentByte,
} from './webhidPayloads';
import {
  createCustomPatternFromSamples,
  DEFAULT_PATTERNS,
  evaluatePatternChannels,
} from './patternLibrary';
import { TriggerEffectMode } from '../types/haptics';
import { VibrationEngine } from './VibrationEngine';

test('floatToUint8 and floatToXboxPercentByte clamp and scale accurately', () => {
  assert.equal(floatToUint8(0), 0x00);
  assert.equal(floatToUint8(1), 0xff);
  assert.equal(floatToUint8(0.5), 128);
  assert.equal(floatToUint8(-2), 0x00);
  assert.equal(floatToUint8(5), 0xff);

  assert.equal(floatToXboxPercentByte(0), 0);
  assert.equal(floatToXboxPercentByte(1), 100);
  assert.equal(floatToXboxPercentByte(0.75), 75);
});

test('buildDualSenseOutputReport encodes Report ID 0x02 and correct rumble/trigger bytes', () => {
  const report = buildDualSenseOutputReport(
    {
      lowFreqStrong: 1.0,
      highFreqWeak: 0.5,
      leftImpulseTrigger: 0.8,
      rightImpulseTrigger: 0.4,
    },
    TriggerEffectMode.PULSE_OSCILLATOR,
    60
  );

  assert.equal(report.reportId, 0x02);
  assert.equal(report.payload.length, 47);
  // Byte 0: enable flags 0x0F
  assert.equal(report.payload[0], 0x0f);
  // Byte 2: highFreqWeak (0.5 -> 128)
  assert.equal(report.payload[2], 128);
  // Byte 3: lowFreqStrong (1.0 -> 255)
  assert.equal(report.payload[3], 255);
  // Byte 10: Right Trigger Mode 0x26 (Pulse Oscillator)
  assert.equal(report.payload[10], 0x26);
  // Byte 21: Left Trigger Mode 0x26 (Pulse Oscillator)
  assert.equal(report.payload[21], 0x26);
});

test('buildXboxImpulseReport encodes 8-byte GIP payload with actuator mask 0x0F', () => {
  const report = buildXboxImpulseReport({
    lowFreqStrong: 0.9,
    highFreqWeak: 0.4,
    leftImpulseTrigger: 0.7,
    rightImpulseTrigger: 0.6,
  });

  assert.equal(report.reportId, 0x03);
  assert.equal(report.payload.length, 8);
  assert.equal(report.payload[0], 0x0f);
  assert.equal(report.payload[1], 70); // LT
  assert.equal(report.payload[2], 60); // RT
  assert.equal(report.payload[3], 90); // Left Heavy
  assert.equal(report.payload[4], 40); // Right Light
  assert.equal(report.payload[5], 0xff); // Sustain duration
});

test('evaluatePatternChannels modulates motor channels by strength, speed, and balance', () => {
  const continuous = DEFAULT_PATTERNS[0];
  const evalResult = evaluatePatternChannels(continuous, 250, {
    strength: 0.8,
    speed: 0.5,
    tempo: 120,
    triggerRatio: 1.0,
    triggerMode: TriggerEffectMode.CONTINUOUS,
    leftRightBalance: 0.0,
  });

  assert.ok(evalResult.channels.lowFreqStrong > 0.5);
  assert.ok(evalResult.channels.highFreqWeak > 0.5);
  assert.ok(evalResult.channels.leftImpulseTrigger > 0.7);
  assert.ok(evalResult.channels.rightImpulseTrigger > 0.7);

  // Full Left Balance (-1.0) should silence right channels
  const leftOnly = evaluatePatternChannels(continuous, 250, {
    strength: 0.8,
    speed: 0.5,
    tempo: 120,
    triggerRatio: 1.0,
    triggerMode: TriggerEffectMode.CONTINUOUS,
    leftRightBalance: -1.0,
  });
  assert.equal(leftOnly.channels.highFreqWeak, 0);
  assert.equal(leftOnly.channels.rightImpulseTrigger, 0);
  assert.ok(leftOnly.channels.lowFreqStrong > 0.5);
});

test('createCustomPatternFromSamples normalizes recorded XY trajectory', () => {
  const pattern = createCustomPatternFromSamples('My Synth Wave', [
    { x: 0.1, y: 0.2, timestampMs: 1000 },
    { x: 0.5, y: 0.9, timestampMs: 1600 },
    { x: 0.8, y: 0.4, timestampMs: 2200 },
  ]);

  assert.equal(pattern.name, 'My Synth Wave');
  assert.equal(pattern.isCustom, true);
  assert.equal(pattern.keyframes[0].timeOffset, 0);
  assert.equal(pattern.keyframes[pattern.keyframes.length - 1].timeOffset, 1);
});

test('VibrationEngine emergencyStop immediately zeroes all channels and blocks updates until cleared', () => {
  const engine = new VibrationEngine();
  engine.start();
  engine.setParameters({ strength: 0.95, speed: 0.8, tempo: 160 });

  const runningSnap = engine.getSnapshot();
  assert.equal(runningSnap.isRunning, true);
  assert.equal(runningSnap.isEmergencyStopped, false);

  // Trigger Emergency Stop
  engine.emergencyStop();
  const stoppedSnap = engine.getSnapshot();
  assert.equal(stoppedSnap.isRunning, false);
  assert.equal(stoppedSnap.isEmergencyStopped, true);
  assert.equal(stoppedSnap.parameters.strength, 0);
  assert.equal(stoppedSnap.channels.lowFreqStrong, 0);
  assert.equal(stoppedSnap.channels.highFreqWeak, 0);
  assert.equal(stoppedSnap.channels.leftImpulseTrigger, 0);
  assert.equal(stoppedSnap.channels.rightImpulseTrigger, 0);
  assert.equal(stoppedSnap.activeMotorLoopCount, 0);

  // Verify Emergency Stop payloads are all zero
  const stopPackets = buildEmergencyStopPayloads();
  assert.equal(stopPackets.dualSense.payload[2], 0);
  assert.equal(stopPackets.dualSense.payload[3], 0);
  assert.equal(stopPackets.xbox.payload[1], 0);
  assert.equal(stopPackets.xbox.payload[2], 0);
});
