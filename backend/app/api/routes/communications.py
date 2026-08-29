"""Communication resource routes (cross-candidate inbox view).

    GET /api/v1/communications                     paginated conversation list
    GET /api/v1/communications/{conversation_id}    one conversation with messages

Candidate-scoped communications live at
GET /api/v1/candidates/{candidate_id}/communications.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import DB
from app.core.errors import NotFoundError
from app.db import repositories as repo
from app.schemas.common import Paginated
from app.schemas.communication import Conversation, ConversationThread, Message

router = APIRouter(prefix="/communications", tags=["communications"])


@router.get("", response_model=Paginated[Conversation])
def list_conversations(
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Paginated[Conversation]:
    rows, total = repo.list_conversations(db, page=page, page_size=page_size)
    return Paginated[Conversation](
        items=[Conversation.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{conversation_id}", response_model=ConversationThread)
def get_conversation(conversation_id: UUID, db: DB) -> ConversationThread:
    conv = repo.get_conversation(db, conversation_id)
    if conv is None:
        raise NotFoundError("Conversation", conversation_id)
    messages = [
        Message.model_validate(m)
        for m in repo.list_messages_for_conversation(db, conversation_id)
    ]
    return ConversationThread.model_validate({**conv, "messages": messages})
