import React from 'react';
import { useHaptics } from '../context/HapticsContext';

export const HardwareBusPanel: React.FC = () => {
  const {
    telemetry,
    controllers,
    isSimulatedRigEnabled,
    toggleSimulatedRig,
    hidStatusMessage,
    requestWebHIDDevice,
    focusedZone,
    setFocusedZone,
    stepFocusZone,
    triggerFocusedZoneAction,
    adjustFocusedSlider,
    triggerEmergencyStop,
    lastGamepadInputLabel,
  } = useHaptics();

  const { channels } = telemetry;

  const motorReadouts = [
    {
      label: 'Left Grip Heavy (Low-Freq)',
      code: 'M1 · ECCENTRIC MASS',
      value: Math.round(channels.lowFreqStrong * 100),
      accent: 'bg-cyan-400',
    },
    {
      label: 'Right Grip Light (High-Freq)',
      code: 'M2 · HARMONIC ROTOR',
      value: Math.round(channels.highFreqWeak * 100),
      accent: 'bg-cyan-400',
    },
    {
      label: 'L2 / LT Impulse Trigger',
      code: 'T1 · ADAPTIVE ACTUATOR',
      value: Math.round(channels.leftImpulseTrigger * 100),
      accent: 'bg-amber-400',
    },
    {
      label: 'R2 / RT Impulse Trigger',
      code: 'T2 · ADAPTIVE ACTUATOR',
      value: Math.round(channels.rightImpulseTrigger * 100),
      accent: 'bg-amber-400',
    },
  ];

  return (
    <div id="hardware-bus" className="flex flex-col gap-5">
      {/* 4-Motor Live Chassis Telemetry Panel */}
      <section
        aria-label="4-Channel Motor Actuator Telemetry"
        className="bg-[#111827] border border-slate-800 rounded-lg p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100 tracking-tight">
              Quad-Actuator Telemetry Bus
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time 4-channel drive across Dual-Rumble & Impulse Triggers
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-cyan-400">
            {telemetry.isEmergencyStopped
              ? '✖ LOCKED (0%)'
              : telemetry.isRunning
              ? '● MODULATING'
              : '■ STANDBY'}
          </span>
        </div>

        {/* Interactive Controller Schematic + 4 Channel Bars */}
        <div className="grid grid-cols-2 gap-3">
          {motorReadouts.map((m) => (
            <div
              key={m.label}
              className="bg-[#07090E] border border-slate-800 rounded p-3 flex flex-col justify-between gap-2"
            >
              <div>
                <div className="text-[10px] font-mono text-slate-400">
                  {m.code}
                </div>
                <div className="text-xs font-medium text-slate-200 mt-0.5">
                  {m.label}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between font-mono tabular-nums mb-1">
                  <span className="text-xl font-bold text-slate-100">
                    {m.value}
                    <span className="text-xs font-normal text-slate-400 ml-0.5">
                      %
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    0x
                    {Math.round((m.value / 100) * 255)
                      .toString(16)
                      .toUpperCase()
                      .padStart(2, '0')}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-sm overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${m.accent}`}
                    style={{ width: `${m.value}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Connected Hardware & WebHID Pairing */}
      <section
        aria-label="Connected Controllers and WebHID Interface"
        className="bg-[#111827] border border-slate-800 rounded-lg p-5 flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100 tracking-tight">
              Connected Hardware Nodes ({controllers.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              WebGamepad API + WebHID Raw Output Reports (0x02 / 0x03)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFocusedZone('SIMULATE_HARDWARE');
                toggleSimulatedRig();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                focusedZone === 'SIMULATE_HARDWARE' ? 'ring-2 ring-cyan-400 ' : ''
              }${
                isSimulatedRigEnabled
                  ? 'bg-cyan-950/70 border-cyan-500/80 text-cyan-300'
                  : 'bg-[#07090E] border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {isSimulatedRigEnabled ? '● Virtual Rig Active' : 'Enable Virtual Rig'}
            </button>

            <button
              type="button"
              onClick={() => {
                setFocusedZone('CONNECT_WEBHID');
                void requestWebHIDDevice();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded bg-slate-100 text-slate-950 hover:bg-white transition-colors whitespace-nowrap shrink-0 ${
                focusedZone === 'CONNECT_WEBHID' ? 'ring-2 ring-cyan-400' : ''
              }`}
            >
              Pair WebHID Device
            </button>
          </div>
        </div>

        {hidStatusMessage && (
          <div className="bg-[#07090E] border border-slate-800 rounded px-3 py-2 text-xs text-amber-300 font-mono">
            {hidStatusMessage}
          </div>
        )}

        {/* Controller Nodes List */}
        {controllers.length === 0 ? (
          <div className="bg-[#07090E] border border-slate-800 rounded p-4 text-center">
            <p className="text-xs text-slate-300 font-medium">
              No physical or virtual controllers currently active.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Press any button on a Bluetooth/USB gamepad, pair via WebHID, or enable the Virtual Studio Rig to inspect real-time hex reports.
            </p>
            <button
              type="button"
              onClick={toggleSimulatedRig}
              className="mt-3 px-3.5 py-1.5 text-xs font-medium bg-cyan-500 text-slate-950 rounded hover:bg-cyan-400 transition-colors"
            >
              Activate Virtual DualSense & Xbox Rig
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {controllers.map((ctrl) => (
              <div
                key={ctrl.id}
                className="bg-[#07090E] border border-slate-800 rounded p-3 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-100 truncate">
                    {ctrl.name}
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400 shrink-0">
                    {ctrl.protocol}
                  </span>
                </div>

                {/* Unboxed metadata per Zero-Pill discipline */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <span>
                    {ctrl.capabilities.basicRumble ? 'Dual-Rumble' : 'Standard'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {ctrl.capabilities.triggerHaptics
                      ? 'Impulse Triggers (L2/R2)'
                      : 'No Trigger Motors'}
                  </span>
                  {ctrl.capabilities.adaptiveResistance && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Adaptive Resistance</span>
                    </>
                  )}
                  {ctrl.vendorId && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        VID:0x{ctrl.vendorId.toString(16).toUpperCase().padStart(4, '0')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WebHID Raw Hex Packet Inspector */}
        <div className="bg-[#07090E] border border-slate-800 rounded p-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
            <span>WEBHID OUTPUT REPORT STREAM</span>
            <span>DUALSENSE (0x02) / XBOX GIP (0x03)</span>
          </div>

          <div className="space-y-1.5 max-h-[125px] overflow-y-auto font-mono text-[11px] tabular-nums">
            {telemetry.lastPacketLogs.length === 0 ? (
              <div className="text-slate-500 py-2">
                Engage motor loop or drag XY surface to inspect live WebHID hex frames...
              </div>
            ) : (
              telemetry.lastPacketLogs.slice(0, 5).map((pkt, i) => (
                <div
                  key={`${pkt.timestamp}-${i}`}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-900 pb-1 ${
                    pkt.isEmergencyStop ? 'text-rose-400 font-semibold' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate">{pkt.hexPayload}</span>
                  <span className="text-slate-400 shrink-0">{pkt.summary}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Interactive Controller D-Pad Navigation Deck (Phase 4) */}
      <section
        id="dpad-deck"
        aria-label="Controller UI Navigation Deck"
        className="bg-[#111827] border border-slate-800 rounded-lg p-5 flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div>
            <h2 className="text-base font-semibold text-slate-100 tracking-tight">
              Gamepad UI Navigation Deck
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Focus: <span className="font-mono text-cyan-400">{focusedZone}</span> · Last Input:{' '}
              <span className="font-mono text-slate-300">{lastGamepadInputLabel}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => stepFocusZone('UP')}
            className="px-3 py-2 bg-[#07090E] hover:bg-slate-800 border border-slate-800 rounded text-xs font-mono text-slate-200 transition-colors whitespace-nowrap"
          >
            ▲ D-Pad Prev
          </button>
          <button
            type="button"
            onClick={() => stepFocusZone('DOWN')}
            className="px-3 py-2 bg-[#07090E] hover:bg-slate-800 border border-slate-800 rounded text-xs font-mono text-slate-200 transition-colors whitespace-nowrap"
          >
            ▼ D-Pad Next
          </button>
          <button
            type="button"
            onClick={() => adjustFocusedSlider(-0.05)}
            className="px-3 py-2 bg-[#07090E] hover:bg-slate-800 border border-slate-800 rounded text-xs font-mono text-slate-200 transition-colors whitespace-nowrap"
          >
            L1 Bumper -5%
          </button>
          <button
            type="button"
            onClick={() => adjustFocusedSlider(0.05)}
            className="px-3 py-2 bg-[#07090E] hover:bg-slate-800 border border-slate-800 rounded text-xs font-mono text-slate-200 transition-colors whitespace-nowrap"
          >
            R1 Bumper +5%
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={triggerFocusedZoneAction}
            className="px-3 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 rounded text-xs font-mono text-cyan-300 font-semibold transition-colors whitespace-nowrap"
          >
            [A / Cross] Activate Focused
          </button>
          <button
            type="button"
            onClick={triggerEmergencyStop}
            className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/50 rounded text-xs font-mono text-rose-300 font-semibold transition-colors whitespace-nowrap"
          >
            [B / Circle] Kill All Motors
          </button>
        </div>
      </section>
    </div>
  );
};
