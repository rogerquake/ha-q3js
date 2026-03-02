"""Sensor platform for Q3JS."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTime
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

    async_add_entities([
        Q3JSMapSensor(coordinator, entry),
        Q3JSTimeSensor(coordinator, entry),
    ])

    known: set[str] = set()

    def _add_player_sensors() -> None:
        new = []
        for player in (coordinator.data or {}).get("leaderboard", []):
            name = player["name"]
            if name not in known:
                known.add(name)
                new.append(Q3JSFragSensor(coordinator, entry, name))
        if new:
            async_add_entities(new)

    coordinator.async_add_listener(_add_player_sensors)


class Q3JSMapSensor(Q3JSEntity, SensorEntity):
    """Current map name."""

    _attr_icon = "mdi:map"
    _attr_name = "Current Map"

    def __init__(self, coordinator: Q3JSCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_map_name"

    @property
    def native_value(self) -> str:
        return (self.coordinator.data or {}).get("map_name", "unknown")


class Q3JSTimeSensor(Q3JSEntity, SensorEntity):
    """Elapsed match time in seconds."""

    _attr_icon = "mdi:timer-outline"
    _attr_name = "Match Time"
    _attr_native_unit_of_measurement = UnitOfTime.SECONDS
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: Q3JSCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_match_time"

    @property
    def native_value(self) -> int:
        return (self.coordinator.data or {}).get("match_time_seconds", 0)

    @property
    def extra_state_attributes(self) -> dict:
        data = self.coordinator.data or {}
        return {
            "formatted": data.get("match_time_formatted", "00:00"),
            "match_active": data.get("match_active", False),
        }


class Q3JSFragSensor(Q3JSEntity, SensorEntity):
    """Frag count for one player — created dynamically as players join."""

    _attr_icon = "mdi:skull-outline"
    _attr_native_unit_of_measurement = "frags"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(
        self,
        coordinator: Q3JSCoordinator,
        entry: ConfigEntry,
        player_name: str,
    ) -> None:
        super().__init__(coordinator, entry)
        self._player = player_name
        slug = player_name.lower().replace(" ", "_")
        self._attr_unique_id = f"{entry.entry_id}_frags_{slug}"
        self._attr_name = f"{player_name} Frags"

    @property
    def native_value(self) -> int:
        for p in (self.coordinator.data or {}).get("leaderboard", []):
            if p["name"] == self._player:
                return p.get("frags", 0)
        return 0

    @property
    def extra_state_attributes(self) -> dict:
        for p in (self.coordinator.data or {}).get("leaderboard", []):
            if p["name"] == self._player:
                return {"player_name": self._player, "deaths": p.get("deaths", 0)}
        return {"player_name": self._player}
