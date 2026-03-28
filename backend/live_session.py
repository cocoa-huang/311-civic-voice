import asyncio
import base64
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types
from report import generate_report_pipeline

router = APIRouter()

client = genai.Client(
    vertexai=True,
    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
)

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
    input_audio_transcription=types.AudioTranscriptionConfig(),
    realtime_input_config=types.RealtimeInputConfig(
        automatic_activity_detection=types.AutomaticActivityDetection(
            start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
            end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
        )
    ),
    context_window_compression=types.ContextWindowCompressionConfig(trigger_tokens=25600),
)


@router.websocket("/ws/live")
async def live_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        async with client.aio.live.connect(model=MODEL, config=LIVE_CONFIG) as session:
            print("✅ Gemini Live session opened")
            # Kick off agent greeting immediately so receive_loop gets exercised
            await session.send_client_content(
                turns=[types.Content(role="user", parts=[types.Part(text="Hello, please greet the user and ask them what civic issue they'd like to report.")])]
            )

            async def send_loop():
                async for msg in ws.iter_json():
                    print(f"→ Forwarding {msg['type']} to Gemini")
                    if msg["type"] == "stop":
                        return
                    if msg["type"] == "audio":
                        data = base64.b64decode(msg["data"])
                        await session.send_realtime_input(
                            audio=types.Blob(data=data, mime_type="audio/pcm;rate=16000")
                        )
                        await asyncio.sleep(0)
                    elif msg["type"] == "video":
                        data = base64.b64decode(msg["data"])
                        await session.send_realtime_input(
                            video=types.Blob(data=data, mime_type="image/jpeg")
                        )

            async def receive_loop():
                async for response in session.receive():
                    has_audio = bool(response.server_content and response.server_content.model_turn)
                    print(f"← Gemini response: audio={has_audio} tool_call={bool(response.tool_call)} go_away={bool(response.go_away)}")
                    if response.go_away:
                        await ws.send_json({"type": "session_expiring"})
                        return

                    if response.server_content and response.server_content.model_turn:
                        for part in response.server_content.model_turn.parts:
                            if part.inline_data and part.inline_data.data:
                                await ws.send_json(
                                    {"type": "audio", "data": base64.b64encode(part.inline_data.data).decode()}
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
                        text = response.server_content.output_transcription.text
                        print(f"📝 Agent transcript: {text!r}")
                        await ws.send_json({"type": "transcript", "text": text})

                    if (
                        response.server_content
                        and response.server_content.input_transcription
                    ):
                        text = response.server_content.input_transcription.text
                        print(f"🎤 User transcript: {text!r}")
                        await ws.send_json({"type": "transcript", "text": f"You: {text}"})

            try:
                await asyncio.gather(send_loop(), receive_loop())
            except WebSocketDisconnect:
                pass

    except Exception as e:
        print(f"❌ Gemini Live error: {e}")
        import traceback; traceback.print_exc()
