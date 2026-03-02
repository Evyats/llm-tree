from fastapi import APIRouter

from app.api import graphs, messages, nodes, session

api_router = APIRouter()
api_router.include_router(session.router)
api_router.include_router(graphs.router)
api_router.include_router(messages.router)
api_router.include_router(nodes.router)

