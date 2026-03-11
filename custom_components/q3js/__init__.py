"""Q3JS - Quake III Arena integration."""
from __future__ import annotations

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

CARD_URL = "/q3js/q3js-card.js"
CARD_PATH = Path(__file__).parent / "www" / "q3js-card.js"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register card JS as static resource and inject into Lovelace."""
    # Register static file path
    from homeassistant.components.http import StaticPathConfig
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(CARD_PATH), False)]
    )

    # Auto-register as Lovelace resource so no manual step needed
    await _register_lovelace_resource(hass, CARD_URL)
    return True


async def _register_lovelace_resource(hass: HomeAssistant, url: str) -> None:
    """Add the card JS to Lovelace resources if not already present."""
    try:
        await hass.async_block_till_done()
        lovelace = hass.data.get("lovelace")
        if lovelace is None:
            _LOGGER.warning("Q3JS: Lovelace not ready, card must be added as resource manually: %s", url)
            return

        resources = lovelace.get("resources")
        if resources is None:
            _LOGGER.warning("Q3JS: Lovelace resources collection not available")
            return

        await resources.async_load()
        existing = [r["url"] for r in resources.async_items()]
        if url in existing:
            _LOGGER.debug("Q3JS card resource already registered")
            return

        await resources.async_create_item({"res_type": "module", "url": url})
        _LOGGER.info("Q3JS card registered as Lovelace resource: %s", url)

    except Exception as err:
        _LOGGER.warning("Q3JS could not auto-register Lovelace resource (%s) — add %s manually in Settings → Dashboards → Resources", err, url)


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
