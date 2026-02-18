import type {
  BarbershopPlan,
  NotificationJobType,
  WhatsAppProvider,
} from "@/generated/prisma/client";

export type NotificationFeatureBlockReason =
  | "plan_downgrade"
  | "feature_disabled";

export interface NotificationBarbershopGateInput {
  plan: BarbershopPlan;
  whatsappProvider: WhatsAppProvider;
  whatsappEnabled: boolean;
}

export interface NotificationSettingsGateInput {
  sendBookingConfirmation: boolean;
  sendReminder24h: boolean;
  sendReminder1h: boolean;
}

export const DEFAULT_WHATSAPP_SETTINGS: NotificationSettingsGateInput = {
  sendBookingConfirmation: true,
  sendReminder24h: true,
  sendReminder1h: true,
};

const isTypeEnabled = (
  settings: NotificationSettingsGateInput,
  type: NotificationJobType,
) => {
  if (type === "BOOKING_CONFIRM") {
    return settings.sendBookingConfirmation;
  }

  if (type === "REMINDER_24H") {
    return settings.sendReminder24h;
  }

  return settings.sendReminder1h;
};

export const resolveNotificationSettings = (
  settings: Partial<NotificationSettingsGateInput> | null | undefined,
): NotificationSettingsGateInput => {
  return {
    sendBookingConfirmation:
      settings?.sendBookingConfirmation ?? DEFAULT_WHATSAPP_SETTINGS.sendBookingConfirmation,
    sendReminder24h:
      settings?.sendReminder24h ?? DEFAULT_WHATSAPP_SETTINGS.sendReminder24h,
    sendReminder1h:
      settings?.sendReminder1h ?? DEFAULT_WHATSAPP_SETTINGS.sendReminder1h,
  };
};

export const getNotificationFeatureBlockReason = ({
  barbershop,
  settings,
  type,
}: {
  barbershop: NotificationBarbershopGateInput;
  settings: Partial<NotificationSettingsGateInput> | null | undefined;
  type: NotificationJobType;
}): NotificationFeatureBlockReason | null => {
  if (barbershop.plan !== "PRO") {
    return "plan_downgrade";
  }

  if (!barbershop.whatsappEnabled || barbershop.whatsappProvider !== "TWILIO") {
    return "feature_disabled";
  }

  const normalizedSettings = resolveNotificationSettings(settings);

  if (!isTypeEnabled(normalizedSettings, type)) {
    return "feature_disabled";
  }

  return null;
};
