import { z } from "zod";
import COMMON from "./data/common-passwords.json";

export const MIN_PASSWORD_LENGTH = 12;
const common = new Set<string>(COMMON as string[]);

/**
 * Rejects passwords that are, or are trivially derived from, one of the 10,000 most common
 * passwords (SecLists). "Derived" = lowercased with leading/trailing digits & symbols removed,
 * or a common password repeated (e.g. "dragondragon").
 */
export function isCommonPassword(pw: string): boolean {
  const lower = pw.toLowerCase();
  if (common.has(lower)) return true;
  const core = lower.replace(/^[\d\W_]+|[\d\W_]+$/g, "");
  if (core.length > 0 && common.has(core)) return true;
  for (let n = 1; n <= lower.length / 2; n++) {
    if (lower.length % n === 0 && lower.slice(0, n).repeat(lower.length / n) === lower) {
      if (n < 4 || common.has(lower.slice(0, n))) return true;
    }
  }
  return false;
}

export function passwordProblem(pw: string, username?: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (pw.length > 128) return "Use at most 128 characters.";
  if (isCommonPassword(pw)) return "That password is too common (it's in, or built from, the 10,000 most-used passwords).";
  if (username && pw.toLowerCase().includes(username.toLowerCase())) return "Don't include your username in your password.";
  return null;
}

export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "3–20 characters: lowercase letters, digits, underscore");

export const PasswordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(128);
