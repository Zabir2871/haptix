import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ConnectedController,
  ControllerProtocol,
  EngineParameters,
  FocusZoneId,
  VibrationPattern,
} from '../types/haptics';
import {
  createCustomPatternFromSamples,
  DEFAULT_PATTERNS,
} from '../engine/patternLibrary';
import {
  EngineTelemetrySnapshot,
  vibrationEngine,
} from '../engine/VibrationEngine';
import { useWebHID } from '../hooks/useWebHID';
import { useGamepad } from '../hooks/useGamepad';

const CUSTOM_PATTERNS_STORAGE_KEY = 'haptix_custom_patterns_v1';

export const ORDERED_FOCUS_ZONES: FocusZoneId[] = [
  'EMERGENCY_STOP',
  'ENGINE_TOGGLE',
  'XY_TOUCHPAD',
  'SLIDER_STRENGTH',
  'SLIDER_SPEED',
  'SLIDER_TEMPO',
  'SLIDER_TRIGGERS',
  'PATTERN_HEARTBEAT',
  'PATTERN_WAVE',
  'PATTERN_STUTTER',
  'PATTERN_POLYRHYTHM',
  'PATTERN_SUBBASS',
  'PATTERN_CASCADE',
  'PATTERN_RECORD',
  'SIMULATE_HARDWARE',
  'CONNECT_WEBHID',
];

const SIMULATED_RIG_CONTROLLERS: ConnectedController[] = [
  {
    id: 'sim-dualsense-edge-01',
    name: 'PS5 DualSense Wireless (Virtual Studio Rig)',
    vendorId: 0x054c,
    productId: 0x0ce6,
    gamepadIndex: 0,
    protocol: ControllerProtocol.WEBHID_DUALSENSE,
    isSimulated: true,
    capabilities: {
      basicRumble: true,
      triggerHaptics: true,
      adaptiveResistance: true,
      ledControl: true,
      batteryTelemetry: true,
    },
    connectedAt: Date.now(),
  },
  {
    id: 'sim-xbox-impulse-02',
    name: 'Xbox Elite Series 2 (Impulse Trigger Bus)',
    vendorId: 0x045e,
    productId: 0x0b00,
    gamepadIndex: 1,
    protocol: ControllerProtocol.WEBHID_XBOX,
    isSimulated: true,
    capabilities: {
      basicRumble: true,
      triggerHaptics: true,
      adaptiveResistance: false,
      ledControl: false,
      batteryTelemetry: true,
    },
    connectedAt: Date.now(),
  },
];

