"""Config flow for Q3JS."""
from __future__ import annotations

import aiohttp
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT

from .const import CONF_CONNECT_SERVER, DEFAULT_CONNECT_SERVER, DEFAULT_PORT, DOMAIN


class Q3JSConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Q3JS."""

    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None):
        errors: dict[str, str] = {}

        if user_input is not None:
            host = user_input[CONF_HOST]
            port = user_input[CONF_PORT]
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"http://{host}:{port}/api/health",
                        timeout=aiohttp.ClientTimeout(total=5),
                    ) as resp:
                        if resp.status != 200:
                            errors["base"] = "cannot_connect"
            except Exception:
                errors["base"] = "cannot_connect"

            if not errors:
                await self.async_set_unique_id(f"{DOMAIN}_{host}_{port}")
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=f"Q3JS @ {host}",
                    data={CONF_HOST: host, CONF_PORT: port, CONF_CONNECT_SERVER: user_input.get(CONF_CONNECT_SERVER, DEFAULT_CONNECT_SERVER)},
                )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_HOST, default="homeassistant.local"): str,
                vol.Required(CONF_PORT, default=DEFAULT_PORT): int,
                vol.Optional(CONF_CONNECT_SERVER, default=DEFAULT_CONNECT_SERVER): str,
            }),
            errors=errors,
        )
