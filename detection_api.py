from fastapi import FastAPI, UploadFile, File, Form # pyright: ignore[reportMissingImports]
from fastapi.middleware.cors import CORSMiddleware # pyright: ignore[reportMissingImports]
from PIL import Image, ExifTags # pyright: ignore[reportMissingImports]
import numpy as np # pyright: ignore[reportMissingImports]
import io
import re

app = FastAPI(title="Humanigation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

active_sessions = {}

def get_session(user_id: str):
    return active_sessions.setdefault(user_id, {
        "ai_seconds": 0,
        "human_seconds": 60,  # Starts at 1 human minute to match dashboard
        "human_points": 30.0,
        "ai_apps_opened": [],
        "ai_detected": False,
        "tab_switches": 0,
        "tutoring_events": []
    })

# ==========================================
# 1. BACKGROUND TRACKER & STATUS
# ==========================================
@app.post("/tracker/heartbeat")
def tracker_heartbeat(payload: dict):
    user_id = payload.get("user_id", "demo_user")
    session = get_session(user_id)
    session["ai_seconds"] = payload.get("ai_seconds", session["ai_seconds"])
    session["ai_apps_opened"] = payload.get("ai_apps_opened", session["ai_apps_opened"])
    session["ai_detected"] = payload.get("ai_detected", session["ai_detected"])
    return {"status": "recorded", "session": session}

@app.get("/tracker/status/{user_id}")
def get_tracker_status(user_id: str):
    return get_session(user_id)

# ==========================================
# 2. PROTECTED GALLERY (ART UPLOAD SCANNER)
# ==========================================
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
    session = get_session(user_id)
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

    if is_verified_human:
        session["human_seconds"] += 120
        session["human_points"] += 15.0

    return {
        "user_id": user_id,
        "filename": file.filename,
        "is_verified_human": is_verified_human,
        "human_confidence_score": human_score,
        "verdict": "100% Human Verified" if is_verified_human else "Blocked: Suspected AI Content",
        "detection_breakdown": reasons
    }

# ==========================================
# 3. TUTORING SECTION (MATH + CODE DOJO)
# ==========================================
@app.post("/tutoring/event")
def tutoring_event(payload: dict):
    """
    Tracks tab switches and pastes during Math Tutoring & Code Dojo.
    event_type: 'tab_switch' | 'paste_detected' | 'completed_clean'
    """
    user_id = payload.get("user_id", "demo_user")
    event_type = payload.get("event_type", "tab_switch")
    subject = payload.get("subject", "math_tutoring")
    session = get_session(user_id)

    if event_type == "tab_switch":
        session["tab_switches"] += 1
        session["ai_seconds"] += 30
        session["ai_detected"] = True
        session["tutoring_events"].append(f"[{subject}] Left website/tab (+30s AI reliance)")
    elif event_type == "paste_detected":
        session["ai_seconds"] += 120
        session["ai_detected"] = True
        session["tutoring_events"].append(f"[{subject}] External paste detected (+2m AI reliance)")
    elif event_type == "completed_clean":
        session["human_seconds"] += 120
        ai_mins = session["ai_seconds"] / 60
        human_mins = session["human_seconds"] / 60
        reliance_ratio = ai_mins / (ai_mins + human_mins)
        earned_points = round(15.0 * (1 - reliance_ratio), 1)
        session["human_points"] += earned_points

    return get_tutoring_status(user_id)

@app.get("/tutoring/status/{user_id}")
def get_tutoring_status(user_id: str):
    session = get_session(user_id)
    ai_mins = round(session["ai_seconds"] / 60, 2)
    human_mins = max(0.1, round(session["human_seconds"] / 60, 2))
    reliance_score = round((ai_mins / (ai_mins + human_mins)) * 100)

    return {
        "user_id": user_id,
        "reliance_score": reliance_score,
        "tab_switches": session["tab_switches"],
        "ai_seconds": session["ai_seconds"],
        "human_minutes": round(human_mins),
        "ai_minutes": round(ai_mins),
        "human_points": round(session["human_points"], 1),
        "tutoring_events": session["tutoring_events"][-5:]
    }

# ==========================================
# 4. WRITTEN HERE (GRAMMARLY-STYLE AI SCANNER)
# ==========================================
@app.post("/analyze-text")
def analyze_text(payload: dict):
    """
    Scans text for AI patterns (0-100%) and scales +15 Human Points proportionally:
    0% AI -> +15.0 pts | 50% AI -> +7.5 pts | 100% AI -> 0.0 pts
    """
    text = payload.get("text", "").strip()
    user_id = payload.get("user_id", "demo_user")
    external_pastes = payload.get("external_pastes", 0)
    session = get_session(user_id)

    if not text:
        return {"ai_percentage": 0, "human_points_earned": 0.0, "flags": []}

    words = re.findall(r"\b\w+\b", text.lower())
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    ai_score = 0
    flags = []

    # 1. Classic LLM / ChatGPT buzzwords & robotic transitions
    ai_buzzwords = [
        "delve", "tapestry", "testament", "moreover", "furthermore",
        "in conclusion", "it is important to note", "crucial", "underscores",
        "pivotal", "landscape", "foster", "intricate", "realm", "comprehensive"
    ]
    found_buzzwords = [w for w in ai_buzzwords if w in text.lower()]
    if found_buzzwords:
        ai_score += min(45, len(found_buzzwords) * 15)
        flags.append(f"AI-common phrasing detected: {', '.join(found_buzzwords)}")

    # 2. Sentence length uniformity (AI writes with robotic rhythm; humans vary wildly)
    if len(sentences) >= 3:
        lengths = [len(s.split()) for s in sentences]
        avg_len = sum(lengths) / len(lengths)
        variance = sum((l - avg_len) ** 2 for l in lengths) / len(lengths)
        if variance < 6.0:
            ai_score += 25
            flags.append("Uniform robotic sentence cadence detected")

    # 3. Casual human slang / contractions / imperfection bonus
    human_markers = ["yoooo", "wassupp", "bro", "lol", "tbh", "idk", "gonna", "wanna", "n't", "'m", "'re", "'ve"]
    if any(m in text.lower() for m in human_markers):
        ai_score = max(0, ai_score - 25)

    # 4. External pastes from editor telemetry
    if external_pastes > 0:
        ai_score = min(100, ai_score + (external_pastes * 20))
        flags.append(f"{external_pastes} external paste(s) factored into scan")

    ai_percentage = max(0, min(100, round(ai_score)))
    human_points_earned = round(15.0 * (1 - (ai_percentage / 100)), 1)

    # Update user's dashboard points & human minutes
    session["human_points"] += human_points_earned
    if ai_percentage < 50:
        session["human_seconds"] += 120

    return {
        "user_id": user_id,
        "word_count": len(words),
        "ai_percentage": ai_percentage,
        "human_percentage": 100 - ai_percentage,
        "human_points_earned": human_points_earned,
        "is_human_verified": ai_percentage < 40,
        "flags": flags
    }

# ==========================================
# 5. DEMO RESET ENDPOINT
# ==========================================
@app.post("/tracker/reset/{user_id}")
def reset_tracker(user_id: str):
    active_sessions[user_id] = {
        "ai_seconds": 0,
        "human_seconds": 60,
        "human_points": 30.0,
        "ai_apps_opened": [],
        "ai_detected": False,
        "tab_switches": 0,
        "tutoring_events": []
    }
    return {"status": "reset", "user_id": user_id}