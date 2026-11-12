import { MotorChannels, TriggerEffectMode } from '../types/haptics';

/**
 * Known Hardware Vendor & Product IDs for WebHID device filtering.
 */
export const KNOWN_HID_FILTERS = [
  // Sony Corp. DualSense Wireless Controller (PS5) & DualSense Edge
  { vendorId: 0x054c, productId: 0x0ce6, label: 'Sony DualSense (PS5)' },
  { vendorId: 0x054c, productId: 0x0df2, label: 'Sony DualSense Edge' },
  // Sony DualShock 4 (PS4 v1 & v2)
  { vendorId: 0x054c, productId: 0x05c4, label: 'Sony DualShock 4 (v1)' },
  { vendorId: 0x054c, productId: 0x09cc, label: 'Sony DualShock 4 (v2)' },
  // Microsoft Xbox Wireless & Elite Controllers (Impulse Triggers)
  { vendorId: 0x045e, productId: 0x02fd, label: 'Xbox One S Bluetooth Controller' },
  { vendorId: 0x045e, productId: 0x0b12, label: 'Xbox Series X|S Controller' },
  { vendorId: 0x045e, productId: 0x0b13, label: 'Xbox Series X|S Wireless' },
  { vendorId: 0x045e, productId: 0x0b00, label: 'Xbox Elite Wireless Series 2' },
  { vendorId: 0x045e, productId: 0x0b20, label: 'Xbox Adaptive / Wireless BLE' },
] as const;

/**
 * Clamp a floating point value (0.0 - 1.0) and convert to an unsigned 8-bit integer (0x00 - 0xFF).
 */
export function floatToUint8(val: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(val) ? val : 0));
  return Math.round(clamped * 255) & 0xff;
}

/**
 * Clamp a floating point value (0.0 - 1.0) and convert to Xbox GIP 0-100 percentage byte (0x00 - 0x64).
 */
export function floatToXboxPercentByte(val: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(val) ? val : 0));
  return Math.round(clamped * 100) & 0xff;
}

/**
 * Builds the 47-byte USB Output Report (Report ID 0x02) for the Sony PS5 DualSense Controller.
 *
 * Byte Layout Documentation (Report ID 0x02 - stripped of report ID byte when passed to sendReport(0x02, data)):
 * - Byte 0 (0x00): Valid Flag 0
 *     Bit 0 (0x01): Enable Rumble Emulation
 *     Bit 1 (0x02): Disable Haptics Audio Override (use standard rumble motors)
 *     Bit 2 (0x04): Enable Right Trigger (R2) Adaptive Effect
 *     Bit 3 (0x08): Enable Left Trigger (L2) Adaptive Effect
 *     -> Combined mask: 0x0F (0b00001111) enables both rumble motors and both L2/R2 trigger blocks
 * - Byte 1 (0x01): Valid Flag 1
 *     Bit 2 (0x04): Enable Lightbar RGB update
 *     Bit 4 (0x10): Enable Player Indicator LEDs
 * - Byte 2 (0x02): Right / High-Frequency Weak Rumble Motor (0x00 - 0xFF)
 * - Byte 3 (0x03): Left / Low-Frequency Strong Rumble Motor (0x00 - 0xFF)
 * - Bytes 4..9: Audio / Mic mute LED flags (0x00)
 * - Bytes 10..20: Right Trigger (R2) Adaptive Effect 11-byte Block:
 *     Byte 10: Mode (0x00 = Off/Release, 0x01 = Continuous Resistance, 0x02 = Section Resistance, 0x26 = High-Freq Pulse/Oscillator)
 *     Byte 11: Start Position / Zone Bitmask (e.g., 0x10 for early trigger engage)
 *     Byte 12: Force / Amplitude (0x00 - 0xFF)
 *     Byte 13: Frequency in Hz (0x01 - 0xFF) for Mode 0x26
 * - Bytes 21..31: Left Trigger (L2) Adaptive Effect 11-byte Block:
 *     Byte 21: Mode (0x00 = Off, 0x01 = Continuous, 0x02 = Section, 0x26 = Oscillator)
 *     Byte 22: Start Position / Zone Bitmask
 *     Byte 23: Force / Amplitude (0x00 - 0xFF)
 *     Byte 24: Frequency in Hz (0x01 - 0xFF) for Mode 0x26
 * - Bytes 44..46: Lightbar RGB (Red, Green, Blue: 0x00 - 0xFF)
 */
