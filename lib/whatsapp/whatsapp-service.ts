import type { NotificationJobType } from "@/generated/prisma/client";

const TEMPLATE_SID_ENV_BY_TYPE: Record<NotificationJobType, string> = {
  BOOKING_CONFIRM: "TWILIO_WHATSAPP_CONTENT_SID_BOOKING_CONFIRM",
  REMINDER_24H: "TWILIO_WHATSAPP_CONTENT_SID_REMINDER_24H",
  REMINDER_1H: "TWILIO_WHATSAPP_CONTENT_SID_REMINDER_1H",
};

const getRequiredEnv = (key: string) => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}.`);
  }

  return value;
};

const normalizeWhatsAppAddress = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error("Endereco WhatsApp invalido.");
  }

  if (trimmedValue.startsWith("whatsapp:")) {
    return trimmedValue;
  }

  if (!trimmedValue.startsWith("+")) {
    throw new Error("Endereco WhatsApp deve estar em formato E.164.");
  }

  return `whatsapp:${trimmedValue}`;
};

const getTemplateSidByType = (type: NotificationJobType) => {
  const envKey = TEMPLATE_SID_ENV_BY_TYPE[type];

  if (!envKey) {
    return null;
  }

  return process.env[envKey]?.trim() || null;
};

interface SendWhatsAppMessageInput {
  to: string;
  from: string;
  type: NotificationJobType;
  contentVariables: Record<string, string>;
  fallbackBody?: string;
}

export interface SendWhatsAppMessageResult {
  providerMessageId: string;
}

export const sendWhatsAppMessage = async ({
  to,
  from,
  type,
  contentVariables,
  fallbackBody,
}: SendWhatsAppMessageInput): Promise<SendWhatsAppMessageResult> => {
  const twilioAccountSid = getRequiredEnv("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = getRequiredEnv("TWILIO_AUTH_TOKEN");

  const messageEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
  const normalizedTo = normalizeWhatsAppAddress(to);
  const normalizedFrom = normalizeWhatsAppAddress(from);
  const contentSid = getTemplateSidByType(type);

  const payload = new URLSearchParams();
  payload.set("To", normalizedTo);
  payload.set("From", normalizedFrom);

  if (contentSid) {
    payload.set("ContentSid", contentSid);
    payload.set("ContentVariables", JSON.stringify(contentVariables));
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Template ContentSid nao configurado para ${type} em ambiente de producao.`,
      );
    }

    if (!fallbackBody) {
      throw new Error(`Mensagem fallback ausente para ${type}.`);
    }

    payload.set("Body", fallbackBody);
  }

  const encodedCredentials = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString(
    "base64",
  );

  const response = await fetch(messageEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedCredentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `[twilio] Falha ao enviar mensagem (${response.status}): ${responseText.slice(0, 500)}`,
    );
  }

  let parsedResponse: unknown;

  try {
    parsedResponse = JSON.parse(responseText) as unknown;
  } catch {
    throw new Error("[twilio] Resposta invalida da API de mensagens.");
  }

  const providerMessageId =
    typeof parsedResponse === "object" &&
    parsedResponse !== null &&
    "sid" in parsedResponse &&
    typeof (parsedResponse as { sid?: unknown }).sid === "string"
      ? (parsedResponse as { sid: string }).sid
      : null;

  if (!providerMessageId) {
    throw new Error("[twilio] Resposta sem sid da mensagem.");
  }

  return {
    providerMessageId,
  };
};
