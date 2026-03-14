"""Q3JS - Quake III Arena integration."""
from __future__ import annotations

import hashlib
import logging
from datetime import timedelta
from pathlib import Path

import aiohttp
import async_timeout

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PORT, Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)
PLATFORMS: list[Platform] = [Platform.BINARY_SENSOR, Platform.SENSOR]

_CARD_SRC = Path(__file__).parent / "www" / "q3js-card.js"
_CARD_URL_PATH = "/q3js_files"


def _card_version() -> str:
    try:
        return hashlib.md5(_CARD_SRC.read_bytes()).hexdigest()[:8]
    except Exception:
        return "1"


CARD_URL = f"{_CARD_URL_PATH}/q3js-card.js?v={_card_version()}"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register static path and Lovelace resource for the Q3JS card."""
    import json
    import uuid

    # Serve the www/ directory at /q3js_files/ — same pattern as sipcore /sip_core_files/
    hass.http.register_static_path(
        _CARD_URL_PATH,
        str(_CARD_SRC.parent),
        cache_headers=False,
    )

    # Write into lovelace_resources storage
    def _register() -> None:
        storage_path = Path(hass.config.config_dir) / ".storage" / "lovelace_resources"
        if storage_path.exists():
            try:
                data = json.loads(storage_path.read_text())
            except Exception:
                data = {"version": 1, "minor_version": 1, "key": "lovelace_resources", "data": {"items": []}}
        else:
            data = {"version": 1, "minor_version": 1, "key": "lovelace_resources", "data": {"items": []}}

        items: list[dict] = data.get("data", {}).get("items", [])
        if any(i.get("url") == CARD_URL for i in items):
            return
        items = [i for i in items if "q3js-card.js" not in i.get("url", "")]
        items.append({"id": uuid.uuid4().hex, "type": "module", "url": CARD_URL})
        data["data"]["items"] = items
        storage_path.write_text(json.dumps(data, indent=4))

    await hass.async_add_executor_job(_register)
    _LOGGER.info("Q3JS card registered at %s", CARD_URL)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Q3JS from a config entry."""
    coordinator = Q3JSCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    if unload_ok := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok


class Q3JSCoordinator(DataUpdateCoordinator):
    """Polls the Q3JS metrics server every 10 seconds."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=10),
        )
        self._url = f"http://{entry.data[CONF_HOST]}:{entry.data[CONF_PORT]}/api/metrics"
        self.entry = entry

    async def _async_update_data(self) -> dict:
        try:
            async with async_timeout.timeout(8):
                async with aiohttp.ClientSession() as session:
                    async with session.get(self._url) as resp:
                        resp.raise_for_status()
                        return await resp.json()
        except Exception as err:
            raise UpdateFailed(f"Q3JS metrics fetch failed: {err}") from err