interface HapticsContextValue {
  telemetry: EngineTelemetrySnapshot;
  controllers: ConnectedController[];
  isSimulatedRigEnabled: boolean;
  toggleSimulatedRig: () => void;
  isWebHIDSupported: boolean;
  hidStatusMessage: string | null;
  requestWebHIDDevice: () => Promise<void>;
  patterns: VibrationPattern[];
  selectPattern: (pattern: VibrationPattern) => void;
  saveCustomPattern: (
    name: string,
    samples: Array<{ x: number; y: number; timestampMs: number }>
  ) => VibrationPattern;
  deleteCustomPattern: (id: string) => void;
  updateParameters: (partial: Partial<EngineParameters>) => void;
  updateXYVector: (x: number, y: number, autoStart?: boolean) => void;
  toggleEngineRunning: () => void;
  triggerEmergencyStop: () => void;
  resetEmergencyStop: () => void;
  toggleAudioMonitor: () => void;
  focusedZone: FocusZoneId;
  setFocusedZone: (zone: FocusZoneId) => void;
  stepFocusZone: (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void;
  triggerFocusedZoneAction: () => void;
  adjustFocusedSlider: (delta: number) => void;
  lastGamepadInputLabel: string;
}

const HapticsContext = createContext<HapticsContextValue | null>(null);

export const HapticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telemetry, setTelemetry] = useState<EngineTelemetrySnapshot>(() =>
    vibrationEngine.getSnapshot()
  );
  const [isSimulatedRigEnabled, setIsSimulatedRigEnabled] = useState<boolean>(true);
  const [customPatterns, setCustomPatterns] = useState<VibrationPattern[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PATTERNS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as VibrationPattern[]) : [];
    } catch {
      return [];
    }
  });
  const [focusedZone, setFocusedZoneState] = useState<FocusZoneId>('XY_TOUCHPAD');

  const { hidControllers, isWebHIDSupported, hidStatusMessage, requestWebHIDDevice } =
    useWebHID();

  const allPatterns = useMemo(
    () => [...DEFAULT_PATTERNS, ...customPatterns],
    [customPatterns]
  );

  // Subscribe to VibrationEngine telemetry updates
  useEffect(() => {
    return vibrationEngine.subscribe((snap) => {
      setTelemetry(snap);
    });
  }, []);

  const setFocusedZone = useCallback((zone: FocusZoneId) => {
    setFocusedZoneState(zone);
    vibrationEngine.triggerNavigationHapticTick(0.22);
  }, []);

  const stepFocusZone = useCallback((dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    setFocusedZoneState((current) => {
      const idx = ORDERED_FOCUS_ZONES.indexOf(current);
      const step = dir === 'DOWN' || dir === 'RIGHT' ? 1 : -1;
      const nextIdx =
        (idx + step + ORDERED_FOCUS_ZONES.length) % ORDERED_FOCUS_ZONES.length;
      return ORDERED_FOCUS_ZONES[nextIdx];
    });
    vibrationEngine.triggerNavigationHapticTick(0.28);
  }, []);

  const adjustFocusedSlider = useCallback(
    (delta: number) => {
      const snap = vibrationEngine.getSnapshot();
      if (snap.isEmergencyStopped) return;

      if (focusedZone === 'SLIDER_STRENGTH' || focusedZone === 'XY_TOUCHPAD') {
        vibrationEngine.setParameters({
          strength: Math.max(0, Math.min(1, snap.parameters.strength + delta)),
        });
      } else if (focusedZone === 'SLIDER_SPEED') {
        vibrationEngine.setParameters({
          speed: Math.max(0, Math.min(1, snap.parameters.speed + delta)),
        });
      } else if (focusedZone === 'SLIDER_TEMPO') {
        vibrationEngine.setParameters({
          tempo: Math.round(
            Math.max(20, Math.min(240, snap.parameters.tempo + delta * 120))
          ),
        });
      } else if (focusedZone === 'SLIDER_TRIGGERS') {
        vibrationEngine.setParameters({
          triggerRatio: Math.max(0, Math.min(1, snap.parameters.triggerRatio + delta)),
        });
      } else {
        // Default bumper behavior adjusts master Strength
        vibrationEngine.setParameters({
          strength: Math.max(0, Math.min(1, snap.parameters.strength + delta)),
        });
      }
      vibrationEngine.triggerNavigationHapticTick(0.18);
    },
    [focusedZone]
  );

  const triggerFocusedZoneAction = useCallback(() => {
    const snap = vibrationEngine.getSnapshot();
    switch (focusedZone) {
      case 'EMERGENCY_STOP':
        vibrationEngine.emergencyStop();
        break;
      case 'ENGINE_TOGGLE':
      case 'XY_TOUCHPAD':
        if (snap.isRunning) {
          vibrationEngine.pause();
        } else {
          vibrationEngine.start();
        }
        break;
      case 'PATTERN_HEARTBEAT':
        vibrationEngine.setPattern(DEFAULT_PATTERNS[1]);
        if (!snap.isRunning) vibrationEngine.start();
        break;
      case 'PATTERN_WAVE':
        vibrationEngine.setPattern(DEFAULT_PATTERNS[2]);
        if (!snap.isRunning) vibrationEngine.start();
        break;
      case 'PATTERN_STUTTER':
        vibrationEngine.setPattern(DEFAULT_PATTERNS[3]);
        if (!snap.isRunning) vibrationEngine.start();
        break;
      case 'PATTERN_POLYRHYTHM':
        vibrationEngine.setPattern(DEFAULT_PATTERNS[4]);
        if (!snap.isRunning) vibrationEngine.start();
        break;
      case 'PATTERN_SUBBASS':
        vibrationEngine.setPattern(DEFAULT_PATTERNS[5]);
        if (!snap.isRunning) vibrationEngine.start();
        break;
      case 'PATTERN_CASCADE':
        vibrationEngine.setPattern(DEFAULT_PATTERNS[0]);
        if (!snap.isRunning) vibrationEngine.start();
        break;
      case 'SIMULATE_HARDWARE':
        setIsSimulatedRigEnabled((v) => !v);
        break;
      case 'CONNECT_WEBHID':
        void requestWebHIDDevice();
        break;
      default:
        break;
    }
    vibrationEngine.triggerNavigationHapticTick(0.45);
  }, [focusedZone, requestWebHIDDevice]);

  const { gamepadControllers, lastGamepadInputLabel, setLastGamepadInputLabel } =
    useGamepad({
      onDPadDirection: stepFocusZone,
      onPrimarySelect: triggerFocusedZoneAction,
      onSecondaryCancel: () => vibrationEngine.emergencyStop(),
      onBumperAdjust: adjustFocusedSlider,
    });

  // Merge physical Gamepad API, physical WebHID, and optional Virtual Studio Rig
  const controllers = useMemo(() => {
    const combined: ConnectedController[] = [
      ...hidControllers,
      ...gamepadControllers,
    ];
    if (isSimulatedRigEnabled) {
      combined.push(...SIMULATED_RIG_CONTROLLERS);
    }
    return combined;
  }, [hidControllers, gamepadControllers, isSimulatedRigEnabled]);

  useEffect(() => {
    vibrationEngine.setConnectedControllers(controllers);
  }, [controllers]);

  // Global keyboard bindings for D-Pad navigation + Emergency Stop (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') {
          vibrationEngine.emergencyStop();
          setLastGamepadInputLabel('ESC [Emergency Stop]');
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        vibrationEngine.emergencyStop();
        setLastGamepadInputLabel('ESC / B-Circle [Emergency Stop]');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setLastGamepadInputLabel('D-Pad DOWN');
        stepFocusZone('DOWN');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setLastGamepadInputLabel('D-Pad UP');
        stepFocusZone('UP');
      } else if (e.key === 'ArrowLeft' || e.key === '[') {
        e.preventDefault();
        setLastGamepadInputLabel('L1 Bumper [-5%]');
        adjustFocusedSlider(-0.05);
      } else if (e.key === 'ArrowRight' || e.key === ']') {
        e.preventDefault();
        setLastGamepadInputLabel('R1 Bumper [+5%]');
        adjustFocusedSlider(0.05);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setLastGamepadInputLabel('A / Cross [Select]');
        triggerFocusedZoneAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    stepFocusZone,
    adjustFocusedSlider,
    triggerFocusedZoneAction,
    setLastGamepadInputLabel,
  ]);

  const selectPattern = useCallback((pattern: VibrationPattern) => {
    vibrationEngine.setPattern(pattern);
  }, []);

  const saveCustomPattern = useCallback(
    (name: string, samples: Array<{ x: number; y: number; timestampMs: number }>) => {
      const created = createCustomPatternFromSamples(name, samples);
      setCustomPatterns((prev) => {
        const updated = [created, ...prev];
        try {
          localStorage.setItem(CUSTOM_PATTERNS_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore quota errors
        }
        return updated;
      });
      vibrationEngine.setPattern(created);
      return created;
    },
    []
  );

  const deleteCustomPattern = useCallback((id: string) => {
    setCustomPatterns((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem(CUSTOM_PATTERNS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  }, []);

  const updateParameters = useCallback((partial: Partial<EngineParameters>) => {
    vibrationEngine.setParameters(partial);
  }, []);

  const updateXYVector = useCallback((x: number, y: number, autoStart = true) => {
    vibrationEngine.setXYVector(x, y, autoStart);
  }, []);

  const toggleEngineRunning = useCallback(() => {
    const snap = vibrationEngine.getSnapshot();
    if (snap.isRunning) {
      vibrationEngine.pause();
    } else {
      vibrationEngine.start();
    }
  }, []);

  const triggerEmergencyStop = useCallback(() => {
    vibrationEngine.emergencyStop();
  }, []);

  const resetEmergencyStop = useCallback(() => {
    vibrationEngine.clearEmergencyStopLatch();
  }, []);

  const toggleAudioMonitor = useCallback(() => {
    const snap = vibrationEngine.getSnapshot();
    vibrationEngine.setAudioMonitorEnabled(!snap.audioMonitorEnabled);
  }, []);

  const toggleSimulatedRig = useCallback(() => {
    setIsSimulatedRigEnabled((v) => !v);
  }, []);

  const value: HapticsContextValue = {
    telemetry,
    controllers,
    isSimulatedRigEnabled,
    toggleSimulatedRig,
    isWebHIDSupported,
    hidStatusMessage,
    requestWebHIDDevice,
    patterns: allPatterns,
    selectPattern,
    saveCustomPattern,
    deleteCustomPattern,
    updateParameters,
    updateXYVector,
    toggleEngineRunning,
    triggerEmergencyStop,
    resetEmergencyStop,
    toggleAudioMonitor,
    focusedZone,
    setFocusedZone,
    stepFocusZone,
    triggerFocusedZoneAction,
    adjustFocusedSlider,
    lastGamepadInputLabel,
  };

  return <HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>;
};

export function useHaptics(): HapticsContextValue {
  const ctx = useContext(HapticsContext);
  if (!ctx) {
    throw new Error('useHaptics must be used inside a HapticsProvider');
  }
  return ctx;
}
