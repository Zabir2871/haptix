import test from 'node:test';
import assert from 'node:assert/strict';
import {
  corePatterns,
  scaleAndClampMagnitude,
  samplePatternCurve,
  evaluateSequencerAtTime,
  evaluateEnvelopeSynth,
  formatCountdownTimer,
  computeTelemetryMetrics,
  defaultSequencerPresets,
} from './hapticsLogic';

test('all 13 original core patterns exist and return bounded [strong, weak] tuples', () => {
  const expectedNames = [
    'Constant',
    'Pulse',
    'Heartbeat',
    'Wave',
    'Sawtooth',
    'Earthquake',
    'Middle Strat',
    'Fireworks',
    'Arch',
    'Valley',
    'Chirp',
    'Roller Coaster',
    'Randomizer',
  ];
  assert.deepEqual(Object.keys(corePatterns), expectedNames);

  for (const name of expectedNames) {
    const fn = corePatterns[name].fn;
    for (const t of [0, 0.25, 0.5, 1.0, 1.5, 1.99]) {
      const [rawStrong, rawWeak] = fn(t);
      assert.equal(typeof rawStrong, 'number', `${name} strong should be number`);
      assert.equal(typeof rawWeak, 'number', `${name} weak should be number`);
      const strong = scaleAndClampMagnitude(rawStrong, 1.0);
      const weak = scaleAndClampMagnitude(rawWeak, 1.0);
      assert.ok(strong >= 0 && strong <= 1, `${name} clamped strong in range`);
      assert.ok(weak >= 0 && weak <= 1, `${name} clamped weak in range`);
    }
  }
});

test('scaleAndClampMagnitude properly scales and clamps to [0, 1]', () => {
  assert.equal(scaleAndClampMagnitude(0.8, 0.5), 0.4);
  assert.equal(scaleAndClampMagnitude(1.5, 1.0), 1.0);
  assert.equal(scaleAndClampMagnitude(-0.3, 1.0), 0.0);
  assert.equal(scaleAndClampMagnitude(Number.NaN, 1.0), 0.0);
});

test('samplePatternCurve returns deterministic sample count and bounded points', () => {
  const samples = samplePatternCurve(corePatterns['Wave'].fn, 50, 2);
  assert.equal(samples.length, 50);
  assert.equal(samples[0].t, 0);
  assert.ok(Math.abs(samples[49].t - 2) < 1e-6);
  for (const pt of samples) {
    assert.ok(pt.strong >= 0 && pt.strong <= 1);
    assert.ok(pt.weak >= 0 && pt.weak <= 1);
  }
});

test('evaluateSequencerAtTime advances steps accurately with BPM', () => {
  const preset = defaultSequencerPresets['Cybernetic Pulse'];
  // At 120 BPM, each 16th step is 15 / 120 = 0.125s
  const step0 = evaluateSequencerAtTime(preset.steps, 0.02, 120, 0.8);
  assert.equal(step0.stepIndex, 0);
  assert.ok(step0.strong > 0.5);

  const step4 = evaluateSequencerAtTime(preset.steps, 4 * 0.125 + 0.02, 120, 0.8);
  assert.equal(step4.stepIndex, 4);
  assert.ok(step4.strong > 0.5);
});

test('evaluateEnvelopeSynth produces valid ADSR modulated output', () => {
  const patch = {
    name: 'Test Patch',
    attack: 0.2,
    decay: 0.2,
    sustain: 0.6,
    release: 0.3,
    lfoRate: 6,
    lfoDepth: 0.4,
    phaseOffset: 0.25,
  };
  const [s0, w0] = evaluateEnvelopeSynth(patch, 0);
  assert.equal(s0, 0);
  assert.equal(w0, 0);

  const [sPeak, wPeak] = evaluateEnvelopeSynth(patch, 0.2);
  assert.ok(sPeak > 0.4 && sPeak <= 1);
  assert.ok(wPeak > 0.4 && wPeak <= 1);
});

test('formatCountdownTimer formats milliseconds to MM:SS', () => {
  assert.equal(formatCountdownTimer(0), '0:00');
  assert.equal(formatCountdownTimer(-1000), '0:00');
  assert.equal(formatCountdownTimer(65000), '1:05');
  assert.equal(formatCountdownTimer(300000), '5:00');
});

test('computeTelemetryMetrics calculates RMS, RPM, and wattage', () => {
  const zero = computeTelemetryMetrics(0, 0);
  assert.equal(zero.rmsPercent, 0);
  assert.equal(zero.strongRpm, 0);
  assert.equal(zero.weakRpm, 0);

  const full = computeTelemetryMetrics(1, 1);
  assert.equal(full.rmsPercent, 100);
  assert.equal(full.strongRpm, 4200);
  assert.equal(full.weakRpm, 9600);
  assert.equal(full.powerWatts, 2.8);
});
