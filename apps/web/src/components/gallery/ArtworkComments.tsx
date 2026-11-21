
"use client";

import { useState } from "react";

type Comment = {
  id: number;
  author: string;
  text: string;
};

export default function ArtworkComments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState("");

  function addComment() {
    const text = message.trim();

    if (!text) return;

    const newComment: Comment = {
      id: Date.now(),
      author: "You",
      text: text,
    };

    setComments((previous) => [...previous, newComment]);
    setMessage("");
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-700 p-5">
      <h2 className="text-xl font-semibold">
        Comments ({comments.length})
      </h2>

      {comments.length === 0 && (
        <p className="text-sm text-zinc-400">
          No comments yet. Be the first!
        </p>
      )}

      {comments.map((comment) => (
        <div key={comment.id} className="rounded-lg bg-zinc-900 p-3">
          <p className="font-semibold">{comment.author}</p>
          <p className="text-sm text-zinc-300">{comment.text}</p>
        </div>
      ))}

      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Write a comment..."
        maxLength={500}
        className="w-full rounded-lg border border-zinc-600 bg-transparent p-3"
      />

      <button
        type="button"
        onClick={addComment}
        disabled={!message.trim()}
        className="rounded-lg bg-white px-4 py-2 text-black disabled:opacity-50"
      >
        Post Comment
      </button>
    </section>
  );
}
