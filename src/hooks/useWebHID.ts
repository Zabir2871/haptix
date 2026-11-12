import { useCallback, useEffect, useState } from 'react';
import { ConnectedController, ControllerProtocol } from '../types/haptics';
import { KNOWN_HID_FILTERS } from '../engine/webhidPayloads';

interface NavigatorHIDDevice {
  opened: boolean;
  vendorId: number;
  productId: number;
  productName: string;
  open: () => Promise<void>;
  close: () => Promise<void>;
  sendReport: (reportId: number, data: Uint8Array | BufferSource) => Promise<void>;
}

interface NavigatorWithHID extends Navigator {
  hid?: {
    getDevices: () => Promise<NavigatorHIDDevice[]>;
    requestDevice: (options: {
      filters: Array<{ vendorId: number; productId?: number }>;
    }) => Promise<NavigatorHIDDevice[]>;
    addEventListener: (
      type: 'connect' | 'disconnect',
      listener: (ev: { device: NavigatorHIDDevice }) => void
    ) => void;
    removeEventListener: (
      type: 'connect' | 'disconnect',
      listener: (ev: { device: NavigatorHIDDevice }) => void
    ) => void;
  };
}

function mapHIDDeviceToController(device: NavigatorHIDDevice): ConnectedController {
  const isSony = device.vendorId === 0x054c;
  const protocol = isSony
    ? ControllerProtocol.WEBHID_DUALSENSE
    : ControllerProtocol.WEBHID_XBOX;

  return {
    id: `webhid-${device.vendorId.toString(16)}-${device.productId.toString(16)}`,
    name:
      device.productName ||
      (isSony ? 'Sony DualSense Wireless (WebHID)' : 'Xbox Impulse Controller (WebHID)'),
    vendorId: device.vendorId,
    productId: device.productId,
    gamepadIndex: null,
    protocol,
    capabilities: {
      basicRumble: true,
      triggerHaptics: true,
      adaptiveResistance: isSony,
      ledControl: isSony,
      batteryTelemetry: true,
    },
    connectedAt: Date.now(),
    hidDevice: device,
  };
}

/**
 * Phase 1 Hook: useWebHID
 * Manages direct browser WebHID hardware pairing for PS5 DualSense (0x054C)
 * and Xbox Wireless Impulse Trigger (0x045E) controllers.
 */
export function useWebHID() {
  const [hidControllers, setHidControllers] = useState<ConnectedController[]>([]);
  const [isWebHIDSupported, setIsWebHIDSupported] = useState<boolean>(false);
  const [hidStatusMessage, setHidStatusMessage] = useState<string | null>(null);

  const syncGrantedDevices = useCallback(async () => {
    const nav = navigator as NavigatorWithHID;
    if (!nav.hid) return;
    try {
      const devices = await nav.hid.getDevices();
      const openedList: ConnectedController[] = [];
      for (const dev of devices) {
        if (!dev.opened) {
          try {
            await dev.open();
          } catch {
            // Device may be busy or restricted
          }
        }
        openedList.push(mapHIDDeviceToController(dev));
      }
      setHidControllers(openedList);
    } catch {
      // Ignore WebHID permission errors inside cross-origin frames
    }
  }, []);

  useEffect(() => {
    const nav = navigator as NavigatorWithHID;
    const supported = Boolean(nav && nav.hid);
    setIsWebHIDSupported(supported);
    if (!supported || !nav.hid) return;

    void syncGrantedDevices();

    const handleConnect = (ev: { device: NavigatorHIDDevice }) => {
      void (async () => {
        try {
          if (!ev.device.opened) await ev.device.open();
          setHidControllers((prev) => {
            const mapped = mapHIDDeviceToController(ev.device);
            return [...prev.filter((c) => c.id !== mapped.id), mapped];
          });
          setHidStatusMessage(`WebHID linked: ${ev.device.productName || 'Controller'}`);
        } catch {
          // Ignore open error
        }
      })();
    };

    const handleDisconnect = (ev: { device: NavigatorHIDDevice }) => {
      const targetId = `webhid-${ev.device.vendorId.toString(16)}-${ev.device.productId.toString(16)}`;
      setHidControllers((prev) => prev.filter((c) => c.id !== targetId));
      setHidStatusMessage(`WebHID disconnected: ${ev.device.productName || 'Controller'}`);
    };

    nav.hid.addEventListener('connect', handleConnect);
    nav.hid.addEventListener('disconnect', handleDisconnect);

    return () => {
      nav.hid?.removeEventListener('connect', handleConnect);
      nav.hid?.removeEventListener('disconnect', handleDisconnect);
    };
  }, [syncGrantedDevices]);

  const requestWebHIDDevice = useCallback(async () => {
    const nav = navigator as NavigatorWithHID;
    if (!nav.hid) {
      setHidStatusMessage(
        'WebHID API is unavailable in this browser context. Use Virtual DualSense/Xbox Rig or standard Gamepad API.'
      );
      return;
    }

    try {
      const selected = await nav.hid.requestDevice({
        filters: KNOWN_HID_FILTERS.map((f) => ({
          vendorId: f.vendorId,
          productId: f.productId,
        })),
      });

      if (!selected || selected.length === 0) {
        setHidStatusMessage('No WebHID controller selected from browser prompt.');
        return;
      }

      const newlyOpened: ConnectedController[] = [];
      for (const dev of selected) {
        if (!dev.opened) {
          await dev.open();
        }
        newlyOpened.push(mapHIDDeviceToController(dev));
      }

      setHidControllers((prev) => {
        const ids = new Set(newlyOpened.map((d) => d.id));
        return [...prev.filter((c) => !ids.has(c.id)), ...newlyOpened];
      });
      setHidStatusMessage(`WebHID active: ${newlyOpened.map((d) => d.name).join(', ')}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WebHID pairing cancelled';
      setHidStatusMessage(`WebHID Notice: ${msg}. Virtual DualSense Rig remains active.`);
    }
  }, []);

  return {
    hidControllers,
    isWebHIDSupported,
    hidStatusMessage,
    requestWebHIDDevice,
  };
}
