import os
from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from google import genai
from google.genai import types
from routing import get_agency_for_complaint, get_nearby_count

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
client = genai.Client(api_key=GEMINI_API_KEY)


class ReportRequest(BaseModel):
    complaint_type: str
    description: str
    severity: str
    location_hint: str
    lat: float | None = None
    lng: float | None = None


async def generate_report_pipeline(args: dict) -> dict:
    complaint_type = args["complaint_type"]
    description = args["description"]
    severity = args["severity"]
    location_hint = args["location_hint"]
    lat = args.get("lat")
    lng = args.get("lng")

    # Run Socrata routing and nearby count
    agency_info = await get_agency_for_complaint(complaint_type)
    nearby_count = await get_nearby_count(lat, lng, complaint_type) if lat and lng else 0

    # Generate professional narrative via Gemini
    prompt = (
        f"Write a concise, professional NYC 311 complaint report (2-3 sentences) for the following:\n"
        f"Issue: {complaint_type}\n"
        f"Description: {description}\n"
        f"Severity: {severity}\n"
        f"Location: {location_hint}\n"
        f"Write in third person. Start with 'A resident reported...'"
    )

    narrative = description  # fallback
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        narrative = response.text.strip()
    except Exception:
        pass

    return {
        "complaint_type": complaint_type,
        "description": description,
        "severity": severity,
        "location_hint": location_hint,
        "lat": lat,
        "lng": lng,
        "agency": agency_info["agency"],
        "agency_name": agency_info["agency_name"],
        "nearby_count": nearby_count,
        "narrative": narrative,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/api/report")
async def create_report(req: ReportRequest):
    return await generate_report_pipeline(req.model_dump())
