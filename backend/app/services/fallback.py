from app.schemas.common import Variants


def fallback_variants(user_text: str, mode: str, highlighted_text: str | None) -> Variants:
    if mode == "elaboration" and highlighted_text:
        return Variants(
            short=f"About '{highlighted_text}': key point.",
            medium=f"This elaborates on '{highlighted_text}' with a concise clarification and practical interpretation.",
            long=(
                f"Elaboration for '{highlighted_text}': this point can be unpacked into context, meaning, and implications. "
                "At a high level, it adds detail, ties to surrounding ideas, and explains why it matters in the flow of the discussion."
            ),
        )
    return Variants(
        short="This is the short response.",
        medium="This is the medium response. It gives a concise and clear explanation in one short paragraph.",
        long=(
            "This is the long response. It provides a more comprehensive explanation with additional context, "
            "tradeoffs, and practical details so the idea can be understood and applied more deeply."
        ),
    )

