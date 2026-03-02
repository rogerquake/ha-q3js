"""Base entity for Q3JS."""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import Q3JSCoordinator
from .const import DOMAIN


class Q3JSEntity(CoordinatorEntity[Q3JSCoordinator]):
    """Shared base for all Q3JS entities."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: Q3JSCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Q3JS - Quake III Arena",
            manufacturer="ioquake3 / q3js",
            model="Dedicated Server",
            configuration_url=(
                f"http://{entry.data[CONF_HOST]}:{entry.data[CONF_PORT]}"
            ),
        )
