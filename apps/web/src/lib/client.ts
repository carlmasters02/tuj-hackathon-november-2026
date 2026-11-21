/** Tiny fetch helpers for client components. Same-origin only; cookies carry the session. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public data: any) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data);
  return data as T;
}

export async function postJson<T = any>(url: string, body: unknown, method = "POST", keepalive = false): Promise<T> {
  return handle<T>(await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", keepalive }));
}

export async function getJson<T = any>(url: string): Promise<T> {
  return handle<T>(await fetch(url, { credentials: "same-origin" }));
}
