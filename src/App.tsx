/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HapticsProvider, useHaptics } from './context/HapticsContext';
import { XYTouchpad } from './components/XYTouchpad';
import { ParameterRack } from './components/ParameterRack';
import { PatternSequencer } from './components/PatternSequencer';
import { HardwareBusPanel } from './components/HardwareBusPanel';

const HapticStudioWorkspace: React.FC = () => {
  const {
    telemetry,
    requestWebHIDDevice,
    triggerEmergencyStop,
    resetEmergencyStop,
    focusedZone,
    setFocusedZone,
  } = useHaptics();

  const isEStopFocused = focusedZone === 'EMERGENCY_STOP';

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Single wordmark) — Zone 2 (4 single-line links) — Zone 3 (1 primary CTA) */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-[#07090E]">
        <a
          href="#workspace-top"
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Haptix Studio
        </a>

        <nav
          aria-label="Primary Workspace Sections"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
        >
          <a
            href="#workspace-top"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            XY Vector Pad
          </a>
          <a
            href="#pattern-sequencer"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Pattern Library
          </a>
          <a
            href="#hardware-bus"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Quad-Actuator Bus
          </a>
          <a
            href="#dpad-deck"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            D-Pad Navigation
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void requestWebHIDDevice()}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            Connect WebHID
          </button>
        </div>
      </header>

      {/* Main Tactile Console Container */}
      <main
        id="workspace-top"
        className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6"
      >
        {/* Top Command Deck + Massive High-Priority Emergency Stop */}
        <section
          aria-label="Emergency Stop and Master Telemetry Header"
          className="bg-[#111827] border border-slate-800 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
        >
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
              <span>WEBGAMEPAD API</span>
              <span aria-hidden="true">·</span>
              <span>WEBHID DUALSENSE (0x02)</span>
              <span aria-hidden="true">·</span>
              <span>XBOX GIP IMPULSE (0x03)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
              Multi-Actuator Haptic Synthesizer & Controller Rig
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Modulate dual-rumble eccentric motors and L2/R2 adaptive impulse triggers in real time. Navigate the console hands-free using Gamepad D-Pad, A/Cross to toggle, L1/R1 bumpers to step sliders, or B/Circle for instant hardware kill.
            </p>
          </div>

          {/* Massive High-Visibility Emergency Stop Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {telemetry.isEmergencyStopped && (
              <button
                type="button"
                onClick={resetEmergencyStop}
                className="px-4 py-3.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              >
                RELEASE SAFETY LATCH
              </button>
            )}

            <button
              type="button"
              data-testid="emergency-stop-button"
              onClick={() => {
                setFocusedZone('EMERGENCY_STOP');
                triggerEmergencyStop();
              }}
              className={`px-7 py-4 rounded-md font-mono text-sm sm:text-base font-bold tracking-wide transition-all whitespace-nowrap shrink-0 ${
                isEStopFocused ? 'ring-4 ring-rose-400 ' : ''
              }${
                telemetry.isEmergencyStopped
                  ? 'bg-rose-950 border-2 border-rose-500 text-rose-200'
                  : 'bg-[#DC2626] hover:bg-rose-500 text-white border-2 border-rose-300/40'
              }`}
            >
              {telemetry.isEmergencyStopped
                ? '✖ EMERGENCY STOP ENGAGED (0x00)'
                : '■ EMERGENCY STOP [ESC / B]'}
            </button>
          </div>
        </section>

        {/* Asymmetric 12-Column Hardware Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Columns: XY Touchpad Vector Stage + Pattern Sequencer Library */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <XYTouchpad />
            <PatternSequencer />
          </div>

          {/* Right 5 Columns: Actuator Calibration Sliders + Quad-Actuator Bus & D-Pad Deck */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <ParameterRack />
            <HardwareBusPanel />
          </div>
        </div>
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 max-w-[1440px] w-full mx-auto">
        <span>Haptix Tactile Telemetry & Haptic Synthesizer</span>
        <span>
          Keyboard & Controller Shortcuts: Arrow Keys / D-Pad (Focus) · [ / ] or L1/R1 (Adjust) · Enter / A (Select) · Esc / B (Emergency Stop)
        </span>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <HapticsProvider>
      <HapticStudioWorkspace />
    </HapticsProvider>
  );
}
