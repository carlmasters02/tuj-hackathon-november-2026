import { z } from "zod";
import { isValidDomain } from "./aiDomains";

/** Exactly what the extension sends: per-day, per-domain totals. No URLs, titles or content. */
export const IngestSchema = z
  .object({
    days: z
      .array(
        z
          .object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            domain: z.string().toLowerCase().max(253).refine(isValidDomain, "invalid domain"),
            seconds: z.number().int().min(0).max(86400),
          })
          .strict(),
      )
      .max(500),
    thinkFirst: z
      .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), redirected: z.number().int().min(0).max(1000), bypassed: z.number().int().min(0).max(1000) }).strict())
      .max(31)
      .default([]),
  })
  .strict();

export type IngestPayload = z.infer<typeof IngestSchema>;
export const INGEST_MAX_AGE_DAYS = 14;
