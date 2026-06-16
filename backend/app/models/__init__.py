"""ORM models — import all so Alembic autogenerate sees them."""

from app.models.area import Area  # noqa: F401
from app.models.custom_field import CustomFieldDef, CustomFieldValue  # noqa: F401
from app.models.house import House, HouseMember  # noqa: F401
from app.models.item import Item  # noqa: F401
from app.models.item_photo import ItemPhoto  # noqa: F401
from app.models.llm_backend import LlmBackend  # noqa: F401
from app.models.system_setting import SystemSetting  # noqa: F401
from app.models.user import User  # noqa: F401
