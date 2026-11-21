/** A relative, same-site path only (blocks "//evil.com", "https://…" and other open redirects). */
export function safeNext(next: string | undefined | null): string {
  return next && /^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/.test(next) ? next : "/dashboard";
}
