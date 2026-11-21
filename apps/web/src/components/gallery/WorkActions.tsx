"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson, ApiError } from "@/lib/client";

export function LikeButton({ id, liked: initial, count: initialCount }: { id: string; liked: boolean; count: number }) {
  const [liked, setLiked] = useState(initial);
  const [count, setCount] = useState(initialCount);
  return (
    <button
      className={`btn ${liked ? "border-redpen/60 text-redpen" : ""}`}
      onClick={async () => {
        const next = !liked;
        setLiked(next);
        setCount((c) => c + (next ? 1 : -1));
        try {
          await postJson(`/api/gallery/${id}/like`, {}, next ? "POST" : "DELETE");
        } catch {
          setLiked(!next);
          setCount((c) => c + (next ? -1 : 1));
        }
      }}
    >
      {liked ? "♥" : "♡"} {count}
    </button>
  );
}

export function ReportButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("stolen");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <span className="text-xs text-fg-faint">Reported — thank you.</span>;
  if (!open) return <button className="btn btn-ghost text-fg-faint" onClick={() => setOpen(true)}>Report</button>;
  return (
    <div className="card w-full space-y-2 p-3">
      <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="stolen">This is someone else&apos;s work</option>
        <option value="ai_generated">Looks AI-generated</option>
        <option value="offensive">Offensive</option>
        <option value="spam">Spam</option>
        <option value="other">Other</option>
      </select>
      <textarea className="input" rows={2} maxLength={1000} placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn btn-danger" onClick={async () => { await postJson(`/api/gallery/${id}/report`, { reason, details: details || undefined }); setDone(true); }}>Send report</button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export function OwnerControls({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [pub, setPub] = useState(published);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn" onClick={async () => { await postJson(`/api/gallery/${id}`, { published: !pub }, "PATCH"); setPub(!pub); router.refresh(); }}>
        {pub ? "Unpublish" : "Publish"}
      </button>
      {!confirm ? (
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>Delete</button>
      ) : (
        <>
          <span className="text-xs text-fg-dim">Deletes the original and preview permanently.</span>
          <button
            className="btn btn-danger"
            onClick={async () => {
              try {
                await postJson(`/api/gallery/${id}`, {}, "DELETE");
                router.push("/portfolio");
              } catch (e) {
                setErr(e instanceof ApiError ? e.message : "Failed");
              }
            }}
          >
            Confirm delete
          </button>
          <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
        </>
      )}
      {err && <span className="text-sm text-redpen">{err}</span>}
    </div>
  );
}

export function FollowButton({ username, following: initial }: { username: string; following: boolean }) {
  const [following, setFollowing] = useState(initial);
  return (
    <button className={`btn ${following ? "" : "btn-primary"}`} onClick={async () => { await postJson("/api/follow", { username, follow: !following }); setFollowing(!following); }}>
      {following ? "Following" : "Follow"}
    </button>
  );
}
