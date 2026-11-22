"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_BYTES, MAX_SECONDS, micErrorMessage, mmss, pickMimeType, toWav } from "@/lib/audio";

type RecorderState = "idle" | "starting" | "recording" | "processing" | "done";

export function AudioRecorder({ onPublish }: { onPublish?: (file: File) => Promise<void> }) {
  const [state, setState] = useState<RecorderState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const starting = useRef(false);
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
    const pending = chunks.current;
    chunks.current = [];
    rec.current = null;
    release();
    if (!alive.current) return;
    setState("processing");
    try {
      const wav = await toWav(new Blob(pending, { type }));
      if (wav.size > MAX_BYTES) throw new Error("wav_too_large");
      const f = new File([wav], `recording-${Date.now()}.wav`, { type: "audio/wav" });
      if (!alive.current) return;
      setFile(f);
      setUrl(URL.createObjectURL(f));
      setState("done");
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error && e.message === "wav_too_large" ? "The converted WAV is larger than 25 MB. Try a shorter recording." : "Couldn’t process that recording. Try a shorter one or a different browser.");
      setState("idle");
    }
  }

  async function start() {
    if (starting.current || rec.current) return;
    starting.current = true;
    setError(null);
    setState("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setError("This browser can’t record audio, or the page isn’t on HTTPS. Try a recent Chrome, Edge, Safari or Firefox.");
        setState("idle");
        return;
      }
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const mime = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      rec.current = r;
      chunks.current = [];
      let bytes = 0;
      let failed = false;
      r.ondataavailable = (e) => {
        if (!e.data.size) return;
        chunks.current.push(e.data);
        bytes += e.data.size;
        if (bytes > MAX_BYTES && r.state === "recording") r.stop();
      };
      r.onerror = () => {
        failed = true;
        release();
        rec.current = null;
        chunks.current = [];
        if (alive.current) {
          setError("The recorder stopped unexpectedly. Please try again.");
          setState("idle");
        }
      };
      r.onstop = () => { if (!failed) void finish(r.mimeType || "audio/webm"); };
      r.start(1000);
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
      rec.current = null;
      chunks.current = [];
      if (alive.current) {
        setError(micErrorMessage(e));
        setState("idle");
      }
    } finally {
      starting.current = false;
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
      <p className="text-5xl font-extrabold tabular-nums" aria-label={`Recording duration ${mmss(secs)}`}>{mmss(secs)}</p>
      <p className="sr-only" role="status" aria-live="polite">
        {state === "starting" ? "Requesting microphone access" : state === "recording" ? "Recording in progress" : state === "processing" ? "Preparing the recording" : state === "done" ? "Recording ready" : "Recorder ready"}
      </p>

      {state === "idle" && (
        <>
          <button className="btn btn-primary px-6 py-3" onClick={start}>Start recording</button>
          <p className="text-sm text-fg-dim">Up to {MAX_SECONDS / 60} minutes. Your browser will ask for microphone access.</p>
        </>
      )}
      {state === "starting" && <p className="text-sm text-fg-dim" role="status">Requesting microphone access…</p>}
      {state === "recording" && (
        <>
          <p className="text-sm text-redpen">Recording…</p>
          <button className="btn px-6 py-3" onClick={stop}>Stop</button>
        </>
      )}
      {state === "processing" && <p className="text-sm text-fg-dim" role="status">Getting your recording ready…</p>}
      {state === "done" && url && (
        <>
          <audio controls src={url} className="mx-auto w-full" aria-label="Recording preview" />
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
