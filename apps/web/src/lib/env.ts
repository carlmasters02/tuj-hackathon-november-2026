import "server-only";
import { z } from "zod";

const b64key = (bytes: number) =>
  z
    .string()
    .min(1)
    .refine((s) => Buffer.from(s, "base64").length === bytes, `must be ${bytes} bytes, base64-encoded (run pnpm gen:keys)`);

const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  HM_MASTER_KEY: b64key(32),
  HM_SIGNING_KEY: b64key(32),
  HM_MEDIA_HMAC_KEY: b64key(32),
  HM_EXT_TOKEN_PEPPER: b64key(32),
  HM_WATERMARK_KEY: b64key(32),
  CODE_RUNNER: z.enum(["piston", "judge0"]).default("piston"),
  PISTON_URL: z.string().url().default("http://127.0.0.1:2000"),
  JUDGE0_URL: z.string().url().optional(),
  JUDGE0_AUTH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof ServerEnv>;
let cached: Env | null = null;

/** Validated server environment. Throws a readable error listing every missing/invalid variable. */
export function env(): Env {
  if (cached) return cached;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Humagination is missing configuration (see .env.example):\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const keyBytes = (name: "HM_MASTER_KEY" | "HM_SIGNING_KEY" | "HM_MEDIA_HMAC_KEY" | "HM_EXT_TOKEN_PEPPER" | "HM_WATERMARK_KEY") =>
  new Uint8Array(Buffer.from(env()[name], "base64"));
