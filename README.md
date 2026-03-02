# Q3JS – Quake III Arena for Home Assistant

[![GitHub Release](https://img.shields.io/github/release/YOUR_GITHUB_USER/ha-q3js.svg)](https://github.com/YOUR_GITHUB_USER/ha-q3js/releases)
[![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

Home Assistant custom integration and Lovelace card for [Q3JS](https://github.com/lklacar/q3js) — Quake III Arena compiled to WebAssembly.

> **Requires the Q3JS add-on** to be installed and running first:
> `https://github.com/rogerquake/ha-q3js-addon`

---

## Installation

### Step 1 — Install the add-on

Install and start the Q3JS add-on from the companion repo:
`https://github.com/rogerquake/ha-q3js-addon`

### Step 2 — Install this integration via HACS

1. Open **HACS → Integrations → ⋮ → Custom repositories**
2. Add `https://github.com/rogerquake/ha-q3js` as **Integration**
3. Search for **Q3JS** and install it
4. Restart Home Assistant
5. Go to **Settings → Devices & Services → Add Integration → Q3JS**
6. Enter `homeassistant.local` and port `8090`

### Step 3 — Add the Lovelace card

Edit any dashboard and add a custom card:

```yaml
type: custom:q3js-card
title: "Quake III Arena"
server_host: "homeassistant.local"
ws_port: 27961
metrics_url: "http://homeassistant.local:8090/api/metrics"
map_name: q3dm17
frag_limit: 30
bots:
  - name: Keel
    skill: 3
  - name: Sarge
    skill: 3
auto_spectate: true
spectator_name: HA_Spectator
show_leaderboard: true
height: 600
```

---

## Card YAML reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `server_host` | string | HA hostname | Host running the Q3JS add-on |
| `ws_port` | int | `27961` | WebSocket proxy port |
| `metrics_url` | string | auto | Metrics API URL |
| `map_name` | string | `q3dm17` | Map name |
| `frag_limit` | int | `30` | Frag limit |
| `bots` | list | `[]` | `[{name, skill}]` — skill 1–5 |
| `auto_spectate` | bool | `true` | Auto-join as spectator |
| `spectator_name` | string | `HA_Spectator` | Spectator display name |
| `show_leaderboard` | bool | `true` | Show live leaderboard |
| `height` | int | `600` | Game iframe height (px) |
| `title` | string | – | Card header title |
| `game_url` | string | q3js.com | Override game client URL |

---

## Entities

| Entity | Description |
|--------|-------------|
| `sensor.q3js_current_map` | Current map name |
| `sensor.q3js_match_time` | Elapsed match time (seconds) |
| `binary_sensor.q3js_match_active` | Whether a match is running |
| `sensor.q3js_<player>_frags` | Per-player frag count (auto-created) |

---

## Example automation

```yaml
automation:
  - alias: "Gaming lights on"
    triggers:
      - trigger: state
        entity_id: binary_sensor.q3js_match_active
        to: "on"
    actions:
      - action: light.turn_on
        target:
          entity_id: light.office
        data:
          rgb_color: [200, 50, 0]
          brightness: 255
```

---

## Legal

Quake III Arena © id Software / Bethesda. Supply your own `pak*.pk3` files.
Not affiliated with id Software or ZeniMax Media.
