"""Pydantic models for foraging API endpoints."""

from pydantic import BaseModel, Field

MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
VALID_MONTHS = set(MONTH_ORDER)


def _validate_and_sort_months(months: list[str]) -> list[str]:
    """Validate month names, deduplicate, and sort into calendar order."""
    for m in months:
        if m not in VALID_MONTHS:
            msg = f"Invalid month: {m}. Must be one of {sorted(VALID_MONTHS)}"
            raise ValueError(msg)
    return sorted(set(months), key=MONTH_ORDER.index)


class ForagingSpotResponse(BaseModel):
    """Foraging spot data returned by the API."""

    id: str
    type: str
    lat: float
    lng: float
    notes: str = ""
    months: list[str] = Field(default_factory=list, description="Short month names: Jan, Feb, ..., Dec")
    date: str = ""
    created_at: str = ""
    last_updated: str = ""
    created_by: str | None = Field(default=None, exclude=True)
    group_id: str | None = None


class ForagingSpotCreate(BaseModel):
    """Request body for creating a foraging spot."""

    type: str = Field(min_length=1, max_length=100)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    notes: str = Field(default="", max_length=1000)
    months: list[str] = Field(min_length=1, max_length=12)
    date: str = Field(default="", max_length=50)

    def model_post_init(self, _context: object) -> None:
        """Validate and deduplicate months after init."""
        object.__setattr__(self, "months", _validate_and_sort_months(self.months))


class ForagingSpotUpdate(BaseModel):
    """Request body for updating a foraging spot."""

    type: str | None = Field(default=None, min_length=1, max_length=100)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    notes: str | None = Field(default=None, max_length=1000)
    months: list[str] | None = Field(default=None, min_length=1, max_length=12)
    date: str | None = Field(default=None, max_length=50)

    def model_post_init(self, _context: object) -> None:
        """Validate and deduplicate months after init."""
        if self.months is not None:
            object.__setattr__(self, "months", _validate_and_sort_months(self.months))


class ForagingTypeResponse(BaseModel):
    """Foraging type data returned by the API."""

    name: str
    icon: str = ""
    color: str = ""
    swedish_name: str = ""
    description: str = ""
    season: str = ""
    usage: str = ""
    image_file: str = ""


class ForagingTypeCreate(BaseModel):
    """Request body for creating a foraging type."""

    name: str = Field(min_length=1, max_length=100)
    icon: str = Field(min_length=1, max_length=10)
    color: str = ""
    swedish_name: str = ""
    description: str = ""
    season: str = ""
    usage: str = ""
    image_file: str = ""


class ForagingTypeUpdate(BaseModel):
    """Request body for updating a foraging type."""

    icon: str | None = Field(default=None, min_length=1, max_length=10)
    color: str | None = Field(default=None, max_length=50)
    swedish_name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    season: str | None = Field(default=None, max_length=100)
    usage: str | None = Field(default=None, max_length=200)
    image_file: str | None = Field(default=None, max_length=200)
