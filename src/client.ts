import { ofetch } from "ofetch";
import type { z } from "zod";
import {
  loopsComponentSchema,
  loopsEmailMessageSchema,
  type LoopsComponent,
  type LoopsEmailMessage
} from "./schemas";

const apiBaseUrl = "https://app.loops.so/api/v1";

/**
 * Creates a runtime-neutral Loops Email Campaign API client.
 *
 * @param apiKey - Loops API key sent as a bearer token.
 * @returns Methods for retrieving validated email messages and reusable components.
 *
 * @example
 * const client = createLoopsEmailCampaignClient("loops-api-key");
 * const message = await client.getEmailMessage("message-id");
 *
 * @throws {Error} When a Loops request is unsuccessful or its response violates the API schema.
 */
export function createLoopsEmailCampaignClient(apiKey: string): {
  getEmailMessage(emailMessageId: string): Promise<LoopsEmailMessage>;
  getComponent(componentId: string): Promise<LoopsComponent>;
} {
  return {
    getEmailMessage: (emailMessageId) =>
      getResponse(
        `/email-messages/${encodeURIComponent(emailMessageId)}`,
        loopsEmailMessageSchema,
        apiKey
      ),
    getComponent: (componentId) =>
      getResponse(`/components/${encodeURIComponent(componentId)}`, loopsComponentSchema, apiKey)
  };
}

/**
 * Fetches and validates an external Loops API response at its boundary.
 *
 * @template T - Validated response type returned by the supplied schema.
 * @param path - URI-encoded API path below the Loops API base URL.
 * @param schema - Zod schema that validates and normalizes the response body.
 * @param apiKey - Loops API key sent as a bearer token.
 * @returns The validated API response.
 * @throws {Error} When the request fails, Loops returns a non-success status, or schema validation fails.
 */
async function getResponse<T>(path: string, schema: z.ZodType<T>, apiKey: string): Promise<T> {
  const response = await ofetch<unknown>(path, {
    baseURL: apiBaseUrl,
    headers: { Authorization: `Bearer ${apiKey}` },
    retry: 0
  });
  const parsed = schema.safeParse(response);
  if (!parsed.success) throw new Error("Loops API returned an invalid response");
  return parsed.data;
}
