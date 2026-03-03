class DomainError(Exception):
    """Base exception for service-layer domain errors."""


class GraphNotFoundError(DomainError):
    pass


class NodeNotFoundError(DomainError):
    pass


class InvalidNodeRoleError(DomainError):
    pass


class VariantLockedError(DomainError):
    pass
