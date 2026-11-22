/** Tiny fetch helpers for client components. Same-origin only; cookies carry the session. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public data: any) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? fallbackMessage(res.status), data);
  return data as T;
}

export async function postJson<T = any>(url: string, body: unknown, method = "POST", keepalive = false): Promise<T> {
  return handle<T>(await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", keepalive }));
}

export async function getJson<T = any>(url: string): Promise<T> {
  return handle<T>(await fetch(url, { credentials: "same-origin" }));
}

/** Used only when the server didn't send its own message (an outage page, a lost connection…). */
function fallbackMessage(status: number): string {
  if (status === 401) return "Please log in to continue.";
  if (status === 404) return "We couldn't find that. It may have been deleted.";
  if (status === 413) return "That's too much to send at once. Try a smaller file or shorter text.";
  if (status === 429) return "You're going a little fast. Wait a moment and try again.";
  if (status >= 500) return "Humagination couldn't be reached just now. Check your connection and try again in a moment.";
  return "Something went wrong. Please try again.";
}
