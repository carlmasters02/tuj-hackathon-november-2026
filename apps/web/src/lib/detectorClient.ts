const API_BASE =
  process.env.NEXT_PUBLIC_DETECTOR_API_URL || "http://localhost:8000";

export async function analyzeArtUpload(file: File, userId: string = "demo_user") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", userId);

  const res = await fetch(`${API_BASE}/analyze-upload`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export async function analyzeWritingText(
  text: string,
  externalPastes: number = 0,
  userId: string = "demo_user"
) {
  const res = await fetch(`${API_BASE}/analyze-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      user_id: userId,
      external_pastes: externalPastes,
    }),
  });
  return res.json();
}

export async function recordTutoringEvent(
  eventType: "tab_switch" | "paste_detected" | "completed_clean",
  subject: "math_tutoring" | "code_dojo",
  userId: string = "demo_user"
) {
  const res = await fetch(`${API_BASE}/tutoring/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      event_type: eventType,
      subject,
    }),
  });
  return res.json();
}

export async function getTutoringAndRelianceStatus(userId: string = "demo_user") {
  const res = await fetch(`${API_BASE}/tutoring/status/${userId}`);
  return res.json();
}