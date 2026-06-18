"""
WebSocket Bridge: Vobiz ↔ ElevenLabs Conversational AI

Architecture:
  Phone Call → Vobiz → WS /ws/bridge?call_id=<uuid> → THIS SERVER → ElevenLabs WSS

Audio Transcoding (REQUIRED):
  Vobiz sends:        mulaw 8kHz  (G.711, base64-encoded JSON frames)
  ElevenLabs expects: PCM  16kHz  (raw base64 bytes)

  Vobiz→ElevenLabs:  mulaw 8kHz  → ulaw2lin → ratecv(8k→16k) → base64 → ElevenLabs
  ElevenLabs→Vobiz:  PCM  16kHz  → ratecv(16k→8k) → lin2ulaw → base64 → Vobiz media frame
"""

import asyncio
import audioop
import base64
import json
import os
import logging

import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

ELEVENLABS_WSS = "wss://api.elevenlabs.io/v1/convai/conversation"


def mulaw8k_to_pcm16k_b64(mulaw_b64: str) -> str:
    """Convert base64 mulaw-8kHz audio to base64 PCM-16kHz for ElevenLabs."""
    mulaw_bytes = base64.b64decode(mulaw_b64)
    pcm_8k = audioop.ulaw2lin(mulaw_bytes, 2)                        # mulaw → 16-bit PCM @ 8kHz
    pcm_16k, _ = audioop.ratecv(pcm_8k, 2, 1, 8000, 16000, None)   # 8kHz → 16kHz
    return base64.b64encode(pcm_16k).decode("utf-8")


def pcm16k_to_mulaw8k_b64(pcm_b64: str) -> str:
    """Convert base64 PCM-16kHz audio from ElevenLabs to base64 mulaw-8kHz for Vobiz."""
    pcm_16k = base64.b64decode(pcm_b64)
    pcm_8k, _ = audioop.ratecv(pcm_16k, 2, 1, 16000, 8000, None)   # 16kHz → 8kHz
    mulaw_bytes = audioop.lin2ulaw(pcm_8k, 2)                        # PCM → mulaw
    return base64.b64encode(mulaw_bytes).decode("utf-8")


def log_bridge(msg: str):
    with open("bridge_debug.log", "a") as f:
        f.write(f"{msg}\n")
        print(f"[BRIDGE LOG] {msg}")


