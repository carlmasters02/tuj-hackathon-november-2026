"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_BYTES, MAX_SECONDS, micErrorMessage, mmss, pickMimeType, toWav } from "@/lib/audio";

export function AudioRecorder({ onPublish }: { onPublish?: (file: File) => Promise<void> }) {
  const [state, setState] = useState<"idle" | "recording" | "processing" | "done">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);

  const release = () => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      release();
      if (rec.current?.state === "recording") rec.current.stop();
    };
  }, []);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function finish(type: string) {
    release();
    if (!alive.current) return;
    setState("processing");
    try {
      const wav = await toWav(new Blob(chunks.current, { type }));
      if (wav.size > MAX_BYTES) throw new Error("too big");
      const f = new File([wav], `recording-${Date.now()}.wav`, { type: "audio/wav" });
      if (!alive.current) return;
      setFile(f);
      setUrl(URL.createObjectURL(f));
      setState("done");
    } catch {
      if (!alive.current) return;
      setError("Couldn’t process that recording. Try a shorter one.");
      setState("idle");
    }
  }

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can’t record audio, or the page isn’t on HTTPS. Try a recent Chrome, Edge, Safari or Firefox.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      stream.current = s;
      const mime = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      let bytes = 0;
      r.ondataavailable = (e) => {
        if (!e.data.size) return;
        chunks.current.push(e.data);
        bytes += e.data.size;
        if (bytes > MAX_BYTES && r.state === "recording") r.stop();
      };
      r.onstop = () => void finish(r.mimeType || "audio/webm");
      r.start(1000);
      rec.current = r;
      const t0 = Date.now();
      setSecs(0);
      setState("recording");
      timer.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - t0) / 1000);
        setSecs(elapsed);
        if (elapsed >= MAX_SECONDS && r.state === "recording") r.stop();
      }, 500);
    } catch (e) {
      release();
      setError(micErrorMessage(e));
    }
  }

  function stop() {
    window.clearInterval(timer.current);
    if (rec.current?.state === "recording") rec.current.stop();
  }

  function again() {
    setUrl(null);
    setFile(null);
    setSecs(0);
    setState("idle");
  }

  async function publish() {
    if (!file || !onPublish) return;
    setPublishing(true);
    setError(null);
    try {
      await onPublish(file);
    } catch {
      setError("Couldn’t publish the recording. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="card mx-auto max-w-xl space-y-5 p-6 text-center">
      <p className="text-5xl font-extrabold tabular-nums">{mmss(secs)}</p>

      {state === "idle" && (
        <>
          <button className="btn btn-primary px-6 py-3" onClick={start}>Start recording</button>
          <p className="text-sm text-fg-dim">Up to {MAX_SECONDS / 60} minutes. Your browser will ask for microphone access.</p>
        </>
      )}
      {state === "recording" && (
        <>
          <p className="text-sm text-redpen">Recording…</p>
          <button className="btn px-6 py-3" onClick={stop}>Stop</button>
        </>
      )}
      {state === "processing" && <p className="text-sm text-fg-dim">Getting your recording ready…</p>}
      {state === "done" && url && (
        <>
          <audio controls src={url} className="mx-auto w-full" />
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn" onClick={again}>Record again</button>
            <a className="btn" href={url} download={file?.name}>Download</a>
            {onPublish && <button className="btn btn-primary" onClick={publish} disabled={publishing}>{publishing ? "Publishing…" : "Publish"}</button>}
          </div>
        </>
      )}

      {error && <p className="text-sm text-redpen" role="alert">{error}</p>}
      <p className="text-xs text-fg-faint">Recorded live and shared as an upload, with no creation-record seal. Nothing leaves this tab until you publish or download it.</p>
    </div>
  );
}
