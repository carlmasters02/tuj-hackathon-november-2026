from fastapi import FastAPI, UploadFile, File, Form # pyright: ignore[reportMissingImports]
from fastapi.middleware.cors import CORSMiddleware # pyright: ignore[reportMissingImports]
from PIL import Image, ExifTags # pyright: ignore[reportMissingImports]
import numpy as np # pyright: ignore[reportMissingImports]
import io

app = FastAPI(title="Humanigation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

active_sessions = {}

@app.post("/tracker/heartbeat")
def tracker_heartbeat(payload: dict):
    user_id = payload.get("user_id", "demo_user")
    active_sessions[user_id] = {
        "ai_seconds": payload.get("ai_seconds", 0),
        "ai_apps_opened": payload.get("ai_apps_opened", []),
        "ai_detected": payload.get("ai_detected", False)
    }
    return {"status": "recorded", "session": active_sessions[user_id]}

@app.get("/tracker/status/{user_id}")
def get_tracker_status(user_id: str):
    return active_sessions.get(user_id, {
        "ai_seconds": 0,
        "ai_apps_opened": [],
        "ai_detected": False
    })

@app.post("/analyze-upload")
async def analyze_upload(
    file: UploadFile = File(...),
    user_id: str = Form("demo_user")
):
    contents = await file.read()
    img = Image.open(io.BytesIO(contents))
    
    reasons = []
    human_score = 100

    # Layer 1: Behavioral Tracker Check
    session = active_sessions.get(user_id, {})
    if session.get("ai_detected"):
        human_score -= 60
        apps = ", ".join(session.get("ai_apps_opened", ["AI Tool"]))
        reasons.append(f"Behavioral Tracker caught active AI usage ({apps}) for {session.get('ai_seconds')}s.")

    # Layer 2: Metadata & EXIF Forensics
    raw_info = str(img.info).lower()
    exif_data = ""
    if hasattr(img, "_getexif") and img._getexif():
        for tag, val in img._getexif().items():
            tag_name = ExifTags.TAGS.get(tag, str(tag))
            exif_data += f"{tag_name}:{val} ".lower()

    full_metadata = raw_info + " " + exif_data

    ai_tags = ["midjourney", "dall-e", "stable diffusion", "comfyui", "automatic1111", "novelai", "firefly", "c2pa"]
    human_tools = ["photoshop", "procreate", "clip studio", "krita", "illustrator", "ibispaint", "medibang"]

    found_ai_tags = [t for t in ai_tags if t in full_metadata]
    found_human_tools = [t for t in human_tools if t in full_metadata]

    if found_ai_tags:
        human_score -= 80
        reasons.append(f"AI Generator signature found in file metadata: {', '.join(found_ai_tags)}.")
    elif found_human_tools:
        reasons.append(f"Verified human art software metadata: {', '.join(found_human_tools)}.")
    else:
        human_score -= 10
        reasons.append("No drawing software metadata found (metadata stripped or web-saved).")

    # Layer 3: Pixel Gradient Check
    rgb_img = img.convert("RGB").resize((256, 256))
    arr = np.array(rgb_img, dtype=np.float32)
    dx = np.abs(arr[:, 1:, :] - arr[:, :-1, :]).mean()
    dy = np.abs(arr[1:, :, :] - arr[:-1, :, :]).mean()
    edge_variance = round(float((dx + dy) / 2), 2)

    if edge_variance < 4.5:
        human_score -= 15
        reasons.append(f"Unusually uniform pixel gradient smoothness detected (score: {edge_variance}).")

    human_score = max(0, min(100, human_score))
    is_verified_human = human_score >= 70

    return {
        "user_id": user_id,
        "filename": file.filename,
        "is_verified_human": is_verified_human,
        "human_confidence_score": human_score,
        "verdict": "100% Human Verified" if is_verified_human else "Blocked: Suspected AI Content",
        "detection_breakdown": reasons
    }

@app.post("/tracker/reset/{user_id}")
def reset_tracker(user_id: str):
    active_sessions[user_id] = {"ai_seconds": 0, "ai_apps_opened": [], "ai_detected": False}
    return {"status": "reset", "user_id": user_id}