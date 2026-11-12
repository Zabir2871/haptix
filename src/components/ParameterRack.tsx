import React from 'react';
import { useHaptics } from '../context/HapticsContext';
import { FocusZoneId, TriggerEffectMode } from '../types/haptics';

export const ParameterRack: React.FC = () => {
  const {
    telemetry,
    updateParameters,
    focusedZone,
    setFocusedZone,
    toggleAudioMonitor,
  } = useHaptics();

  const { parameters } = telemetry;

  const sliders: Array<{
    zone: FocusZoneId;
    id: string;
    label: string;
    unit: string;
    displayValue: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (val: number) => void;
    subtext: string;
  }> = [
    {
      zone: 'SLIDER_STRENGTH',
      id: 'slider-strength',
      label: 'Master Actuator Strength',
      unit: '%',
      displayValue: `${Math.round(parameters.strength * 100)}`,
      min: 0,
      max: 1,
      step: 0.01,
      value: parameters.strength,
      onChange: (val) => updateParameters({ strength: val }),
      subtext: 'Dual-rumble & trigger peak force',
    },
    {
      zone: 'SLIDER_SPEED',
      id: 'slider-speed',
      label: 'Motor Frequency Balance',
      unit: 'HZ',
      displayValue: `${Math.round(20 + parameters.speed * 195)}`,
      min: 0,
      max: 1,
      step: 0.01,
      value: parameters.speed,
      onChange: (val) => updateParameters({ speed: val }),
      subtext: 'Low-mass heavy vs. high-RPM harmonic weight',
    },
    {
      zone: 'SLIDER_TEMPO',
      id: 'slider-tempo',
      label: 'Sequencer Pulse Tempo',
      unit: 'BPM',
      displayValue: `${parameters.tempo}`,
      min: 20,
      max: 240,
      step: 1,
      value: parameters.tempo,
      onChange: (val) => updateParameters({ tempo: Math.round(val) }),
      subtext: 'Pattern cycle modulation velocity',
    },
    {
      zone: 'SLIDER_TRIGGERS',
      id: 'slider-triggers',
      label: 'Impulse Trigger Drive (L2/R2)',
      unit: '%',
      displayValue: `${Math.round(parameters.triggerRatio * 100)}`,
      min: 0,
      max: 1,
      step: 0.01,
      value: parameters.triggerRatio,
      onChange: (val) => updateParameters({ triggerRatio: val }),
      subtext: 'WebHID Xbox GIP & DualSense trigger routing',
    },
  ];

  const triggerModes: Array<{ mode: TriggerEffectMode; label: string }> = [
    { mode: TriggerEffectMode.PULSE_OSCILLATOR, label: 'Pulse 0x26' },
    { mode: TriggerEffectMode.CONTINUOUS, label: 'Resist 0x01' },
    { mode: TriggerEffectMode.SECTION, label: 'Section 0x02' },
    { mode: TriggerEffectMode.OFF, label: 'Release 0x05' },
  ];

  return (
    <section
      aria-label="Tactile Parameter Scrubbers"
      className="bg-[#111827] border border-slate-800 rounded-lg p-5 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100 tracking-tight">
            Actuator Calibration Rack
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Fine-grain parameter scrubbers · Adjust focused slider with L1/R1 or [ / ]
          </p>
        </div>

        <button
          type="button"
          onClick={toggleAudioMonitor}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
            telemetry.audioMonitorEnabled
              ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
              : 'bg-[#07090E] border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          {telemetry.audioMonitorEnabled ? '● Acoustic Sub-Monitor On' : 'Acoustic Sub-Monitor Off'}
        </button>
      </div>

      {/* 4 Core Sliders */}
      <div className="flex flex-col gap-3.5">
        {sliders.map((s) => {
          const isFocused = focusedZone === s.zone;
          return (
            <div
              key={s.id}
              onClick={() => setFocusedZone(s.zone)}
              className={`p-3 rounded border transition-colors ${
                isFocused
                  ? 'bg-[#07090E] border-cyan-400 ring-1 ring-cyan-400/40'
                  : 'bg-[#07090E]/70 border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <div>
                  <label
                    htmlFor={s.id}
                    className="text-xs font-medium text-slate-200 block"
                  >
                    {s.label}
                  </label>
                  <span className="text-[11px] text-slate-400">{s.subtext}</span>
                </div>
                <div className="font-mono tabular-nums text-right shrink-0">
                  <span className="text-lg font-bold text-slate-100">
                    {s.displayValue}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">{s.unit}</span>
                </div>
              </div>

              <input
                id={s.id}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.value}
                onFocus={() => setFocusedZone(s.zone)}
                onChange={(e) => s.onChange( parseFloat(e.target.value) )}
                className="w-full tactile-slider"
              />
            </div>
          );
        })}
      </div>

      {/* Stereo Balance & DualSense Trigger Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="bg-[#07090E] border border-slate-800 rounded p-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="slider-pan" className="text-slate-300 font-medium">
              Left / Right Chassis Pan
            </label>
            <span className="font-mono tabular-nums text-cyan-400">
              {parameters.leftRightBalance === 0
                ? 'CENTER'
                : parameters.leftRightBalance < 0
                ? `L ${Math.round(Math.abs(parameters.leftRightBalance) * 100)}%`
                : `R ${Math.round(parameters.leftRightBalance * 100)}%`}
            </span>
          </div>
          <input
            id="slider-pan"
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={parameters.leftRightBalance}
            onChange={(e) =>
              updateParameters({ leftRightBalance: parseFloat(e.target.value) })
            }
            className="w-full tactile-slider"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>LEFT HEAVY</span>
            <button
              type="button"
              onClick={() => updateParameters({ leftRightBalance: 0 })}
              className="text-slate-400 hover:text-cyan-400 underline"
            >
              Reset Center
            </button>
            <span>RIGHT LIGHT</span>
          </div>
        </div>

        <div className="bg-[#07090E] border border-slate-800 rounded p-3 flex flex-col justify-between">
          <span className="text-xs text-slate-300 font-medium block mb-1.5">
            DualSense Adaptive Trigger Mode
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {triggerModes.map((item) => {
              const active = parameters.triggerMode === item.mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => updateParameters({ triggerMode: item.mode })}
                  className={`px-2 py-1.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap truncate ${
                    active
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'bg-[#111827] text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
