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

CARD_URL = f"/hacsfiles/q3js/q3js-card.js?hacstag={_hacstag()}"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register Q3JS Lovelace card as a proper Lovelace resource."""
    hass.async_create_task(_async_register_resource(hass))
    return True


async def _async_register_resource(hass: HomeAssistant) -> None:
    """Add the card JS to Lovelace resources so it appears in the Resources UI."""
    try:
        from homeassistant.components.lovelace import ResourceStorageCollection  # type: ignore[attr-defined]
    except ImportError:
        # Fallback for older HA versions
        from homeassistant.components.frontend import add_extra_js_url
        add_extra_js_url(hass, CARD_URL)
        _LOGGER.info("Q3JS card registered via add_extra_js_url at %s", CARD_URL)
        return

    # Wait for lovelace to be ready
    await hass.async_block_till_done()

    try:
        lovelace = hass.data.get("lovelace")
        if lovelace is None:
            raise RuntimeError("lovelace not in hass.data")

        resources: ResourceStorageCollection = lovelace["resources"]
        await resources.async_load()

        # Check if already registered (any entry pointing at our hacsfiles path)
        existing = [
            r for r in resources.async_items()
            if "q3js-card.js" in r.get("url", "")
        ]

        if existing:
            # Update URL in place (handles hacstag changes on upgrade)
            for r in existing:
                await resources.async_update_item(r["id"], {"url": CARD_URL, "res_type": "module"})
            _LOGGER.info("Q3JS card resource updated to %s", CARD_URL)
        else:
            await resources.async_create_item({"url": CARD_URL, "res_type": "module"})
            _LOGGER.info("Q3JS card resource created at %s", CARD_URL)

    except Exception as err:
        # Never block setup — fall back to add_extra_js_url
        _LOGGER.warning("Could not register Lovelace resource (%s), falling back", err)
        from homeassistant.components.frontend import add_extra_js_url
        add_extra_js_url(hass, CARD_URL)


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
