import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export const SETTING_DEFAULTS = {
  "marketplace.requireApproval": false,
  "ai.enabled": true,
  "ai.hourlyLimitPerUser": 30,
  "platform.supportEmail": "support@agriflow.example",
  "platform.maintenanceBanner": "",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return (row?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function allSettings() {
  const rows = await prisma.systemSetting.findMany();
  return (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((key) => ({
    key,
    value: (rows.find((r) => r.key === key)?.value ?? SETTING_DEFAULTS[key]) as Prisma.JsonValue,
    updatedAt: rows.find((r) => r.key === key)?.updatedAt ?? null,
  }));
}

export async function setSetting(actorId: string, key: SettingKey, value: Prisma.InputJsonValue) {
  await prisma.systemSetting.upsert({ where: { key }, create: { key, value, updatedById: actorId }, update: { value, updatedById: actorId } });
  await audit({ actorId, action: "setting.update", entityType: "SystemSetting", entityId: key, metadata: { value } });
}
