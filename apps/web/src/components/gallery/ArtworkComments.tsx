"use client";
// Artwork comments — original idea and UI by dasbristy997-ux; now persisted in Supabase.
import { useState } from "react";
import { postJson, ApiError } from "@/lib/client";

export interface CommentView {
  id: number;
  author: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export default function ArtworkComments({ workId, initial, canModerate }: { workId: string; initial: CommentView[]; canModerate: boolean }) {
  const [comments, setComments] = useState<CommentView[]>(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addComment() {
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const { comment } = await postJson<{ comment: CommentView }>(`/api/gallery/${workId}/comments`, { body: text });
      setComments((previous) => [...previous, comment]);
      setMessage("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post your comment");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    try {
      await postJson(`/api/gallery/${workId}/comments/${id}`, {}, "DELETE");
      setComments((previous) => previous.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't delete that comment");
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-xl font-extrabold">Comments ({comments.length})</h2>

      {comments.length === 0 && <p className="text-sm text-fg-dim">No comments yet. Be the first!</p>}

      <ul className="space-y-3">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded-xl border border-line bg-canvas/60 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold">@{comment.author}</p>
              <span className="text-xs text-fg-faint">{new Date(comment.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg-dim">{comment.body}</p>
            {(comment.mine || canModerate) && (
              <button type="button" className="mt-1 text-xs text-fg-faint underline-offset-2 hover:text-redpen hover:underline" onClick={() => remove(comment.id)}>
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      <label className="sr-only" htmlFor={`comment-${workId}`}>Write a comment</label>
      <textarea
        id={`comment-${workId}`}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Write a comment..."
        maxLength={500}
        rows={3}
        className="input"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-fg-faint">{message.length}/500</span>
        <button type="button" onClick={addComment} disabled={!message.trim() || busy} className="btn btn-primary">
          {busy ? "Posting…" : "Post Comment"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-redpen">{error}</p>}
    </section>
  );
}
