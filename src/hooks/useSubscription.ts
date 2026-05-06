import { differenceInCalendarDays, isBefore, parseISO } from 'date-fns';
import { useCallback, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { DEFAULT_SUBSCRIPTION, Subscription, SubscriptionTier } from '../types';
import { fetchSubscriptionStatus } from '../utils/subscription';

export type SubscriptionType = 'premium' | 'basic_box' | 'vip_box' | 'none';

export interface UseSubscriptionApi {
  subscription: Subscription;
  tier: SubscriptionTier;
  /** Friendlier alias used by gates / settings: which kind of plan is active. */
  subscriptionType: SubscriptionType;
  isActive: boolean;
  isBasic: boolean;
  isVip: boolean;
  /** True when any active plan unlocks Premium features (premium / basic / vip). */
  isPremium: boolean;
  /** True when an active plan ships physical boxes (basic / vip). */
  isBoxActive: boolean;
  daysLeft: number;
  /**
   * Force a refresh of subscription status against the API (using the
   * locally-stored device_id). Returns the resolved tier or ``null`` if
   * the device is not yet linked / no active subscription.
   */
  refresh: () => Promise<SubscriptionTier | null>;
}

const isActiveNow = (sub: Subscription, now = new Date()): boolean => {
  if (sub.tier === 'free' || !sub.renewsAt) return false;
  try {
    return !isBefore(parseISO(sub.renewsAt), now);
  } catch {
    return false;
  }
};

const computeDaysLeft = (sub: Subscription, now = new Date()): number => {
  if (!sub.renewsAt) return 0;
  try {
    const days = differenceInCalendarDays(parseISO(sub.renewsAt), now);
    return Math.max(0, days);
  } catch {
    return 0;
  }
};

const POLL_INTERVAL_MS = 30_000;

/**
 * Subscription state hook.
 *
 * Source of truth: the FlowCare backend (`./api/`) which is fed by the
 * Telegram bot (`./bot/`). The user no longer pastes activation codes —
 * after tapping "Synchronize with Telegram" once, the app polls
 * ``/v1/subscription?device_id=…`` and mirrors the resulting tier
 * locally.
 */
export const useSubscription = (): UseSubscriptionApi => {
  const { data, updateSubscription } = useApp();
  const sub = data.subscription;
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (sub.tier !== 'free' && sub.renewsAt && !isActiveNow(sub)) {
      void updateSubscription({ ...DEFAULT_SUBSCRIPTION });
    }
  }, [sub, updateSubscription]);

  const refresh = useCallback<UseSubscriptionApi['refresh']>(async () => {
    lastSyncRef.current = Date.now();
    const status = await fetchSubscriptionStatus();
    if (!status.valid || !status.tariff || !status.expires) {
      // Device known but no subscription, or device not linked yet — if
      // we previously had a tier, leave it alone (the local copy may
      // be ahead of the API). The expiry guard above will downgrade it.
      return null;
    }
    const renewsAtIso = `${status.expires}T00:00:00.000Z`;
    const nowIso = new Date().toISOString();
    const productId =
      status.tariff === 'vip'
        ? 'vip_monthly'
        : status.tariff === 'premium'
          ? 'premium_monthly'
          : 'basic_monthly';
    await updateSubscription({
      tier: status.tariff,
      productId,
      startedAt: nowIso,
      renewsAt: renewsAtIso,
      cancelled: false,
      lastSyncedAt: nowIso,
      activationCode: null,
    });
    return status.tariff;
  }, [updateSubscription]);

  // Auto-poll on mount (and every 30s while mounted). Cheap (~120 bytes
  // each) and the user expects "I just paid in the bot, the app should
  // know within seconds".
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await refresh();
      } catch {
        // Network errors are silent; we just retry on the next tick.
      }
    };
    void tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

  const active = isActiveNow(sub);
  const isBasic = active && sub.tier === 'basic';
  const isVip = active && sub.tier === 'vip';
  const isBoxActive = isBasic || isVip;
  const isPremiumOnly = active && sub.tier === 'premium';
  const isPremium = isPremiumOnly || isBoxActive;
  const subscriptionType: SubscriptionType = !active
    ? 'none'
    : sub.tier === 'vip'
      ? 'vip_box'
      : sub.tier === 'basic'
        ? 'basic_box'
        : sub.tier === 'premium'
          ? 'premium'
          : 'none';

  return {
    subscription: sub,
    tier: sub.tier,
    subscriptionType,
    isActive: active,
    isBasic,
    isVip,
    isPremium,
    isBoxActive,
    daysLeft: computeDaysLeft(sub),
    refresh,
  };
};
