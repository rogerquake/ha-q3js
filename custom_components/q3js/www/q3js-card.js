class Q3JSCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._launched = false;
  }

  static getConfigElement() {
    return document.createElement("q3js-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:q3js-card",
      title: "Quake III Arena",
      server_host: window.location.hostname,
      web_port: 8443,
      connect_server: "",
      entity_prefix: "q3js",
      show_map: true,
      show_time: true,
      show_leaderboard: true,
      show_players: true,
      height: 600,
    };
  }

  setConfig(config) {
    this._config = {
      server_host: window.location.hostname,
      web_port: 8443,
      connect_server: "",
      entity_prefix: "q3js",
      show_map: true,
      show_time: true,
      show_leaderboard: true,
      show_players: true,
      height: 600,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateUI();
  }

  disconnectedCallback() {}

  _render() {
    const c = this._config;
    const height = c.height || 600;
    const showLb = c.show_leaderboard !== false;
    const showMap = c.show_map !== false;
    const showTime = c.show_time !== false;
    const showPlayers = c.show_players !== false;
    const showFooter = showMap || showTime;

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}ha-card{background:#0a0a14;overflow:hidden}
        .header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;font-family:monospace;font-size:1em;letter-spacing:2px;text-transform:uppercase;color:#ff6600;border-bottom:1px solid #1e1e2e}
        .dot{width:9px;height:9px;border-radius:50%;background:#333;transition:all .4s}
        .dot.on{background:#22ff44;box-shadow:0 0 6px #22ff44}
        .wrap{position:relative;width:100%;height:${height}px;background:#000}
        .frame{width:100%;height:100%;border:none;display:block}
        .hidden{display:none!important}
        .splash{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,#1c0800,#000 70%)}
        .logo{font-family:monospace;font-size:3.5em;font-weight:900;color:#ff6600;text-shadow:0 0 30px #ff4400;letter-spacing:6px;margin-bottom:4px}
        .sub{font-family:monospace;font-size:.72em;color:#884422;letter-spacing:4px;text-transform:uppercase;margin-bottom:28px}
        .play{padding:13px 42px;background:#992200;color:#fff;border:2px solid #ff4400;font-family:monospace;font-size:.9em;letter-spacing:4px;text-transform:uppercase;cursor:pointer;clip-path:polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)}
        .play:hover{background:#ff4400}
        .meta{margin-top:18px;font-family:monospace;font-size:.72em;color:#553322;text-align:center;line-height:1.8}
        .meta span{color:#cc6633}
        .lb{background:#07070f;border-top:1px solid #1a1a2a;padding:10px 16px}
        .lbh{font-family:monospace;font-size:.7em;letter-spacing:3px;color:#ff6600;text-transform:uppercase;margin-bottom:6px}
        .lbrow{display:flex;align-items:center;padding:4px 0;border-bottom:1px solid #111;font-family:monospace;font-size:.82em}
        .rk{color:#444;width:26px;flex-shrink:0}.nm{color:#ccc;flex:1;padding:0 6px;overflow:hidden;text-overflow:ellipsis}
        .fr{color:#ff6600;font-weight:bold;width:38px;text-align:right}.de{color:#555;width:44px;text-align:right;font-size:.85em}
        .empty{color:#333;font-family:monospace;font-size:.78em;padding:6px 0}
        .footer{display:flex;gap:12px;flex-wrap:wrap;padding:7px 16px;background:#04040c;border-top:1px solid #111}
        .chip{font-family:monospace;font-size:.72em;color:#666;display:flex;align-items:center;gap:4px}
        .chip b{color:#cc7733}
        .ctrls{display:flex;gap:6px;flex-wrap:wrap;padding:7px 16px;background:#04040c;border-top:1px solid #0f0f1a}
        button.ctrl{padding:4px 12px;background:#0e0e1a;color:#888;border:1px solid #222;font-family:monospace;font-size:.72em;cursor:pointer;letter-spacing:1px}
        button.ctrl:hover{background:#1a1a2e;color:#ff6600;border-color:#ff4400}
        .refocus{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);color:#ff6600;font-family:monospace;font-size:1.1em;letter-spacing:3px;cursor:pointer;z-index:10}
        .refocus:hover{background:rgba(0,0,0,0.7)}
      </style>
      <ha-card>
        <div class="header">
          <div>⚡ ${this._esc(c.title || "Quake III Arena")}</div>
          <div class="dot" id="dot"></div>
        </div>
        <div class="wrap">
          <div class="splash" id="splash">
            <div class="logo">Q3JS</div>
            <div class="sub">Quake III Arena</div>
            <button class="play" id="playBtn">▶ PLAY</button>
            <div class="meta">
              Server <span>${this._esc(c.server_host || window.location.hostname)}:${c.web_port || 8443}</span>
            </div>
          </div>
          <iframe class="frame hidden" id="frame" allow="autoplay;fullscreen;pointer-lock" allowfullscreen></iframe>
          <div class="refocus hidden" id="refocus">🖱 Click to resume</div>
        </div>
        ${showLb ? `<div class="lb"><div class="lbh">🏆 ${showPlayers ? "Leaderboard" : "Match"}</div><div id="lbRows"><div class="empty">Waiting for match data…</div></div></div>` : ""}
        ${showFooter ? `
        <div class="footer">
          ${showMap ? `<div class="chip">🗺 <b id="fMap">–</b></div>` : ""}
          ${showTime ? `<div class="chip">⏱ <b id="fTime">--:--</b></div>` : ""}
          <div class="chip" id="fStatus">🔴 <b>Idle</b></div>
        </div>` : ""}
        <div class="ctrls">
          <button class="ctrl" id="btnFs">⛶ Fullscreen</button>
          <button class="ctrl" id="btnDisc">✕ Disconnect</button>
        </div>
      </ha-card>`;

    this.shadowRoot.getElementById("playBtn").addEventListener("click", () => this._launch());
    this.shadowRoot.getElementById("refocus").addEventListener("click", () => this._refocus());
    this.shadowRoot.getElementById("btnFs").addEventListener("click", () => this._fullscreen());
    this.shadowRoot.getElementById("btnDisc").addEventListener("click", () => this._disconnect());

    // blur = iframe took focus (game active) → hide overlay
    // focus = parent got focus back (user clicked HA) → show overlay
    window.addEventListener("blur", () => {
      if (!this._launched) return;
      const refocus = this.shadowRoot.getElementById("refocus");
      if (refocus) refocus.classList.add("hidden");
    });
    window.addEventListener("focus", () => {
      if (!this._launched) return;
      const refocus = this.shadowRoot.getElementById("refocus");
      if (refocus) refocus.classList.remove("hidden");
    });

    // Re-run updateUI in case hass is already available
    if (this._hass) this._updateUI();
  }

  _launch() {
    const c = this._config;
    const host = c.server_host || window.location.hostname;
    const webPort = c.web_port || 8443;
    const base = c.game_url || `https://${host}:${webPort}`;
    const connectTarget = c.connect_server || "";
    const src = connectTarget
      ? `${base}?${encodeURIComponent("+connect " + connectTarget)}`
      : base;
    this.shadowRoot.getElementById("frame").src = src;
    this.shadowRoot.getElementById("splash").classList.add("hidden");
    this.shadowRoot.getElementById("frame").classList.remove("hidden");
    this._launched = true;
    const refocus = this.shadowRoot.getElementById("refocus");
    if (refocus) refocus.classList.add("hidden");
  }

  _fullscreen() {
    const f = this.shadowRoot.getElementById("frame");
    if (f && this._launched && f.requestFullscreen) f.requestFullscreen();
  }

  _disconnect() {
    this.shadowRoot.getElementById("frame").src = "about:blank";
    this.shadowRoot.getElementById("frame").classList.add("hidden");
    this.shadowRoot.getElementById("splash").classList.remove("hidden");
    this._launched = false;
    this._setActive(false);
  }

  _refocus() {
    const frame = this.shadowRoot.getElementById("frame");
    const refocus = this.shadowRoot.getElementById("refocus");
    if (refocus) refocus.classList.add("hidden");
    if (frame) {
      frame.focus();
      frame.contentWindow && frame.contentWindow.focus();
    }
  }

  _updateUI() {
    const hass = this._hass;
    if (!hass) return;
    const prefix = this._config.entity_prefix || "q3js";
    const showPlayers = this._config.show_players !== false;
    const showMap = this._config.show_map !== false;
    const showTime = this._config.show_time !== false;
    const showLb = this._config.show_leaderboard !== false;

    // Read from HA entity states
    const mapState = hass.states[`sensor.${prefix}_current_map`];
    const timeState = hass.states[`sensor.${prefix}_match_time`];
    const activeState = hass.states[`binary_sensor.${prefix}_match_active`];

    const mapName = mapState ? mapState.state : "–";
    const matchActive = activeState ? activeState.state === "on" : false;
    const timeFormatted = timeState ? (timeState.attributes.formatted || "00:00") : "00:00";

    this._setActive(matchActive);

    if (showMap) {
      const fMap = this.shadowRoot.getElementById("fMap");
      if (fMap) fMap.textContent = mapName;
    }
    if (showTime) {
      const fTime = this.shadowRoot.getElementById("fTime");
      if (fTime) fTime.textContent = timeFormatted;
    }
    const fStatus = this.shadowRoot.getElementById("fStatus");
    if (fStatus) fStatus.innerHTML = matchActive ? "🟢 <b>Active</b>" : "🔴 <b>Idle</b>";

    if (showLb) {
      const lbRows = this.shadowRoot.getElementById("lbRows");
      if (!lbRows) return;

      if (showPlayers) {
        // Scan hass states for player frag sensors
        const fragPattern = new RegExp(`^sensor\\.${prefix}_(.+)_frags$`);
        const players = Object.entries(hass.states)
          .filter(([id]) => fragPattern.test(id))
          .map(([id, state]) => ({
            name: state.attributes.player_name || id.replace(fragPattern, "$1").replace(/_/g, " "),
            frags: parseInt(state.state) || 0,
            deaths: state.attributes.deaths || 0,
          }))
          .sort((a, b) => b.frags - a.frags);

        lbRows.innerHTML = players.length
          ? players.map((p, i) => `
              <div class="lbrow">
                <span class="rk">#${i + 1}</span>
                <span class="nm">${this._esc(p.name)}</span>
                <span class="fr">${p.frags}</span>
                <span class="de">${p.deaths}💀</span>
              </div>`).join("")
          : `<div class="empty">No players yet…</div>`;
      } else {
        // show_leaderboard true but show_players false — just show map/status summary
        lbRows.innerHTML = `<div class="empty" style="color:#555">${matchActive ? "Match in progress" : "Waiting for match…"}</div>`;
      }
    }
  }

  _setActive(on) {
    const d = this.shadowRoot.getElementById("dot");
    if (d) d.classList.toggle("on", on);
  }

  _esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  getCardSize() {
    return Math.ceil((this._config.height || 600) / 50) + 4;
  }
}

class Q3JSCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }

  _render() {
    const c = this._config;
    const chk = (key) => c[key] !== false ? "checked" : "";
    this.innerHTML = `
      <style>
        .row{margin-bottom:10px}
        label{display:block;font-size:.8em;color:var(--secondary-text-color);margin-bottom:3px}
        input[type=text],input[type=number]{width:100%;padding:6px 8px;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box}
        .toggles{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px}
        .toggle{display:flex;align-items:center;gap:6px;font-size:.82em;color:var(--primary-text-color);cursor:pointer}
        .toggle input{width:auto}
        .section{font-size:.75em;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;border-bottom:1px solid var(--divider-color);padding-bottom:4px}
      </style>
      <div style="padding:12px">
        <div class="section">Connection</div>
        <div class="row"><label>Title</label><input type="text" id="title" value="${c.title || ""}"></div>
        <div class="row"><label>Server Host (web client)</label><input type="text" id="server_host" value="${c.server_host || window.location.hostname}"></div>
        <div class="row"><label>Web Client Port (HTTPS)</label><input type="number" id="web_port" value="${c.web_port || 8443}"></div>
        <div class="row"><label>Connect Server (host:wsport)</label><input type="text" id="connect_server" value="${c.connect_server || ""}"></div>

        <div class="section">Integration</div>
        <div class="row"><label>Entity Prefix</label><input type="text" id="entity_prefix" value="${c.entity_prefix || "q3js"}"></div>

        <div class="section">Display</div>
        <div class="row"><label>Card Height (px)</label><input type="number" id="height" value="${c.height || 600}"></div>
        <div class="toggles">
          <label class="toggle"><input type="checkbox" id="show_map" ${chk("show_map")}> Show Map Name</label>
          <label class="toggle"><input type="checkbox" id="show_time" ${chk("show_time")}> Show Match Time</label>
          <label class="toggle"><input type="checkbox" id="show_leaderboard" ${chk("show_leaderboard")}> Show Leaderboard</label>
          <label class="toggle"><input type="checkbox" id="show_players" ${chk("show_players")}> Show Players</label>
        </div>
      </div>`;

    this.querySelectorAll("input[type=text],input[type=number]")
      .forEach(el => el.addEventListener("change", () => this._fire()));
    this.querySelectorAll("input[type=checkbox]")
      .forEach(el => el.addEventListener("change", () => this._fire()));
  }

  _fire() {
    const get = id => this.querySelector(`#${id}`).value;
    const num = id => parseInt(get(id), 10) || 0;
    const chk = id => this.querySelector(`#${id}`).checked;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: {
        config: {
          ...this._config,
          title: get("title"),
          server_host: get("server_host"),
          web_port: num("web_port"),
          connect_server: get("connect_server"),
          entity_prefix: get("entity_prefix"),
          height: num("height"),
          show_map: chk("show_map"),
          show_time: chk("show_time"),
          show_leaderboard: chk("show_leaderboard"),
          show_players: chk("show_players"),
        },
      },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define("q3js-card", Q3JSCard);
customElements.define("q3js-card-editor", Q3JSCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: "q3js-card", name: "Q3JS – Quake III Arena", description: "Play Quake III Arena in your dashboard with live match stats.", preview: true });
console.info("%c Q3JS CARD %c loaded", "background:#ff6600;color:#000;font-weight:bold;padding:2px 4px;", "background:#111;color:#ff6600;padding:2px 4px;");
