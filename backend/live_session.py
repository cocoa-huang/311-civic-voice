import asyncio
import base64
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types
from report import generate_report_pipeline

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
client = genai.Client(api_key=GEMINI_API_KEY)

MODEL = "gemini-live-2.5-flash-native-audio"

SYSTEM_PROMPT = """You are a 311 Civic Voice Agent for NYC. Help residents report civic issues efficiently.
You see through their camera in real time.
1. Identify the issue type (pothole, streetlight, graffiti, flooding, illegal dumping, rodent, noise...)
2. Guide camera: "Can you tilt down slightly so I can see the full extent?"
3. Gather: street address or cross streets, how long the issue has existed, severity
4. Confirm details, then call generate_report()
Keep responses to 1-2 sentences. NYC residents are busy.
Do NOT call generate_report until you have confirmed location from the resident."""

GENERATE_REPORT_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="generate_report",
            description="Call when you have complaint type, description, severity, and location confirmed by resident.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "complaint_type": {
                        "type": "string",
                        "description": "e.g. Pothole, Graffiti, Street Light Condition",
                    },
                    "description": {"type": "string"},
                    "severity": {"type": "string", "enum": ["Low", "Medium", "High"]},
                    "location_hint": {
                        "type": "string",
                        "description": "street address or cross streets",
                    },
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                },
                "required": ["complaint_type", "description", "severity", "location_hint"],
            },
        )
    ]
)

LIVE_CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    system_instruction=types.Content(parts=[types.Part(text=SYSTEM_PROMPT)]),
    tools=[GENERATE_REPORT_TOOL],
    output_audio_transcription=types.AudioTranscriptionConfig(),
    context_window_compression=types.ContextWindowCompressionConfig(trigger_tokens=25600),
)


@router.websocket("/ws/live")
async def live_endpoint(ws: WebSocket):
    await ws.accept()

    async with client.aio.live.connect(model=MODEL, config=LIVE_CONFIG) as session:

        async def send_loop():
            async for msg in ws.iter_json():
                if msg["type"] == "stop":
                    return
                data = base64.b64decode(msg["data"])
                if msg["type"] == "audio":
                    await session.send_realtime_input(
                        audio=types.Blob(data=data, mime_type="audio/pcm;rate=16000")
                    )
                elif msg["type"] == "video":
                    await session.send_realtime_input(
                        video=types.Blob(data=data, mime_type="image/jpeg")
                    )

        async def receive_loop():
            async for response in session.receive():
                if response.go_away:
                    await ws.send_json({"type": "session_expiring"})
                    return

                if response.data:
                    await ws.send_json(
                        {"type": "audio", "data": base64.b64encode(response.data).decode()}
                    )

                if response.tool_call:
                    for fc in response.tool_call.function_calls:
                        if fc.name == "generate_report":
                            report = await generate_report_pipeline(fc.args)
                            await ws.send_json({"type": "report_ready", "report": report})
                            await session.send_tool_response(
                                function_responses=[
                                    types.FunctionResponse(
                                        name=fc.name,
                                        id=fc.id,
                                        response={"result": "done"},
                                    )
                                ]
                            )

                if (
                    response.server_content
                    and response.server_content.output_transcription
                ):
                    await ws.send_json(
                        {
                            "type": "transcript",
                            "text": response.server_content.output_transcription.text,
                        }
                    )

        try:
            await asyncio.gather(send_loop(), receive_loop())
        except WebSocketDisconnect:
            pass
