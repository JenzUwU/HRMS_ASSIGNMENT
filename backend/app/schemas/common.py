from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class HealthResponse(BaseModel):
    status: str
    environment: str
    version: str


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
