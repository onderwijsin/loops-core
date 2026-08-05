import { describe, expect, it } from "vitest";
import { loopsWebhookSchema, verifyLoopsWebhookSignature } from "../src/index";

describe("webhooks", () => {
  it("verifies valid, invalid-body, and malformed-timestamp signatures", async () => {
    const secretBytes = "a signing secret";
    const secret = `whsec_${btoa(secretBytes)}`;
    const body = '{"eventName":"campaign.email.sent"}';
    const timestamp = "1000";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secretBytes),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`event-1.${timestamp}.${body}`)
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(signed)));
    const options = { timestampToleranceSeconds: 10, now: 1_000_000 };
    await expect(
      verifyLoopsWebhookSignature(
        body,
        { id: "event-1", timestamp, signature: `v1,bad v1,${signature}` },
        secret,
        options
      )
    ).resolves.toBe(true);
    await expect(
      verifyLoopsWebhookSignature(
        `${body}x`,
        { id: "event-1", timestamp, signature: `v1,${signature}` },
        secret,
        options
      )
    ).resolves.toBe(false);
    await expect(
      verifyLoopsWebhookSignature(
        body,
        { id: "event-1", timestamp: "bad", signature: `v1,${signature}` },
        secret,
        options
      )
    ).resolves.toBe(false);
  });

  it("accepts representative webhook event families and rejects inconsistent unions", () => {
    const shared = { eventTime: 1, webhookSchemaVersion: "1.0.0" as const };
    const identity = { id: "contact-1", email: "test@example.com", userId: null };
    const email = { id: "email-1", emailMessageId: "message-1", subject: "Subject" };
    const campaignEvent = {
      ...shared,
      eventName: "campaign.email.sent",
      contactIdentity: identity,
      campaignId: "campaign-1",
      campaignName: "Campaign",
      email,
      mailingLists: []
    };
    const openedEvent = {
      ...shared,
      eventName: "email.opened",
      sourceType: "campaign",
      campaignId: "campaign-1",
      contactIdentity: identity,
      email
    };
    expect(loopsWebhookSchema.safeParse(campaignEvent).success).toBe(true);
    expect(loopsWebhookSchema.safeParse(openedEvent).success).toBe(true);
    expect(
      loopsWebhookSchema.safeParse({
        ...openedEvent,
        sourceType: "transactional",
        transactionalId: "transactional-1"
      }).success
    ).toBe(false);
  });
});
