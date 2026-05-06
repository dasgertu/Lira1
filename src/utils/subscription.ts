/**
 * Subscription status client.
 *
 * Replaces the legacy code-based activation flow. Once the user taps
 * "Synchronize with Telegram" in the app, the bot binds the device_id
 * to the user's Telegram account (`/start link_<device_id>` deep link).
 * From that point on, the app reads subscription state via this module,
 * with no manual code entry needed.
 */
import Constants from 'expo-constants';

import { SubscriptionTier } from '../types';
import { getDeviceId } from './device';

export interface SubscriptionStatus {
  valid: boolean;
  tariff?: SubscriptionTier;
  expires?: string;
  /** ``true`` once the device_id is known to the bot. */
  linked: boolean;
}

const fallbackBase = 'https://flowcare-api.example.com';

const baseUrl = (): string => {
  const fromExtra =
    (Constants?.expoConfig?.extra as Record<string, unknown> | undefined)?.[
      'activationApiUrl'
    ] ??
    (Constants?.manifest2?.extra as Record<string, unknown> | undefined)?.[
      'activationApiUrl'
    ];
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  return fallbackBase;
};

const BOT_USERNAME = 'lowerBsk24_bot';

export const fetchSubscriptionStatus = async (
  deviceIdOverride?: string,
): Promise<SubscriptionStatus> => {
  const deviceId = deviceIdOverride ?? (await getDeviceId());
  const url = `${baseUrl().replace(/\/$/, '')}/v1/subscription?device_id=${encodeURIComponent(
    deviceId,
  )}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      return { valid: false, linked: false };
    }
    const json = (await res.json()) as {
      valid?: boolean;
      tariff?: string;
      expires?: string;
      linked?: boolean;
    };
    const tariff = json.tariff as SubscriptionTier | undefined;
    return {
      valid: Boolean(json.valid),
      tariff,
      expires: json.expires,
      linked: Boolean(json.linked),
    };
  } catch {
    return { valid: false, linked: false };
  }
};

/** Build the ``t.me/<bot>?start=link_<device_id>`` deep link. */
export const buildTelegramLinkUrl = async (
  deviceIdOverride?: string,
): Promise<string> => {
  const deviceId = deviceIdOverride ?? (await getDeviceId());
  return `https://t.me/${BOT_USERNAME}?start=link_${encodeURIComponent(deviceId)}`;
};
