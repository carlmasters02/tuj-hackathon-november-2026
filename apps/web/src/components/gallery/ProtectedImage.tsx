"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Draws the (viewer-watermarked) preview into a <canvas> instead of an <img>: no "Save image as",
 * no drag-out, no text selection. These are deterrents only — a screenshot still works, which is
 * why every served copy carries the viewer's username.
 */
export function ProtectedImage({ src, width, height, alt }: { src: string; width: number; height: number; alt: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "expired" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src, { credentials: "same-origin", cache: "no-store" });
        if (res.status === 410) return setState("expired");
        if (!res.ok) return setState("error");
        const bmp = await createImageBitmap(await res.blob());
        if (cancelled || !ref.current) return;
        const c = ref.current;
        c.width = bmp.width;
        c.height = bmp.height;
        c.getContext("2d")!.drawImage(bmp, 0, 0);
        bmp.close();
        setState("ok");
      } catch {
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="hm-protected relative overflow-hidden rounded-lg bg-muted" style={{ aspectRatio: `${width} / ${height}` }} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
      <canvas ref={ref} role="img" aria-label={alt} className="h-full w-full object-contain" draggable={false} />
      {state !== "ok" && (
        <div className="absolute inset-0 grid place-items-center text-xs text-fg-faint">
          {state === "loading" ? "Loading…" : state === "expired" ? <button className="link" onClick={() => location.reload()}>Link expired — reload</button> : "Couldn't load image"}
        </div>
      )}
    </div>
  );
}
