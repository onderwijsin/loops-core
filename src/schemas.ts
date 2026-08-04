import { z } from "zod";

const mailingListSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  isPublic: z.boolean()
});

/** Validates the shared fields of a Loops webhook event. */
export const loopsWebhookEnvelopeSchema = z.object({
  eventName: z.string(),
  eventTime: z.number().int().nonnegative(),
  webhookSchemaVersion: z.literal("1.0.0")
});

/** Validates a campaign delivery webhook at the external boundary. */
export const loopsCampaignWebhookSchema = z.strictObject({
  eventName: z.literal("campaign.email.sent"),
  eventTime: z.number().int().nonnegative(),
  webhookSchemaVersion: z.literal("1.0.0"),
  contactIdentity: z
    .strictObject({ id: z.string(), email: z.email(), userId: z.string().nullable() })
    .optional(),
  campaignId: z.string().min(1),
  campaignName: z.string(),
  email: z.strictObject({
    id: z.string().min(1),
    emailMessageId: z.string().min(1),
    subject: z.string()
  }),
  mailingLists: z.array(mailingListSchema).optional()
});

/** Validates and normalizes an Email Campaign API email-message response. */
export const loopsEmailMessageSchema = z
  .strictObject({
    id: z.string().min(1),
    campaignId: z.string().optional(),
    transactionalId: z.string().optional(),
    subject: z.string(),
    previewText: z.string(),
    fromName: z.string(),
    fromEmail: z.string(),
    replyToEmail: z.string(),
    ccEmail: z.string().optional(),
    bccEmail: z.string().optional(),
    languageCode: z.string().optional(),
    emailFormat: z.enum(["styled", "plain"]),
    lmx: z.string(),
    contentRevisionId: z.string().nullable(),
    updatedAt: z.iso.datetime(),
    contactPropertiesFallbacks: z.record(z.string(), z.string()).optional(),
    eventPropertiesFallbacks: z.record(z.string(), z.string()).optional(),
    dataVariablesFallbacks: z.record(z.string(), z.string()).optional(),
    warnings: z
      .array(
        z.object({
          rule: z.string(),
          severity: z.literal("warning"),
          message: z.string(),
          path: z.string().optional()
        })
      )
      .optional()
  })
  .transform((message) => ({
    campaignId: message.campaignId,
    subject: message.subject,
    previewText: message.previewText,
    fromName: message.fromName,
    fromEmail: message.fromEmail,
    replyToEmail: message.replyToEmail,
    languageCode: message.languageCode ?? null,
    emailFormat: message.emailFormat,
    lmx: message.lmx,
    updatedAt: new Date(message.updatedAt)
  }));

/** Validates and normalizes a reusable LMX component response. */
export const loopsComponentSchema = z
  .strictObject({ id: z.string().min(1), name: z.string(), lmx: z.string() })
  .transform(({ id, lmx }) => ({ componentId: id, lmx }));

/** A validated campaign delivery event. */
export type LoopsCampaignWebhook = z.infer<typeof loopsCampaignWebhookSchema>;
/** A normalized Loops email-message response. */
export type LoopsEmailMessage = z.infer<typeof loopsEmailMessageSchema>;
/** A normalized reusable LMX component response. */
export type LoopsComponent = z.infer<typeof loopsComponentSchema>;
/** A validated generic Loops webhook envelope. */
export type LoopsWebhookEnvelope = z.infer<typeof loopsWebhookEnvelopeSchema>;
