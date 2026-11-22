export type ArtSource = "studio" | "upload";

export type ArtVerificationStatus =
  | "studio_verified"
  | "human_verified"
  | "ai_suspected"
  | "scan_unavailable";

export interface ImageDetectionResponse {
  verdict: "human_verified" | "ai_suspected";
  aiProbability: number;
  threshold: number;
  rawLabel: string;
  model: string;
}

export interface ArtVerificationResult {
  status: ArtVerificationStatus;
  aiProbability: number | null;
  label: string;
  warningMessage?: string;
}

export function getStudioArtVerification(): ArtVerificationResult {
  return {
    status: "studio_verified",
    aiProbability: 0,
    label: "Studio verified",
  };
}

export async function scanUploadedArt(
  file: File,
  endpoint = "http://localhost:8000/detect/image",
  timeoutMs = 12000
): Promise<ArtVerificationResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        status: "scan_unavailable",
        aiProbability: null,
        label: "Scan unavailable",
        warningMessage: "Couldn't complete AI check right now. You can still post.",
      };
    }

    const data = (await res.json()) as ImageDetectionResponse;

    if (data.verdict === "ai_suspected") {
      return {
        status: "ai_suspected",
        aiProbability: data.aiProbability,
        label: "AI suspected",
        warningMessage: `Flagged as likely AI (${Math.round(
          data.aiProbability * 100
        )}%). Please confirm if this is human-made.`,
      };
    }

    return {
      status: "human_verified",
      aiProbability: data.aiProbability,
      label: "AI check passed",
    };
  } catch {
    return {
      status: "scan_unavailable",
      aiProbability: null,
      label: "Scan unavailable",
      warningMessage: "AI detector timed out or is offline. You can still post.",
    };
  } finally {
    clearTimeout(timer);
  }

  
}