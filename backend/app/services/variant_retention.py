from app.models.node import Node
from app.services.context import node_display_text


def has_multiple_assistant_variants(node: Node) -> bool:
    if node.role != "assistant":
        return False
    values = [node.variant_short, node.variant_medium, node.variant_long]
    return sum(1 for value in values if (value or "").strip()) > 1


def prune_assistant_variants(node: Node, selected_variant_index: int | None = None) -> None:
    if node.role != "assistant":
        return
    selected_index = max(0, min(2, selected_variant_index if selected_variant_index is not None else node.variant_index))
    variants = [node.variant_short or "", node.variant_medium or "", node.variant_long or ""]
    chosen = variants[selected_index] or node_display_text(node)
    node.variant_short = chosen
    node.variant_medium = None
    node.variant_long = None
    node.variant_index = 0
