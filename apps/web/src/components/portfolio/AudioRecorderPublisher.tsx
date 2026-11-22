"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AudioRecorder } from "./AudioRecorder";

export function AudioRecorderPublisher() {
  const router = useRouter();
  const [title, setTitle] = useState("Microphone recording");
  const [description, setDescription] = useState("");
  const [publish, setPublish] = useState(true);

  const upload = async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("title", title.trim() || "Microphone recording");
    if (description.trim()) form.set("description", description.trim());
    form.set("publish", String(publish));
    const response = await fetch("/api/gallery/upload", { method: "POST", body: form, credentials: "same-origin" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.id) throw new Error(result.error || "Upload failed");
    router.push(`/portfolio/work/${result.id}`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="card space-y-4 p-5 text-left">
        <div>
          <label className="label" htmlFor="recording-title">Title</label>
          <input id="recording-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="recording-description">Description (optional)</label>
          <textarea id="recording-description" className="input" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="What should listeners know about this take?" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} className="h-4 w-4 accent-[var(--color-fg)]" />
          Publish to the Music portfolio
        </label>
        <p className="text-xs leading-relaxed text-fg-faint">Turn this off to save the recording only to your own portfolio. Recordings are uploaded work and never receive a creation-record seal.</p>
      </div>
      <AudioRecorder onPublish={upload} />
    </div>
  );
}
