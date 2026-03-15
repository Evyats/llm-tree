from app.models.edge import Edge
from app.models.node import Node
from app.schemas.common import EdgePayload, NodePayload, Variants
from app.services.variant_retention import has_multiple_assistant_variants


def to_node_payload(node: Node) -> NodePayload:
    variants = None
    text = node.user_text or ""
    if node.role == "assistant":
        if has_multiple_assistant_variants(node):
            variants = Variants(
                short=node.variant_short or "",
                medium=node.variant_medium or "",
                long=node.variant_long or "",
            )
            variant_map = [variants.short, variants.medium, variants.long]
            idx = max(0, min(2, node.variant_index))
            text = variant_map[idx]
        else:
            text = node.variant_short or node.variant_medium or node.variant_long or ""
    return NodePayload(
        id=node.id,
        graph_id=node.graph_id,
        role=node.role,  # type: ignore[arg-type]
        parent_id=node.parent_id,
        text=text,
        variants=variants,
        variant_index=node.variant_index,
        position_x=node.position_x,
        position_y=node.position_y,
        mode=node.mode,
        highlighted_text=node.highlighted_text,
    )


def to_edge_payload(edge: Edge) -> EdgePayload:
    return EdgePayload(
        id=edge.id,
        graph_id=edge.graph_id,
        source_node_id=edge.source_node_id,
        target_node_id=edge.target_node_id,
        edge_type=edge.edge_type,
    )