export function buildDualSenseOutputReport(
  channels: MotorChannels,
  triggerMode: TriggerEffectMode,
  oscillatorHz: number = 45
): { reportId: number; payload: Uint8Array } {
  const payload = new Uint8Array(47);

  // Byte 0: Enable Rumble (0x01 | 0x02) + Right Trigger (0x04) + Left Trigger (0x08) = 0x0F
  payload[0] = 0x0f;
  // Byte 1: Enable Lightbar RGB control (0x04) + Player LEDs (0x10) = 0x14
  payload[1] = 0x14;

  // Byte 2: Right (High-Freq Weak) motor amplitude (0x00 - 0xFF)
  payload[2] = floatToUint8(channels.highFreqWeak);
  // Byte 3: Left (Low-Freq Strong) motor amplitude (0x00 - 0xFF)
  payload[3] = floatToUint8(channels.lowFreqStrong);

  // Determine DualSense Adaptive Trigger Mode Byte
  const modeByte =
    triggerMode === TriggerEffectMode.OFF
      ? 0x00
      : triggerMode === TriggerEffectMode.CONTINUOUS
      ? 0x01
      : triggerMode === TriggerEffectMode.SECTION
      ? 0x02
      : 0x26; // 0x26 = Automatic Pulse Oscillator

  const clampedHz = Math.max(1, Math.min(255, Math.round(oscillatorHz)));

  // --- Right Trigger (R2) Block [Bytes 10..20] ---
  const r2Force = floatToUint8(channels.rightImpulseTrigger);
  if (r2Force === 0 || modeByte === 0x00) {
    payload[10] = 0x05; // 0x05 = Clear/Release trigger resistance
    payload[11] = 0x00;
    payload[12] = 0x00;
  } else if (modeByte === 0x26) {
    payload[10] = 0x26; // Pulse Oscillator
    payload[11] = 0x10; // Start zone
    payload[12] = r2Force; // Vibration amplitude
    payload[13] = clampedHz; // Oscillation frequency in Hz
  } else if (modeByte === 0x02) {
    payload[10] = 0x02; // Section resistance
    payload[11] = 0x18; // Start at 10% pull
    payload[12] = 0x90; // End at 60% pull
    payload[13] = r2Force;
  } else {
    payload[10] = 0x01; // Continuous resistance
    payload[11] = 0x10; // Start position
    payload[12] = r2Force; // Resistance force
  }

  // --- Left Trigger (L2) Block [Bytes 21..31] ---
  const l2Force = floatToUint8(channels.leftImpulseTrigger);
  if (l2Force === 0 || modeByte === 0x00) {
    payload[21] = 0x05; // Clear/Release
    payload[22] = 0x00;
    payload[23] = 0x00;
  } else if (modeByte === 0x26) {
    payload[21] = 0x26; // Pulse Oscillator
    payload[22] = 0x10;
    payload[23] = l2Force;
    payload[24] = clampedHz;
  } else if (modeByte === 0x02) {
    payload[21] = 0x02; // Section resistance
    payload[22] = 0x18;
    payload[23] = 0x90;
    payload[24] = l2Force;
  } else {
    payload[21] = 0x01; // Continuous resistance
    payload[22] = 0x10;
    payload[23] = l2Force;
  }

  // --- Lightbar RGB [Bytes 44..46]: Dynamic Cyan-to-Amber telemetry glow ---
  const peakIntensity = Math.max(
    channels.lowFreqStrong,
    channels.highFreqWeak,
    channels.leftImpulseTrigger,
    channels.rightImpulseTrigger
  );
  payload[44] = floatToUint8(peakIntensity * 0.95); // R
  payload[45] = floatToUint8(0.45 + peakIntensity * 0.35); // G
  payload[46] = floatToUint8(1.0 - peakIntensity * 0.6); // B

  return { reportId: 0x02, payload };
}

