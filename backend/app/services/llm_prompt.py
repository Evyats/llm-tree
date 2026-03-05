def build_mode_instruction(mode: str, highlighted_text: str | None) -> str:
    if mode == "elaboration" and highlighted_text:
        return (
            "Elaborate specifically on the highlighted point from the prior assistant answer. "
            f"Highlighted point: {highlighted_text}"
        )
    return "Answer the latest user message."


def build_messages(
    transcript: list[dict[str, str]],
    user_text: str,
    mode: str,
    highlighted_text: str | None,
) -> list[dict[str, str]]:
    instruction = build_mode_instruction(mode, highlighted_text)
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

