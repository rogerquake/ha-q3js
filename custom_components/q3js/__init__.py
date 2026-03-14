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


def _card_version() -> str:
    try:
        return hashlib.md5(_CARD_SRC.read_bytes()).hexdigest()[:8]
    except Exception:
        return "1"


def _sync_setup_card(config_dir: str) -> str:
    """Copy card JS to /config/www/ and register in lovelace_resources. Returns the URL."""
    import json
    import shutil
    import uuid

    # Copy JS to www so it's served at /local/q3js-card.js
    www_dir = Path(config_dir) / "www"
    www_dir.mkdir(exist_ok=True)
    shutil.copy2(str(_CARD_SRC), str(www_dir / "q3js-card.js"))

    card_url = f"/local/q3js-card.js?v={_card_version()}"

    # Write into lovelace_resources storage
    storage_path = Path(config_dir) / ".storage" / "lovelace_resources"
    if storage_path.exists():
        try:
            data = json.loads(storage_path.read_text())
        except Exception:
            data = {"version": 1, "minor_version": 1, "key": "lovelace_resources", "data": {"items": []}}
    else:
        data = {"version": 1, "minor_version": 1, "key": "lovelace_resources", "data": {"items": []}}

    items: list[dict] = data.get("data", {}).get("items", [])

    # Already registered with same URL — skip
    if any(i.get("url") == card_url for i in items):
        return card_url

    # Remove stale entries
    items = [i for i in items if "q3js-card.js" not in i.get("url", "")]
    items.append({"id": uuid.uuid4().hex, "type": "module", "url": card_url})
    data["data"]["items"] = items
    storage_path.write_text(json.dumps(data, indent=4))

    return card_url


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Copy card JS to www and register as Lovelace resource."""
    card_url = await hass.async_add_executor_job(_sync_setup_card, hass.config.config_dir)
    _LOGGER.info("Q3JS card registered: %s", card_url)
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
