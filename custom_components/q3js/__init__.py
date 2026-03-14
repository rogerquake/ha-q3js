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


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Q3JS from a config entry."""
    # Register static path and Lovelace resource on first entry setup
    try:
        hass.http.register_static_path(
            _CARD_URL_PATH,
            str(_CARD_SRC.parent),
            cache_headers=False,
        )
        _LOGGER.info("Q3JS static path registered: %s", _CARD_URL_PATH)
    except Exception as err:
        _LOGGER.debug("Q3JS static path already registered: %s", err)

    await _async_add_resource(hass)

    coordinator = Q3JSCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _async_add_resource(hass: HomeAssistant) -> None:
    """Add card JS to Lovelace resources via live lovelace collection."""
    import uuid

    _LOGGER.warning("Q3JS: attempting to register Lovelace resource: %s", CARD_URL)

    try:
        # Access the live in-memory resource collection that the UI reads from
        lovelace = hass.data.get("lovelace")
        if lovelace is None:
            raise RuntimeError("lovelace not in hass.data yet")

        resources = lovelace.get("resources")
        if resources is None:
            raise RuntimeError("lovelace resources collection not available")

        await resources.async_load()
        existing = resources.async_items()
        _LOGGER.warning("Q3JS: existing resources: %s", [i.get("url") for i in existing])

        # Remove stale entries
        for item in list(resources.async_items()):
            if "q3js-card.js" in item.get("url", ""):
                await resources.async_delete_item(item["id"])
                _LOGGER.warning("Q3JS: removed stale resource %s", item.get("url"))

        await resources.async_create_item({"res_type": "module", "url": CARD_URL})
        _LOGGER.warning("Q3JS: resource registered successfully: %s", CARD_URL)

    except Exception as err:
        _LOGGER.warning("Q3JS: live collection failed (%s), falling back to storage write", err)
        # Fallback: write directly to storage file
        import json, uuid as _uuid
        from pathlib import Path as _Path
        storage_path = _Path(hass.config.config_dir) / ".storage" / "lovelace_resources"
        try:
            raw = json.loads(storage_path.read_text()) if storage_path.exists() else {}
        except Exception:
            raw = {}
        raw.setdefault("version", 1)
        raw.setdefault("minor_version", 1)
        raw.setdefault("key", "lovelace_resources")
        raw.setdefault("data", {}).setdefault("items", [])
        items = raw["data"]["items"]
        items = [i for i in items if "q3js-card.js" not in i.get("url", "")]
        items.append({"id": _uuid.uuid4().hex, "type": "module", "url": CARD_URL})
        raw["data"]["items"] = items
        storage_path.write_text(json.dumps(raw, indent=4))
        _LOGGER.warning("Q3JS: wrote to storage file directly: %s", CARD_URL)


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
