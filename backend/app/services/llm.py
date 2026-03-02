import json
import logging
from typing import Literal

from openai import OpenAI

from app.core.config import get_settings
from app.schemas.common import Variants
from app.services.fallback import fallback_variants

logger = logging.getLogger("app.llm")


def _build_mode_instruction(mode: str, highlighted_text: str | None) -> str:
    if mode == "elaboration" and highlighted_text:
        return (
            "Elaborate specifically on the highlighted point from the prior assistant answer. "
            f"Highlighted point: {highlighted_text}"
        )
    return "Answer the latest user message."


def _build_messages(
    transcript: list[dict[str, str]],
    user_text: str,
    mode: str,
    highlighted_text: str | None,
) -> list[dict[str, str]]:
    instruction = _build_mode_instruction(mode, highlighted_text)
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": (
                "You are generating three variants of one answer. "
                "Return strict JSON only with keys short, medium, long. "
                "Rules: short is one word or one sentence; medium is one concise paragraph; "
                "long is a detailed comprehensive answer."
            ),
        },
        {"role": "system", "content": instruction},
    ]
    for item in transcript:
        role = item.get("role", "")
        content = item.get("content", "")
        if role in {"user", "assistant"} and isinstance(content, str):
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_text})
    return messages


def generate_variants(
    transcript: list[dict[str, str]],
    user_text: str,
    mode: str,
    highlighted_text: str | None,
    runtime_api_key: str | None,
) -> tuple[Variants, Literal["live", "fallback"]]:
    settings = get_settings()
    api_key = runtime_api_key or settings.openai_api_key
    messages = _build_messages(transcript, user_text, mode, highlighted_text)
    schema = {
        "name": "chat_tree_variants",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "short": {"type": "string", "minLength": 1},
                "medium": {"type": "string", "minLength": 1},
                "long": {"type": "string", "minLength": 1},
            },
            "required": ["short", "medium", "long"],
            "additionalProperties": False,
        },
    }
    request_body = {
        "model": settings.default_model,
        "temperature": 0.4,
        "response_format": {"type": "json_schema", "json_schema": schema},
        "messages": messages,
    }
    logger.info(
        "OPENAI_REQUEST_BODY %s",
        json.dumps(
            {
                "has_api_key": bool(api_key),
                "mode": mode,
                "highlighted_text": highlighted_text,
                "request_body": request_body,
            },
            ensure_ascii=False,
        ),
    )

    if not api_key:
        logger.info("OPENAI_CALL_SKIPPED reason=no_api_key using=fallback")
        return fallback_variants(user_text, mode, highlighted_text), "fallback"
    try:
        client = OpenAI(api_key=api_key, timeout=settings.openai_timeout_seconds)
        response = client.chat.completions.create(**request_body)
        payload = json.loads(response.choices[0].message.content or "{}")
        variants = Variants(**payload)
        return variants, "live"
    except Exception as exc:
        logger.warning("OPENAI_CALL_FAILED using=fallback error=%s", repr(exc))
        return fallback_variants(user_text, mode, highlighted_text), "fallback"
