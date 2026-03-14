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

# HACS serves custom_components/q3js/www/ at /hacsfiles/q3js/
# Use an MD5 hash of the JS as the hacstag for cache-busting
_CARD_SRC = Path(__file__).parent / "www" / "q3js-card.js"

def _hacstag() -> str:
    try:
        return hashlib.md5(_CARD_SRC.read_bytes()).hexdigest()[:12]
    except Exception:
        return "1"

CARD_URL = f"/hacsfiles/ha-q3js/q3js-card.js?hacstag={_hacstag()}"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register Q3JS Lovelace card as a proper Lovelace resource."""
    hass.async_create_task(_async_register_resource(hass))
    return True


async def _async_register_resource(hass: HomeAssistant) -> None:
    """Add the card JS to lovelace_resources storage so it appears in the Resources UI."""
    import uuid
    from homeassistant.helpers.storage import Store

    store = Store(hass, 1, "lovelace_resources")
    data = await store.async_load() or {"items": []}
    items: list[dict] = data.get("items", [])

    # Remove any stale q3js-card entries (different hacstag / old path)
    items = [i for i in items if "q3js-card.js" not in i.get("url", "")]

    items.append({"id": str(uuid.uuid4()), "type": "module", "url": CARD_URL})
    data["items"] = items
    await store.async_save(data)
    _LOGGER.info("Q3JS card registered in lovelace_resources: %s", CARD_URL)


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
