"""
WebSocket Bridge: Vobiz <-> VAPI Conversational AI

Architecture:
  Phone Call -> Vobiz -> WS /ws/bridge?call_id=<uuid> -> THIS SERVER -> VAPI WSS

Audio Transcoding (REQUIRED):
  Vobiz sends:    mulaw 8kHz  (G.711, base64-encoded JSON frames)
  VAPI expects:   PCM  16kHz  (raw base64 bytes)

  Vobiz->VAPI:  mulaw 8kHz  -> ulaw2lin -> ratecv(8k->16k) -> base64 -> VAPI
  VAPI->Vobiz:  PCM  16kHz  -> ratecv(16k->8k) -> lin2ulaw -> base64 -> Vobiz media frame
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

VAPI_WSS = "wss://api.vapi.ai/ws"


def mulaw8k_to_pcm16k_b64(mulaw_b64: str) -> str:
    """Convert base64 mulaw-8kHz audio to base64 PCM-16kHz for VAPI."""
    mulaw_bytes = base64.b64decode(mulaw_b64)
    pcm_8k = audioop.ulaw2lin(mulaw_bytes, 2)                        # mulaw -> 16-bit PCM @ 8kHz
    pcm_16k, _ = audioop.ratecv(pcm_8k, 2, 1, 8000, 16000, None)   # 8kHz -> 16kHz
    return base64.b64encode(pcm_16k).decode("utf-8")


def pcm16k_to_mulaw8k_b64(pcm_b64: str) -> str:
    """Convert base64 PCM-16kHz audio from VAPI to base64 mulaw-8kHz for Vobiz."""
    pcm_16k = base64.b64decode(pcm_b64)
    pcm_8k, _ = audioop.ratecv(pcm_16k, 2, 1, 16000, 8000, None)   # 16kHz -> 8kHz
    mulaw_bytes = audioop.lin2ulaw(pcm_8k, 2)                        # PCM -> mulaw
    return base64.b64encode(mulaw_bytes).decode("utf-8")


def log_bridge(msg: str):
    with open("bridge_debug.log", "a") as f:
        f.write(f"{msg}\n")
        print(f"[BRIDGE LOG] {msg}")


@router.websocket("/bridge")
async def vobiz_vapi_bridge(websocket: WebSocket):
    """
    WebSocket endpoint Vobiz connects to when the call is answered.
    Bridges audio (with transcoding) between Vobiz and VAPI Conversational AI.

    Query params:
        call_id: The Vobiz request_uuid used to look up farmer context (name, language)
    """
    call_id = websocket.query_params.get("call_id", "")
    log_bridge(f"New bridge connection request for call_id={call_id}")
    await websocket.accept()
    log_bridge(f"Accepted Vobiz websocket connection for call_id={call_id}")

    vapi_api_key = os.getenv("VAPI_API_KEY", "").strip()
    vapi_assistant_id = os.getenv("VAPI_ASSISTANT_ID", "").strip()

    if not vapi_api_key or not vapi_assistant_id:
        log_bridge("Missing VAPI credentials, closing.")
        await websocket.close()
        return

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

    vapi_headers = {
        "Authorization": f"Bearer {vapi_api_key}"
    }

    logger.info(f"[Bridge] Vobiz connected. Connecting to VAPI assistant: {vapi_assistant_id}")

    stream_sid = None
    transcript_messages = []
    ended_reason_val = None

    try:
        async with websockets.connect(
            VAPI_WSS,
            additional_headers=vapi_headers,
            open_timeout=15,
            ping_interval=20,
            ping_timeout=10,
        ) as vapi_ws:
            log_bridge("Successfully connected to VAPI websocket.")

            # Send session start message with assistant config and farmer context
            start_msg = json.dumps({
                "type": "session.start",
                "assistantId": vapi_assistant_id,
                "assistant": {
                    "variableValues": {
                        "farmer_name": farmer_name
                    }
                },
                "call": {
                    "id": call_id
                }
            })
            await vapi_ws.send(start_msg)
            log_bridge(f"Sent VAPI start | farmer_name={farmer_name} | call_id={call_id}")

            async def vobiz_to_vapi():
                nonlocal stream_sid, ended_reason_val
                try:
                    log_bridge("Started vobiz_to_vapi task.")
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
                        if event in ("start", "connected"):
                            start = data.get("start", {})
                            stream_sid = start.get("streamSid") or data.get("streamSid") or "unknown"
                            log_bridge(f"Stream started | streamSid={stream_sid}")

                        elif event == "media":
                            mulaw_b64 = data.get("media", {}).get("payload", "")
                            if not mulaw_b64:
                                continue
                            try:
                                # Transcode: mulaw 8kHz -> PCM 16kHz
                                pcm_b64 = mulaw8k_to_pcm16k_b64(mulaw_b64)
                                await vapi_ws.send(json.dumps({
                                    "type": "audio",
                                    "audio": {
                                        "encoding": "linear16",
                                        "sampleRate": 16000,
                                        "chunk": pcm_b64
                                    }
                                }))
                            except Exception as e:
                                logger.warning(f"[Bridge] Transcode error (vobiz->vapi): {e}")

                        elif event == "stop":
                            logger.info("[Bridge] Vobiz sent stop — ending session.")
                            if not ended_reason_val:
                                ended_reason_val = "customer-ended-call"
                            break

                except Exception as e:
                    logger.error(f"[Bridge] vobiz_to_vapi crashed: {e}")

            async def vapi_to_vobiz():
                """
                Receive PCM-16kHz audio from VAPI,
                transcode to mulaw-8kHz, forward to Vobiz.
                """
                nonlocal stream_sid, ended_reason_val
                try:
                    async for message in vapi_ws:
                        if isinstance(message, bytes):
                            # Raw PCM audio bytes from VAPI
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
                            # VAPI sends audio chunks as base64 in various fields
                            pcm_b64 = (
                                msg.get("audio", {}).get("chunk", "")
                                or msg.get("audioChunk", "")
                                or msg.get("audio_base_64", "")
                            )
                            if pcm_b64:
                                try:
                                    # Transcode: PCM 16kHz -> mulaw 8kHz
                                    mulaw_b64 = pcm16k_to_mulaw8k_b64(pcm_b64)
                                    await websocket.send_text(json.dumps({
                                        "event": "media",
                                        "streamSid": stream_sid,
                                        "media": {"payload": mulaw_b64}
                                    }))
                                except Exception as e:
                                    logger.warning(f"[Bridge] Transcode error (vapi->vobiz): {e}")

                        elif msg_type == "speech-update":
                            # User started speaking — clear Vobiz audio buffer
                            if msg.get("status") == "started":
                                try:
                                    await websocket.send_text(json.dumps({
                                        "event": "clear",
                                        "streamSid": stream_sid
                                    }))
                                except Exception:
                                    pass

                        elif msg_type == "transcript":
                            role = msg.get("role", "unknown")
                            text = msg.get("transcript", "")
                            logger.info(f"[Bridge] {role}: {text}")
                            transcript_messages.append({"role": role, "message": text})

                        elif msg_type == "call-ended":
                            logger.info("[Bridge] VAPI ended the call.")
                            ended_reason_val = msg.get("endedReason") or msg.get("call", {}).get("endedReason", "")
                            break

                        else:
                            logger.debug(f"[Bridge] VAPI unhandled msg type: {msg_type}")

                except Exception as e:
                    logger.error(f"[Bridge] vapi_to_vobiz crashed: {e}")

            # Run both directions concurrently; stop when either ends
            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(vobiz_to_vapi()),
                    asyncio.create_task(vapi_to_vobiz()),
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
        logger.error(f"[Bridge] VAPI WebSocket error: {e}")
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
                    # Update status based on endedReason
                    if ended_reason_val in ["customer-busy"]:
                        final_status = "rejected"
                    elif ended_reason_val in ["customer-did-not-answer"]:
                        final_status = "no response"
                    else:
                        final_status = "completed"

                    # Update direct call logs
                    conv_log = db.query(ConversationLog).filter(ConversationLog.call_sid == call_id).first()
                    if conv_log:
                        conv_log.call_status = final_status
                        if transcript_messages:
                            conv_log.farmer_responses = transcript_messages
                            if not conv_log.conversation_summary:
                                conv_log.conversation_summary = f"Conversation {final_status} via bridge."

                    voice_call = db.query(VoiceCall).filter(VoiceCall.call_sid == call_id).first()
                    if voice_call:
                        voice_call.status = final_status.title()

                    # Update campaign calls
                    campaign_call = db.query(CampaignCall).filter(CampaignCall.twilio_call_sid == call_id).first()
                    if campaign_call:
                        campaign_call.call_status = final_status
                        if transcript_messages:
                            formatted_trans = "\n".join([f"{msg['role'].capitalize()}: {msg['message']}" for msg in transcript_messages])
                            campaign_call.transcript = formatted_trans
                            if not campaign_call.summary:
                                campaign_call.summary = f"Conversation {final_status} via bridge."
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
