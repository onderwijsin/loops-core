import { z } from "zod";

const baseWebhookSchema = z.object({
  eventName: z.string(),
  eventTime: z.number().int().nonnegative(),
  webhookSchemaVersion: z.literal("1.0.0")
});

const contactIdentitySchema = z.strictObject({
  id: z.string(),
  email: z.email(),
  userId: z.string().nullable()
});

const contactSchema = z.object({
  id: z.string(),
  email: z.email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  source: z.string(),
  subscribed: z.boolean(),
  userGroup: z.string(),
  userId: z.string().nullable(),
  mailingLists: z.record(z.string(), z.boolean()),
  optInStatus: z.enum(["accepted"]).nullable()
});

const mailingListSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  isPublic: z.boolean()
});

const emailSchema = z.strictObject({
  id: z.string().min(1),
  emailMessageId: z.string().min(1),
  subject: z.string()
});

const contactEventSchema = (eventName: string) =>
  baseWebhookSchema.extend({
    eventName: z.literal(eventName),
    contactIdentity: contactIdentitySchema
  });

const emailEventSchema = (eventName: string) =>
  baseWebhookSchema.extend({
    eventName: z.literal(eventName),
    sourceType: z.enum(["campaign", "loop", "transactional"]),
    campaignId: z.string().min(1).optional(),
    loopId: z.string().min(1).optional(),
    transactionalId: z.string().min(1).optional(),
    email: emailSchema,
    contactIdentity: contactIdentitySchema
  });

/** Validates the shared fields of any Loops webhook event. */
export const loopsWebhookEnvelopeSchema = baseWebhookSchema;

/** Validates every documented Loops webhook event shape. */
export const loopsWebhookSchema = z.discriminatedUnion("eventName", [
  baseWebhookSchema.extend({
    eventName: z.literal("contact.created"),
    contactIdentity: contactIdentitySchema,
    contact: contactSchema
  }),
  contactEventSchema("contact.unsubscribed"),
  contactEventSchema("contact.deleted"),
  contactEventSchema("contact.mailingList.subscribed").extend({ mailingList: mailingListSchema }),
  contactEventSchema("contact.mailingList.unsubscribed").extend({ mailingList: mailingListSchema }),
  baseWebhookSchema.extend({
    eventName: z.literal("campaign.email.sent"),
    contactIdentity: contactIdentitySchema,
    campaignId: z.string().min(1),
    campaignName: z.string(),
    email: emailSchema,
    mailingLists: z.array(mailingListSchema).optional()
  }),
  baseWebhookSchema.extend({
    eventName: z.literal("loop.email.sent"),
    contactIdentity: contactIdentitySchema,
    loopId: z.string().min(1),
    loopName: z.string(),
    email: emailSchema,
    mailingLists: z.array(mailingListSchema).optional()
  }),
  baseWebhookSchema.extend({
    eventName: z.literal("transactional.email.sent"),
    contactIdentity: contactIdentitySchema,
    transactionalId: z.string().min(1),
    email: emailSchema
  }),
  ...[
    "email.delivered",
    "email.softBounced",
    "email.hardBounced",
    "email.opened",
    "email.clicked",
    "email.unsubscribed",
    "email.resubscribed",
    "email.spamReported"
  ].map((eventName) => emailEventSchema(eventName)),
  baseWebhookSchema.extend({
    eventName: z.literal("testing.testEvent"),
    message: z.string()
  })
]);

/** Alias emphasizing that this is the event union rather than just its envelope. */
export const loopsWebhookEventSchema = loopsWebhookSchema;

/** A validated Loops webhook event. */
export type LoopsWebhook = z.infer<typeof loopsWebhookSchema>;
/** A validated generic Loops webhook envelope. */
export type LoopsWebhookEnvelope = z.infer<typeof loopsWebhookEnvelopeSchema>;
