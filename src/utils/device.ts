/**
 * Stable per-installation identifier the Lira app uses to bind itself
 * to a Telegram user inside the bot, then look up subscription status
 * by device_id without manually copying any activation code.
 *
 * Lifecycle:
 * 1. First time the app needs a device id, we generate a UUID v4 and
 *    persist it under @cycle-tracker/device-id/v1.
 * 2. The app passes this id to the bot via the deep-link
 *    ``https://t.me/<bot>?start=link_<device_id>`` (Sync with Telegram).
 * 3. The bot stores it on ``users.device_id``.
 * 4. The app polls ``GET /v1/subscription?device_id=…`` to learn the
 *    current subscription state.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@cycle-tracker/device-id/v1';

const generateUuidV4 = (): string => {
  // RFC4122 v4 UUID. ``crypto.getRandomValues`` is available in modern
  // RN (Hermes), browsers, and Expo Web; fall back to Math.random for
  // odd environments without it.
  const buf = new Uint8Array(16);
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i += 1) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
};

let cached: string | null = null;

export const getDeviceId = async (): Promise<string> => {
  if (cached) return cached;
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length > 0) {
      cached = existing;
      return existing;
    }
  } catch (e) {
    console.warn('Failed to read device id', e);
  }
  const fresh = generateUuidV4();
  cached = fresh;
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
  } catch (e) {
    console.warn('Failed to persist device id', e);
  }
  return fresh;
};
