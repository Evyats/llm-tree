import json
import logging
from typing import Literal

from openai import OpenAI

from app.core.config import get_settings
from app.schemas.common import Variants
from app.services.fallback import fallback_chat_title, fallback_tree_summary_variants, fallback_variants
from app.services.llm_prompt import build_messages
from app.services.llm_schema import build_request_body

logger = logging.getLogger("app.llm")


def generate_variants(
    transcript: list[dict[str, str]],
    user_text: str,
    mode: str,
    highlighted_text: str | None,
    runtime_api_key: str | None,
    selected_model: str | None = None,
) -> tuple[Variants, Literal["live", "fallback"]]:
    settings = get_settings()
    api_key = runtime_api_key or settings.openai_api_key
    available_models = settings.parsed_openai_models
    normalized_model = (selected_model or "").strip()
    force_fallback = normalized_model == "" or normalized_model == "fallback"
    chosen_model = (
        normalized_model
        if normalized_model in available_models
        else (available_models[0] if available_models else None)
    )
    if normalized_model and normalized_model not in {"fallback", *available_models}:
        logger.warning("MODEL_SELECTION_INVALID selected=%s available=%s", normalized_model, available_models)
    messages = build_messages(transcript, user_text, mode, highlighted_text)
    request_body = build_request_body(chosen_model, messages)
    logger.info(
        "OPENAI_REQUEST_BODY %s",
        json.dumps(
            {
                "has_api_key": bool(api_key),
                "mode": mode,
                "highlighted_text": highlighted_text,
                "selected_model": normalized_model or "fallback",
                "request_body": request_body,
            },
            ensure_ascii=False,
        ),
    )

    if force_fallback:
        logger.info("OPENAI_CALL_SKIPPED reason=selected_fallback using=fallback")
        return fallback_variants(user_text, mode, highlighted_text), "fallback"
    if not api_key:
        logger.info("OPENAI_CALL_SKIPPED reason=no_api_key using=fallback")
        return fallback_variants(user_text, mode, highlighted_text), "fallback"
    if not chosen_model:
        logger.info("OPENAI_CALL_SKIPPED reason=no_models_configured using=fallback")
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


def generate_tree_summary_variants(
    tree_summary: dict,
    runtime_api_key: str | None,
    selected_model: str | None = None,
) -> tuple[Variants, Literal["live", "fallback"]]:
    settings = get_settings()
    api_key = runtime_api_key or settings.openai_api_key
    available_models = settings.parsed_openai_models
    normalized_model = (selected_model or "").strip()
    force_fallback = normalized_model == "" or normalized_model == "fallback"
    chosen_model = (
        normalized_model
        if normalized_model in available_models
        else (available_models[0] if available_models else None)
    )
    if normalized_model and normalized_model not in {"fallback", *available_models}:
        logger.warning("MODEL_SELECTION_INVALID selected=%s available=%s", normalized_model, available_models)

    tree_json = json.dumps(tree_summary["tree"], ensure_ascii=False, indent=2)
    messages = [
        {
            "role": "system",
            "content": (
                "You are generating three variants of one answer. "
                "Return strict JSON only with keys short, medium, long. "
                "Rules: short is one sentence; medium is one concise paragraph; "
                "long is a detailed summary and may include a compact JSON view when useful."
            ),
        },
        {
            "role": "system",
            "content": (
                "Summarize the full conversation subtree represented by the provided JSON. "
                "Cover all branches, not just one path. Treat the JSON as the full source of truth. "
                "Make it explicit that this node exists because a previously expanded branch was compacted and that "
                "the conversation will continue from this summarized point. The summary should briefly explain why "
                "it is here before describing what was discussed."
            ),
        },
        {
            "role": "user",
            "content": (
                "Summarize this conversation tree into short, medium, and long variants.\n\n"
                f"Tree JSON:\n{tree_json}"
            ),
        },
    ]
    request_body = build_request_body(chosen_model, messages)
    logger.info(
        "OPENAI_REQUEST_BODY %s",
        json.dumps(
            {
                "has_api_key": bool(api_key),
                "mode": "compact-summary",
                "selected_model": normalized_model or "fallback",
                "request_body": request_body,
            },
            ensure_ascii=False,
        ),
    )

    if force_fallback:
        logger.info("OPENAI_CALL_SKIPPED reason=selected_fallback using=fallback")
        return fallback_tree_summary_variants({**tree_summary, "tree": tree_json}), "fallback"
    if not api_key:
        logger.info("OPENAI_CALL_SKIPPED reason=no_api_key using=fallback")
        return fallback_tree_summary_variants({**tree_summary, "tree": tree_json}), "fallback"
    if not chosen_model:
        logger.info("OPENAI_CALL_SKIPPED reason=no_models_configured using=fallback")
        return fallback_tree_summary_variants({**tree_summary, "tree": tree_json}), "fallback"
    try:
        client = OpenAI(api_key=api_key, timeout=settings.openai_timeout_seconds)
        response = client.chat.completions.create(**request_body)
        payload = json.loads(response.choices[0].message.content or "{}")
        variants = Variants(**payload)
        return variants, "live"
    except Exception as exc:
        logger.warning("OPENAI_CALL_FAILED using=fallback error=%s", repr(exc))
        return fallback_tree_summary_variants({**tree_summary, "tree": tree_json}), "fallback"


def generate_chat_title(
    transcript: list[dict[str, str]],
    runtime_api_key: str | None,
    selected_model: str | None = None,
) -> tuple[str, Literal["live", "fallback"]]:
    settings = get_settings()
    api_key = runtime_api_key or settings.openai_api_key
    available_models = settings.parsed_openai_models
    normalized_model = (selected_model or "").strip()
    force_fallback = normalized_model == "" or normalized_model == "fallback"
    chosen_model = (
        normalized_model
        if normalized_model in available_models
        else (available_models[0] if available_models else None)
    )
    if normalized_model and normalized_model not in {"fallback", *available_models}:
        logger.warning("MODEL_SELECTION_INVALID selected=%s available=%s", normalized_model, available_models)

    first_user_text = next((item.get("content", "") for item in transcript if item.get("role") == "user"), "")
    if force_fallback or not api_key or not chosen_model:
        return fallback_chat_title(first_user_text), "fallback"

    messages = [
        {
            "role": "system",
            "content": (
                "Create a very short title for this chat. "
                "Return plain text only. Use 2 to 4 words. No quotes. No punctuation unless essential."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(transcript, ensure_ascii=False),
        },
    ]
    logger.info(
        "OPENAI_REQUEST_BODY %s",
        json.dumps(
            {
                "has_api_key": bool(api_key),
                "mode": "chat-title",
                "selected_model": normalized_model or "fallback",
                "request_body": {"model": chosen_model, "messages": messages},
            },
            ensure_ascii=False,
        ),
    )
    try:
        client = OpenAI(api_key=api_key, timeout=settings.openai_timeout_seconds)
        response = client.chat.completions.create(
            model=chosen_model,
            temperature=0.2,
            messages=messages,
        )
        title = (response.choices[0].message.content or "").strip().strip("\"' \n\t")
        title = " ".join(title.split())[:40].strip()
        if not title:
            return fallback_chat_title(first_user_text), "fallback"
        return title, "live"
    except Exception as exc:
        logger.warning("OPENAI_CALL_FAILED using=fallback error=%s", repr(exc))
        return fallback_chat_title(first_user_text), "fallback"