/**
 * Builds the 8-byte Xbox GIP / HID Impulse Trigger Rumble Report (Report ID 0x03 / 0x09).
 *
 * Byte Layout Documentation (8 bytes payload for Report ID 0x03):
 * - Byte 0 (0x00): Actuator Enable Bitmask
 *     Bit 0 (0x01): Right Heavy / Low-Freq Motor
 *     Bit 1 (0x02): Left Light / High-Freq Motor
 *     Bit 2 (0x04): Right Impulse Trigger (RT)
 *     Bit 3 (0x08): Left Impulse Trigger (LT)
 *     -> 0x0F (0b00001111) enables all four motors simultaneously
 * - Byte 1 (0x01): Left Impulse Trigger (LT) Magnitude (0x00 - 0x64 [0-100%])
 * - Byte 2 (0x02): Right Impulse Trigger (RT) Magnitude (0x00 - 0x64 [0-100%])
 * - Byte 3 (0x03): Left Grip Heavy / Low-Frequency Motor (0x00 - 0x64 [0-100%])
 * - Byte 4 (0x04): Right Grip Light / High-Frequency Motor (0x00 - 0x64 [0-100%])
 * - Byte 5 (0x05): Pulse Duration in 10ms units (0xFF = 2.55s continuous sustain)
 * - Byte 6 (0x06): Pulse Rest / Delay in 10ms units (0x00 = immediate continuous)
 * - Byte 7 (0x07): Repeat Loop Count (0x00 = single continuous sustain packet)
 */
export function buildXboxImpulseReport(channels: MotorChannels): {
  reportId: number;
  payload: Uint8Array;
} {
  const payload = new Uint8Array(8);

  // Byte 0: Enable all 4 actuators (LT | RT | Left Heavy | Right Light = 0x0F)
  payload[0] = 0x0f;
  // Byte 1: Left Impulse Trigger (0x00 - 0x64)
  payload[1] = floatToXboxPercentByte(channels.leftImpulseTrigger);
  // Byte 2: Right Impulse Trigger (0x00 - 0x64)
  payload[2] = floatToXboxPercentByte(channels.rightImpulseTrigger);
  // Byte 3: Left Heavy Low-Frequency Motor (0x00 - 0x64)
  payload[3] = floatToXboxPercentByte(channels.lowFreqStrong);
  // Byte 4: Right Light High-Frequency Motor (0x00 - 0x64)
  payload[4] = floatToXboxPercentByte(channels.highFreqWeak);

  const isAllZero =
    payload[1] === 0 && payload[2] === 0 && payload[3] === 0 && payload[4] === 0;

  // Byte 5: Pulse sustain duration (0x00 if stopping immediately, else 0xFF)
  payload[5] = isAllZero ? 0x00 : 0xff;
  // Byte 6: Delay (0x00)
  payload[6] = 0x00;
  // Byte 7: Repeat count (0x00)
  payload[7] = 0x00;

  return { reportId: 0x03, payload };
}

/**
 * Generates emergency zero-out packets for both DualSense and Xbox HID protocols.
 */
export function buildEmergencyStopPayloads(): {
  dualSense: { reportId: number; payload: Uint8Array };
  xbox: { reportId: number; payload: Uint8Array };
} {
  const zeroChannels: MotorChannels = {
    lowFreqStrong: 0,
    highFreqWeak: 0,
    leftImpulseTrigger: 0,
    rightImpulseTrigger: 0,
  };
  return {
    dualSense: buildDualSenseOutputReport(zeroChannels, TriggerEffectMode.OFF, 0),
    xbox: buildXboxImpulseReport(zeroChannels),
  };
}

/**
 * Formats a Uint8Array into a space-separated uppercase hexadecimal string (e.g. "0F 14 80 FF ...").
 */
export function formatHexPayload(reportId: number, bytes: Uint8Array, maxBytes = 16): string {
  const idHex = reportId.toString(16).toUpperCase().padStart(2, '0');
  const slice = bytes.slice(0, maxBytes);
  const bodyHex = Array.from(slice)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
  const suffix = bytes.length > maxBytes ? ` … (+${bytes.length - maxBytes}B)` : '';
  return `[0x${idHex}] ${bodyHex}${suffix}`;
}