@router.websocket("/bridge")
async def vobiz_elevenlabs_bridge(websocket: WebSocket):
    """
    WebSocket endpoint Vobiz connects to when the call is answered.
    Bridges audio (with transcoding) between Vobiz and ElevenLabs Conversational AI.

    Query params:
        call_id: The Vobiz request_uuid used to look up farmer context (name, language)
    """
    call_id = websocket.query_params.get("call_id", "")
    log_bridge(f"New bridge connection request for call_id={call_id}")
    await websocket.accept()
    log_bridge(f"Accepted Vobiz websocket connection for call_id={call_id}")

    agent_id = os.getenv("ELEVENLABS_AGENT_ID", "").strip()
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()

    if not agent_id or not api_key:
        log_bridge("Missing ElevenLabs credentials, closing.")
        await websocket.close()
        return

    # 1) Connect to ElevenLabs ConvAI WebSocket
    elevenlabs_ws_url = f"wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}"
    log_bridge(f"Connecting to ElevenLabs URL: {elevenlabs_ws_url}")

    # Look up farmer name from the shared context store populated at call initiation
    farmer_name = "Farmer"
    if call_id:
        try:
            from app.routes.voice_calls import _call_context
            ctx = _call_context.get(call_id, {})
            farmer_name = ctx.get("farmer_name", "Farmer")
            logger.info(f"[Bridge] call_id={call_id} farmer_name={farmer_name}")
        except Exception as e:
            logger.warning(f"[Bridge] Could not load call context: {e}")

    eleven_uri = f"{ELEVENLABS_WSS}?agent_id={agent_id}"
    eleven_headers = {"xi-api-key": api_key}

    logger.info(f"[Bridge] Vobiz connected. Connecting to ElevenLabs agent: {agent_id}")

    stream_sid = None
    elevenlabs_conv_id = None
    transcript_messages = []

    try:
        async with websockets.connect(
            eleven_uri,
            additional_headers=eleven_headers,
            open_timeout=15,
            ping_interval=20,
            ping_timeout=10,
        ) as eleven_ws:
            log_bridge("Successfully connected to ElevenLabs websocket.")
            init_msg = json.dumps({
                "type": "conversation_initiation_client_data",
                "dynamic_variables": {
                    "farmer_name": farmer_name
                },
                "custom_metadata": {
                    "call_sid": call_id
                },
                "conversation_config_override": {
                    "tts": {
                        "optimize_streaming_latency": 3
                    }
                }
            })
            await eleven_ws.send(init_msg)
            log_bridge(f"Sent initiation config | farmer_name={farmer_name} | call_sid={call_id}")

            async def vobiz_to_eleven():
                nonlocal stream_sid
                try:
                    log_bridge("Started vobiz_to_eleven task.")
                    while True:
                        try:
                            raw = await websocket.receive_text()
                        except Exception as e:
                            log_bridge(f"Vobiz disconnected or error: {e}")
                            break

                        try:
                            data = json.loads(raw)
                        except Exception:
                            log_bridge("Vobiz sent non-JSON data")
                            continue

                        event = data.get("event")
                        if event == "start" or event == "connected":
                            start = data.get("start", {})
                            stream_sid = start.get("streamSid") or data.get("streamSid") or "unknown"
                            log_bridge(f"Stream started | streamSid={stream_sid}")

                        elif event == "media":
                            mulaw_b64 = data.get("media", {}).get("payload", "")
                            if not mulaw_b64:
                                continue
                            try:
                                # Transcode: mulaw 8kHz → PCM 16kHz
                                pcm_b64 = mulaw8k_to_pcm16k_b64(mulaw_b64)
                                await eleven_ws.send(
                                    json.dumps({"user_audio_chunk": pcm_b64})
                                )
                            except Exception as e:
                                logger.warning(f"[Bridge] Transcode error (v→e): {e}")

                        elif event == "stop":
                            logger.info("[Bridge] Vobiz sent stop — ending session.")
                            break

                except Exception as e:
                    logger.error(f"[Bridge] vobiz_to_eleven crashed: {e}")

            async def eleven_to_vobiz():
                """
                Receive PCM-16kHz audio from ElevenLabs,
                transcode to mulaw-8kHz, forward to Vobiz.
                """
                nonlocal stream_sid, elevenlabs_conv_id
                try:
                    async for message in eleven_ws:
                        if isinstance(message, bytes):
                            try:
                                pcm_b64 = base64.b64encode(message).decode("utf-8")
                                mulaw_b64 = pcm16k_to_mulaw8k_b64(pcm_b64)
                                await websocket.send_text(json.dumps({
                                    "event": "media",
                                    "streamSid": stream_sid,
                                    "media": {"payload": mulaw_b64}
                                }))
                            except Exception:
                                pass
                            continue

                        try:
                            msg = json.loads(message)
                        except Exception:
                            continue

                        msg_type = msg.get("type")

                        if msg_type == "audio":
                            # ElevenLabs sends PCM 16kHz base64 in audio_event
                            audio_event = msg.get("audio_event", {})
                            pcm_b64 = audio_event.get("audio_base_64", "")
                            if not pcm_b64:
                                pcm_b64 = msg.get("audio_base_64", "")

                            if pcm_b64:
                                try:
                                    # Transcode: PCM 16kHz → mulaw 8kHz
                                    mulaw_b64 = pcm16k_to_mulaw8k_b64(pcm_b64)
                                    await websocket.send_text(json.dumps({
                                        "event": "media",
                                        "streamSid": stream_sid,
                                        "media": {"payload": mulaw_b64}
                                    }))
                                except Exception as e:
                                    logger.warning(f"[Bridge] Transcode error (e→v): {e}")

                        elif msg_type == "conversation_initiation_metadata":
                            meta = msg.get("conversation_initiation_metadata_event", {})
                            elevenlabs_conv_id = meta.get("conversation_id")
                            logger.info(
                                f"[Bridge] Conversation started | "
                                f"id={elevenlabs_conv_id} | "
                                f"agent_fmt={meta.get('agent_output_audio_format')} | "
                                f"user_fmt={meta.get('user_input_audio_format')}"
                            )

                        elif msg_type == "interruption":
                            # User spoke — clear Vobiz audio buffer
                            try:
                                await websocket.send_text(json.dumps({
                                    "event": "clear",
                                    "streamSid": stream_sid
                                }))
                            except Exception:
                                pass

                        elif msg_type == "ping":
                            event_id = msg.get("ping_event", {}).get("event_id")
                            try:
                                await eleven_ws.send(json.dumps({
                                    "type": "pong",
                                    "event_id": event_id
                                }))
                            except Exception:
                                pass

                        elif msg_type == "agent_response":
                            text = msg.get("agent_response_event", {}).get("agent_response", "")
                            logger.info(f"[Bridge] Agent said: {text}")
                            transcript_messages.append({"role": "agent", "message": text})

                        elif msg_type == "user_transcript":
                            text = msg.get("user_transcription_event", {}).get("user_transcript", "")
                            logger.info(f"[Bridge] User said: {text}")
                            transcript_messages.append({"role": "user", "message": text})

                        elif msg_type == "internal_tentative_agent_response":
                            pass  # Ignore internal tentative responses

                        else:
                            logger.debug(f"[Bridge] ElevenLabs unhandled msg type: {msg_type}")

                except Exception as e:
                    logger.error(f"[Bridge] eleven_to_vobiz crashed: {e}")

            # Run both directions concurrently; stop when either ends
            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(vobiz_to_eleven()),
                    asyncio.create_task(eleven_to_vobiz()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    except websockets.exceptions.WebSocketException as e:
        logger.error(f"[Bridge] ElevenLabs WebSocket error: {e}")
    except Exception as e:
        logger.error(f"[Bridge] Unexpected error: {e}")
    finally:
        logger.info("[Bridge] Session ended.")
        # Clean up call context and update status in database
        if call_id:
            try:
                from app.routes.voice_calls import _call_context
                _call_context.pop(call_id, None)
            except Exception:
                pass

            try:
                from app.database import SessionLocal
                from app.models.conversation_log import ConversationLog
                from app.models.voice_call import VoiceCall
                from app.models.campaign import CampaignCall
                from app.scheduler import check_and_update_campaign_status

                db = SessionLocal()
                try:
                    # Update direct call logs
                    conv_log = db.query(ConversationLog).filter(ConversationLog.call_sid == call_id).first()
                    if conv_log:
                        conv_log.call_status = "completed"
                        if elevenlabs_conv_id:
                            conv_log.elevenlabs_conversation_id = elevenlabs_conv_id
                        if transcript_messages:
                            conv_log.farmer_responses = transcript_messages
                            if not conv_log.conversation_summary:
                                conv_log.conversation_summary = "Conversation completed via bridge."
                    
                    voice_call = db.query(VoiceCall).filter(VoiceCall.call_sid == call_id).first()
                    if voice_call:
                        voice_call.status = "Completed"
                        
                    # Update campaign calls
                    campaign_call = db.query(CampaignCall).filter(CampaignCall.twilio_call_sid == call_id).first()
                    if campaign_call:
                        campaign_call.call_status = "completed"
                        if elevenlabs_conv_id:
                            campaign_call.elevenlabs_conversation_id = elevenlabs_conv_id
                        if transcript_messages:
                            formatted_trans = "\n".join([f"{msg['role'].capitalize()}: {msg['message']}" for msg in transcript_messages])
                            campaign_call.transcript = formatted_trans
                            if not campaign_call.summary:
                                campaign_call.summary = "Conversation completed via bridge."
                        db.commit()
                        check_and_update_campaign_status(campaign_call.campaign_id, db)
                    else:
                        db.commit()
                except Exception as e:
                    logger.error(f"[Bridge] Error updating call status in DB: {e}")
                    db.rollback()
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"[Bridge] DB update failed: {e}")

        try:
            await websocket.close()
        except Exception:
            pass

