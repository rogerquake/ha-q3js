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

    # Serve www/ at /q3js_files/
    try:
        hass.http.register_static_path(
            _CARD_URL_PATH,
            str(_CARD_SRC.parent),
            cache_headers=False,
        )
        _LOGGER.info("Q3JS static path registered: %s", _CARD_URL_PATH)
    except Exception as err:
        _LOGGER.warning("Q3JS static path already registered: %s", err)

    # Register via lovelace component resource collection (updates memory + storage)
    hass.async_create_task(_async_add_resource(hass))
    return True


async def _async_add_resource(hass: HomeAssistant) -> None:
    """Add card to Lovelace resources via the live collection."""
    import uuid

    # Wait for lovelace component to finish loading
    if not await hass.components.lovelace.async_setup():
        pass  # already set up is fine

    try:
        resources = hass.data["lovelace"]["resources"]
        await resources.async_load()

        current_urls = [item["url"] for item in resources.async_items()]
        _LOGGER.info("Q3JS existing resource URLs: %s", current_urls)

        # Remove stale, add current
        for item in list(resources.async_items()):
            if "q3js-card.js" in item.get("url", ""):
                await resources.async_delete_item(item["id"])

        await resources.async_create_item({
            "res_type": "module",
            "url": CARD_URL,
        })
        _LOGGER.info("Q3JS card added to Lovelace resources: %s", CARD_URL)

    except Exception as err:
        _LOGGER.error("Q3JS failed to add Lovelace resource: %s", err)


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
