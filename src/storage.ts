import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppData,
  BoxProfile,
  DEFAULT_BOX_PROFILE,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  DEFAULT_SUBSCRIPTION,
  DayLog,
  EMPTY_ADDRESS,
  Profile,
  Settings,
  ShippingAddress,
  Subscription,
} from './types';

const STORAGE_KEY = '@cycle-tracker/data/v1';

const emptyAppData = (): AppData => ({
  logs: {},
  settings: { ...DEFAULT_SETTINGS },
  profile: { ...DEFAULT_PROFILE },
  onboardingDone: false,
  consentAcceptedAt: null,
  subscription: { ...DEFAULT_SUBSCRIPTION },
  shippingAddress: { ...EMPTY_ADDRESS },
  boxProfile: { ...DEFAULT_BOX_PROFILE },
  orders: [],
});

const normalize = (parsed: Partial<AppData>): AppData => {
  const rawSub = (parsed.subscription as Partial<Subscription> | undefined) ?? {};
  const subscription: Subscription = {
    ...DEFAULT_SUBSCRIPTION,
    ...rawSub,
    tier: rawSub.tier ?? DEFAULT_SUBSCRIPTION.tier,
  };
  // If a previous expiration date already passed, downgrade to free.
  if (
    subscription.tier !== 'free' &&
    subscription.renewsAt &&
    new Date(subscription.renewsAt).getTime() < Date.now()
  ) {
    subscription.tier = 'free';
    subscription.activationCode = null;
    subscription.cancelled = false;
  }
  return {
    logs: parsed.logs ?? {},
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) },
    onboardingDone: Boolean(parsed.onboardingDone),
    consentAcceptedAt:
      typeof parsed.consentAcceptedAt === 'string' && parsed.consentAcceptedAt
        ? parsed.consentAcceptedAt
        : null,
    subscription,
    shippingAddress: {
      ...EMPTY_ADDRESS,
      ...((parsed.shippingAddress as Partial<ShippingAddress> | undefined) ?? {}),
    },
    boxProfile: {
      ...DEFAULT_BOX_PROFILE,
      ...((parsed.boxProfile as Partial<BoxProfile> | undefined) ?? {}),
    },
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
  };
};

export const loadData = async (): Promise<AppData> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyAppData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return normalize(parsed);
  } catch (e) {
    console.warn('Failed to load data', e);
    return emptyAppData();
  }
};

export const saveData = async (data: AppData): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save data', e);
  }
};

export const exportData = async (): Promise<string> => {
  const data = await loadData();
  return JSON.stringify(data, null, 2);
};

export const importData = async (json: string): Promise<AppData> => {
  const parsed = JSON.parse(json) as Partial<AppData>;
  const data = normalize(parsed);
  await saveData(data);
  return data;
};

export const clearData = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

export type { AppData, DayLog, Profile, Settings };
