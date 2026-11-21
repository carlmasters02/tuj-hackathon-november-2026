import { canonicalJSON } from "./canonicalJson";
import { sha256Hex } from "./hash";

/** Stable content revision shared by the browser recorder and the server's optimistic CAS. */
export function contentFingerprint(content: unknown): string {
  return sha256Hex(canonicalJSON(content));
}
