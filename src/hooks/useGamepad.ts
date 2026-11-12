import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectedController, ControllerProtocol } from '../types/haptics';

export interface GamepadNavigationCallbacks {
  onDPadDirection: (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void;
  onPrimarySelect: () => void; // A / Cross button (index 0)
  onSecondaryCancel: () => void; // B / Circle button (index 1) -> Emergency Stop or Cancel
  onBumperAdjust: (delta: number) => void; // L1/R1 (indices 4, 5) or LT/RT (indices 6, 7)
  onAnalogXY?: (x: number, y: number) => void;
}

function mapGamepadToController(pad: Gamepad): ConnectedController {
  const lowerId = pad.id.toLowerCase();
  const isDualSense = lowerId.includes('dualsense') || lowerId.includes('054c');
  const isXbox = lowerId.includes('xbox') || lowerId.includes('045e') || lowerId.includes('xinput');

  const hasActuator = Boolean(
    (pad as Gamepad & { vibrationActuator?: unknown }).vibrationActuator
  );

  return {
    id: `gamepad-${pad.index}-${pad.id}`,
    name: pad.id || `Gamepad #${pad.index + 1}`,
    gamepadIndex: pad.index,
    protocol: ControllerProtocol.GAMEPAD_API,
    capabilities: {
      basicRumble: hasActuator || true,
      triggerHaptics: isDualSense || isXbox,
      adaptiveResistance: isDualSense,
      ledControl: isDualSense,
      batteryTelemetry: false,
    },
    connectedAt: Date.now(),
  };
}

/**
 * Phase 1 & Phase 4 Hook: useGamepad
 * Tracks connected standard Web Gamepad API controllers AND polls D-Pad,
 * A/Cross, B/Circle, and L1/R1/L2/R2 bumpers/triggers at 60fps for mouseless UI navigation.
 */
export function useGamepad(navCallbacks: GamepadNavigationCallbacks) {
  const [gamepadControllers, setGamepadControllers] = useState<ConnectedController[]>([]);
  const [lastGamepadInputLabel, setLastGamepadInputLabel] = useState<string>('Ready for D-Pad / Stick');
  const callbacksRef = useRef(navCallbacks);
  callbacksRef.current = navCallbacks;

  const lastButtonStateRef = useRef<Record<number, boolean[]>>({});
  const lastRepeatTimeRef = useRef<number>(0);

  const scanGamepads = useCallback(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }
    const rawPads = navigator.getGamepads();
    const detected: ConnectedController[] = [];
    for (const pad of rawPads) {
      if (pad && pad.connected) {
        detected.push(mapGamepadToController(pad));
      }
    }
    setGamepadControllers(detected);
  }, []);

  useEffect(() => {
    scanGamepads();
    window.addEventListener('gamepadconnected', scanGamepads);
    window.addEventListener('gamepaddisconnected', scanGamepads);
    return () => {
      window.removeEventListener('gamepadconnected', scanGamepads);
      window.removeEventListener('gamepaddisconnected', scanGamepads);
    };
  }, [scanGamepads]);

  // 60fps Gamepad Input Polling Loop for Controller UI Navigation (Phase 4)
  useEffect(() => {
    let rafId: number | null = null;

    const pollGamepadInputs = (now: number) => {
      if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
        const pads = navigator.getGamepads();
        for (const pad of pads) {
          if (!pad || !pad.connected) continue;

          const prevButtons = lastButtonStateRef.current[pad.index] || [];
          const currButtons = pad.buttons.map((b) => b.pressed);

          const justPressed = (idx: number) => Boolean(currButtons[idx] && !prevButtons[idx]);

          // D-Pad Up (12), Down (13), Left (14), Right (15)
          if (justPressed(12)) {
            setLastGamepadInputLabel('D-Pad UP');
            callbacksRef.current.onDPadDirection('UP');
          } else if (justPressed(13)) {
            setLastGamepadInputLabel('D-Pad DOWN');
            callbacksRef.current.onDPadDirection('DOWN');
          } else if (justPressed(14)) {
            setLastGamepadInputLabel('D-Pad LEFT');
            callbacksRef.current.onDPadDirection('LEFT');
          } else if (justPressed(15)) {
            setLastGamepadInputLabel('D-Pad RIGHT');
            callbacksRef.current.onDPadDirection('RIGHT');
          }

          // Primary A / Cross (0)
          if (justPressed(0)) {
            setLastGamepadInputLabel('A / Cross [Select]');
            callbacksRef.current.onPrimarySelect();
          }

          // Secondary B / Circle (1) -> Cancel / Emergency Stop
          if (justPressed(1)) {
            setLastGamepadInputLabel('B / Circle [Emergency Stop]');
            callbacksRef.current.onSecondaryCancel();
          }

          // Bumpers L1 (4) and R1 (5) for discrete slider stepping
          if (justPressed(4)) {
            setLastGamepadInputLabel('L1 Bumper [-5%]');
            callbacksRef.current.onBumperAdjust(-0.05);
          } else if (justPressed(5)) {
            setLastGamepadInputLabel('R1 Bumper [+5%]');
            callbacksRef.current.onBumperAdjust(0.05);
          }

          // Triggers L2 (6) and R2 (7) for continuous slider sweep every 90ms
          const l2Val = pad.buttons[6]?.value ?? 0;
          const r2Val = pad.buttons[7]?.value ?? 0;
          if (now - lastRepeatTimeRef.current > 90) {
            if (r2Val > 0.25) {
              lastRepeatTimeRef.current = now;
              setLastGamepadInputLabel(`R2 Trigger [+${Math.round(r2Val * 100)}%]`);
              callbacksRef.current.onBumperAdjust(0.03 * r2Val);
            } else if (l2Val > 0.25) {
              lastRepeatTimeRef.current = now;
              setLastGamepadInputLabel(`L2 Trigger [-${Math.round(l2Val * 100)}%]`);
              callbacksRef.current.onBumperAdjust(-0.03 * l2Val);
            }
          }

          lastButtonStateRef.current[pad.index] = currButtons;
        }
      }
      rafId = window.requestAnimationFrame(pollGamepadInputs);
    };

    rafId = window.requestAnimationFrame(pollGamepadInputs);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return {
    gamepadControllers,
    lastGamepadInputLabel,
    setLastGamepadInputLabel,
    rescanGamepads: scanGamepads,
  };
}
