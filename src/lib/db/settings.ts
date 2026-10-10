import { db } from './schema';
import type { UserSettings } from './types';

const SETTINGS_ID = 'user-settings';

const defaultSettings: UserSettings = {
  id: SETTINGS_ID,
  dailyCapacityHours: 6,
  bufferPercent: 15,
  emaAlpha: 0.3,
  outlierThresholdSigma: 2.0,
  theme: 'system',
};

export async function getSettings(): Promise<UserSettings> {
  const settings = await db.settings.get(SETTINGS_ID);
  if (settings) {
    return settings;
  }
  await db.settings.add(defaultSettings);
  return defaultSettings;
}

export async function updateSettings(updates: Partial<UserSettings>): Promise<void> {
  await getSettings(); // Ensure settings exist before updating
  await db.settings.update(SETTINGS_ID, updates);
}
