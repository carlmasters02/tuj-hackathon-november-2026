"use client";
import { useEffect } from "react";

export function useTutoringDetector(
  subject: "math_tutoring" | "code_dojo",
  userId: string = "demo_user"
) {
  useEffect(() => {
    const API_BASE =
      process.env.NEXT_PUBLIC_DETECTOR_API_URL || "http://localhost:8000";

    const sendEvent = (eventType: "tab_switch" | "paste_detected") => {
      fetch(`${API_BASE}/tutoring/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          event_type: eventType,
          subject,
        }),
      }).catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.hidden) sendEvent("tab_switch");
    };
    const onPaste = () => sendEvent("paste_detected");

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("paste", onPaste);
    };
  }, [subject, userId]);
}