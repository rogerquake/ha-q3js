"""Binary sensor platform for Q3JS."""
from __future__ import annotations

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import Q3JSCoordinator
from .const import DOMAIN
from .entity import Q3JSEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: Q3JSCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([Q3JSMatchActiveSensor(coordinator, entry)])


class Q3JSMatchActiveSensor(Q3JSEntity, BinarySensorEntity):
    """On when a match is currently running."""

    _attr_device_class = BinarySensorDeviceClass.RUNNING
    _attr_icon = "mdi:gamepad-variant-outline"
    _attr_name = "Match Active"

    def __init__(self, coordinator: Q3JSCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_match_active"

    @property
    def is_on(self) -> bool:
        return bool((self.coordinator.data or {}).get("match_active", False))
