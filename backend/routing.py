import os
import httpx

SOCRATA_URL = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"
SOCRATA_APP_TOKEN = os.getenv("SOCRATA_APP_TOKEN", "")

COMPLAINT_TO_AGENCY = {
    "Pothole": {"agency": "DOT", "agency_name": "Dept of Transportation"},
    "Street Light Condition": {"agency": "DOT", "agency_name": "Dept of Transportation"},
    "Graffiti": {"agency": "DSNY", "agency_name": "Dept of Sanitation"},
    "Illegal Dumping": {"agency": "DSNY", "agency_name": "Dept of Sanitation"},
    "Rodent": {"agency": "DOHMH", "agency_name": "Dept of Health & Mental Hygiene"},
    "Flooding": {"agency": "DEP", "agency_name": "Dept of Environmental Protection"},
    "Noise - Residential": {"agency": "NYPD", "agency_name": "Police Department"},
    "HEAT/HOT WATER": {"agency": "HPD", "agency_name": "Housing Preservation & Development"},
}


async def get_agency_for_complaint(complaint_type: str) -> dict:
    """Query Socrata for agency routing; fall back to hardcoded table."""
    headers = {}
    if SOCRATA_APP_TOKEN:
        headers["X-App-Token"] = SOCRATA_APP_TOKEN

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                SOCRATA_URL,
                params={"$where": f"complaint_type='{complaint_type}'", "$limit": 1, "$select": "agency"},
                headers=headers,
            )
            data = resp.json()
            if data and "agency" in data[0]:
                agency_code = data[0]["agency"]
                for v in COMPLAINT_TO_AGENCY.values():
                    if v["agency"] == agency_code:
                        return v
                return {"agency": agency_code, "agency_name": agency_code}
    except Exception:
        pass

    # Fallback: match by key (case-insensitive)
    complaint_lower = complaint_type.lower()
    for key, val in COMPLAINT_TO_AGENCY.items():
        if key.lower() in complaint_lower or complaint_lower in key.lower():
            return val

    return {"agency": "NYC311", "agency_name": "NYC 311"}


async def get_nearby_count(lat: float, lng: float, complaint_type: str) -> int:
    """Count similar complaints in a ~500m bounding box."""
    if not lat or not lng:
        return 0

    headers = {}
    if SOCRATA_APP_TOKEN:
        headers["X-App-Token"] = SOCRATA_APP_TOKEN

    delta = 0.005
    where = (
        f"complaint_type='{complaint_type}' AND "
        f"latitude > '{lat - delta}' AND latitude < '{lat + delta}' AND "
        f"longitude > '{lng - delta}' AND longitude < '{lng + delta}'"
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                SOCRATA_URL,
                params={"$where": where, "$select": "count(*)", "$limit": 1},
                headers=headers,
            )
            data = resp.json()
            if data and "count" in data[0]:
                return int(data[0]["count"])
    except Exception:
        pass

    return 0
