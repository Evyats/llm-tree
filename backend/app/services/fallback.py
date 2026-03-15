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


def fallback_tree_summary_variants(tree_summary: dict) -> Variants:
    root_text = str(tree_summary.get("root_text") or "conversation branch")
    node_count = int(tree_summary.get("node_count") or 0)
    branch_count = int(tree_summary.get("branch_count") or 0)
    leaf_count = int(tree_summary.get("leaf_count") or 0)
    summary_json = tree_summary.get("tree") or {}
    return Variants(
        short=f"Compacted branch summary for '{root_text}'.",
        medium=(
            f"This node replaces a previously expanded branch so the conversation can continue from here without "
            f"keeping the full subtree visible. It summarizes {node_count} nodes, {branch_count} branch points, "
            f"and {leaf_count} leaves starting from '{root_text}'."
        ),
        long=(
            "This node replaces a previously expanded conversation branch so we can continue from this point with a "
            "compact context.\n\n"
            "What was discussed in that branch:\n"
            f"- Root topic: {root_text}\n"
            f"- Total nodes: {node_count}\n"
            f"- Branch points: {branch_count}\n"
            f"- Leaf outcomes: {leaf_count}\n\n"
            "Structured summary of that branch:\n"
            f"```json\n{summary_json}\n```\n\n"
            "The conversation can now continue from this summarized point."
        ),
    )


def fallback_chat_title(first_user_text: str | None) -> str:
    _ = first_user_text
    return "AI Generated Header"
