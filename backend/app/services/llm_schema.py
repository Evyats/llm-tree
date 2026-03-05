def variants_json_schema() -> dict:
    return {
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


def build_request_body(model: str | None, messages: list[dict[str, str]]) -> dict:
    return {
        "model": model,
        "temperature": 0.4,
        "response_format": {"type": "json_schema", "json_schema": variants_json_schema()},
        "messages": messages,
    }

