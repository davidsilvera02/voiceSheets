import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AuthContext } from "@/server/auth";
import type { z } from "zod";
import type { userSettingsSchema } from "@/lib/validations";

export interface SettingsDTO {
  theme: string;
  dateFormat: string;
  currency: string;
  locale: string;
  aiPreferences: Record<string, unknown>;
  exportDefaults: Record<string, unknown>;
}

export async function getSettings(ctx: AuthContext): Promise<SettingsDTO> {
  const settings = await prisma.userSettings.upsert({
    where: { userId: ctx.user.id },
    update: {},
    create: { userId: ctx.user.id },
  });
  return {
    theme: settings.theme,
    dateFormat: settings.dateFormat,
    currency: settings.currency,
    locale: settings.locale,
    aiPreferences: (settings.aiPreferences as Record<string, unknown>) ?? {},
    exportDefaults: (settings.exportDefaults as Record<string, unknown>) ?? {},
  };
}

export async function updateSettings(
  ctx: AuthContext,
  input: z.infer<typeof userSettingsSchema>,
): Promise<SettingsDTO> {
  const settings = await prisma.userSettings.upsert({
    where: { userId: ctx.user.id },
    update: {
      theme: input.theme ?? undefined,
      dateFormat: input.dateFormat ?? undefined,
      currency: input.currency ?? undefined,
      locale: input.locale ?? undefined,
      aiPreferences: (input.aiPreferences ?? undefined) as Prisma.InputJsonValue | undefined,
      exportDefaults: (input.exportDefaults ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    create: {
      userId: ctx.user.id,
      theme: input.theme ?? "system",
      dateFormat: input.dateFormat ?? "yyyy-MM-dd",
      currency: input.currency ?? "USD",
      locale: input.locale ?? "en-US",
      aiPreferences: (input.aiPreferences ?? undefined) as Prisma.InputJsonValue | undefined,
      exportDefaults: (input.exportDefaults ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  return {
    theme: settings.theme,
    dateFormat: settings.dateFormat,
    currency: settings.currency,
    locale: settings.locale,
    aiPreferences: (settings.aiPreferences as Record<string, unknown>) ?? {},
    exportDefaults: (settings.exportDefaults as Record<string, unknown>) ?? {},
  };
}
