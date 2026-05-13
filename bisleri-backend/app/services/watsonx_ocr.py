# app/services/watsonx_ocr.py
"""
WatsonX OCR Service — sends image to llama-4-maverick and extracts
the numeric integer displayed on a production machine counter.
"""
import base64
import logging
import re
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

OCR_PROMPT = (
    "This image shows a numeric counter display on a production machine. "
    "Extract only the numeric integer value shown on the display. "
    "Return only the integer number, nothing else, no text, no explanation."
)


def _build_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.WATSONX_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _build_payload(image_b64: str, mime_type: str = "image/jpeg") -> dict:
    """
    IBM WatsonX AI text/chat inference payload for llama-4-maverick.
    The model_id and project_id are passed as query/body parameters.
    """
    return {
        "model_id": settings.WATSONX_MODEL,
        "project_id": settings.WATSONX_PROJECT_ID,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_b64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": OCR_PROMPT
                    }
                ]
            }
        ],
        "parameters": {
            "max_new_tokens": 20,
            "temperature": 0
        }
    }


def extract_quantity_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> int | None:
    """
    Send image bytes to WatsonX llama-4-maverick and parse the returned integer.

    Returns:
        int  — the extracted counter value
        None — if OCR fails, API is unreachable, or response cannot be parsed
    """
    if settings.WATSONX_API_URL == "placeholder" or settings.WATSONX_API_KEY == "placeholder":
        logger.warning("WatsonX credentials are placeholders — OCR skipped, returning None")
        return None

    try:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        payload = _build_payload(image_b64, mime_type)

        with httpx.Client(timeout=30) as client:
            response = client.post(
                settings.WATSONX_API_URL,
                headers=_build_headers(),
                json=payload
            )
            response.raise_for_status()

        data = response.json()

        # WatsonX chat-style response: data["choices"][0]["message"]["content"]
        raw_text: str = (
            data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            or
            # Fallback: WatsonX text generation style
            data.get("results", [{}])[0].get("generated_text", "")
        )

        raw_text = raw_text.strip()
        logger.info(f"WatsonX OCR raw response: '{raw_text}'")

        # Extract first integer found in response
        match = re.search(r"\d+", raw_text)
        if match:
            return int(match.group())

        logger.warning(f"Could not parse integer from WatsonX response: '{raw_text}'")
        return None

    except httpx.HTTPStatusError as e:
        logger.error(f"WatsonX HTTP error {e.response.status_code}: {e.response.text}")
        return None
    except httpx.RequestError as e:
        logger.error(f"WatsonX request error: {e}")
        return None
    except Exception as e:
        logger.error(f"WatsonX OCR unexpected error: {e}")
        return None
