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
      auto_launch: false,
      auto_spectate: false,
      spectator_name: "HA_Spectator",
      theme: "dark",
      show_header: true,
      show_controls: true,
      show_map: true,
      show_time: true,
      show_leaderboard: true,
      show_players: true,
      accent_color: "",
      card_background: "",
      height: 600,
    };
  }

  setConfig(config) {
    this._config = {
      server_host: window.location.hostname,
      web_port: 8443,
      connect_server: "",
      entity_prefix: "q3js",
      auto_launch: false,
      auto_spectate: false,
      spectator_name: "HA_Spectator",
      theme: "dark",
      show_header: true,
      show_controls: true,
      show_map: true,
      show_time: true,
      show_leaderboard: true,
      show_players: true,
      accent_color: "",
      card_background: "",
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

  _css() {
    const c = this._config;
    const accent = c.accent_color || "#ff6600";
    const accentDim = c.accent_color || "#992200";
    const accentBright = c.accent_color || "#ff4400";
    const theme = c.theme || "dark";

    // Per-theme base styles
    const themes = {
      dark: {
        cardBg: c.card_background || "#0a0a14",
        headerBg: "transparent",
        footerBg: "#04040c",
        lbBg: "#07070f",
        ctrlBg: "#04040c",
        ctrlBtnBg: "#0e0e1a",
        ctrlBtnHover: "#1a1a2e",
        borderColor: "#1e1e2e",
        footerBorder: "#111",
        lbBorder: "#1a1a2a",
        rowBorder: "#111",
        textColor: "#ccc",
        mutedColor: "#666",
        rankColor: "#444",
        deathColor: "#555",
        emptyColor: "#333",
        ctrlColor: "#888",
        ctrlBorder: "#222",
      },
      minimal: {
        cardBg: c.card_background || "var(--ha-card-background, var(--card-background-color))",
        headerBg: "transparent",
        footerBg: "var(--secondary-background-color)",
        lbBg: "var(--secondary-background-color)",
        ctrlBg: "var(--secondary-background-color)",
        ctrlBtnBg: "var(--card-background-color)",
        ctrlBtnHover: "var(--primary-background-color)",
        borderColor: "var(--divider-color)",
        footerBorder: "var(--divider-color)",
        lbBorder: "var(--divider-color)",
        rowBorder: "var(--divider-color)",
        textColor: "var(--primary-text-color)",
        mutedColor: "var(--secondary-text-color)",
        rankColor: "var(--secondary-text-color)",
        deathColor: "var(--secondary-text-color)",
        emptyColor: "var(--secondary-text-color)",
        ctrlColor: "var(--secondary-text-color)",
        ctrlBorder: "var(--divider-color)",
      },
      transparent: {
        cardBg: c.card_background || "transparent",
        headerBg: "transparent",
        footerBg: "transparent",
        lbBg: "transparent",
        ctrlBg: "transparent",
        ctrlBtnBg: "rgba(0,0,0,0.3)",
        ctrlBtnHover: "rgba(0,0,0,0.5)",
        borderColor: "rgba(255,255,255,0.1)",
        footerBorder: "rgba(255,255,255,0.1)",
        lbBorder: "rgba(255,255,255,0.1)",
        rowBorder: "rgba(255,255,255,0.08)",
        textColor: "var(--primary-text-color)",
        mutedColor: "var(--secondary-text-color)",
        rankColor: "var(--secondary-text-color)",
        deathColor: "var(--secondary-text-color)",
        emptyColor: "var(--secondary-text-color)",
        ctrlColor: "var(--primary-text-color)",
        ctrlBorder: "rgba(255,255,255,0.2)",
      },
    };

    const t = themes[theme] || themes.dark;
    const height = c.height || 600;

    return `
      :host{display:block}
      ha-card{background:${t.cardBg};overflow:hidden}
      .header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;font-family:monospace;font-size:1em;letter-spacing:2px;text-transform:uppercase;color:${accent};border-bottom:1px solid ${t.borderColor};background:${t.headerBg}}
      .dot{width:9px;height:9px;border-radius:50%;background:${t.rankColor};transition:all .4s}
      .dot.on{background:#22ff44;box-shadow:0 0 6px #22ff44}
      .wrap{position:relative;width:100%;height:${height}px;background:#000}
      .frame{width:100%;height:100%;border:none;display:block}
      .hidden{display:none!important}
      .splash{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,#1c0800,#000 70%)}
      .logo{font-family:monospace;font-size:3.5em;font-weight:900;color:${accent};text-shadow:0 0 30px ${accentBright};letter-spacing:6px;margin-bottom:4px}
      .sub{font-family:monospace;font-size:.72em;color:#884422;letter-spacing:4px;text-transform:uppercase;margin-bottom:28px}
      .play{padding:13px 42px;background:${accentDim};color:#fff;border:2px solid ${accentBright};font-family:monospace;font-size:.9em;letter-spacing:4px;text-transform:uppercase;cursor:pointer;clip-path:polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)}
      .play:hover{background:${accentBright}}
      .meta{margin-top:18px;font-family:monospace;font-size:.72em;color:#553322;text-align:center;line-height:1.8}
      .meta span{color:#cc6633}
      .lb{background:${t.lbBg};border-top:1px solid ${t.lbBorder};padding:10px 16px}
      .lbh{font-family:monospace;font-size:.7em;letter-spacing:3px;color:${accent};text-transform:uppercase;margin-bottom:6px}
      .lbrow{display:flex;align-items:center;padding:4px 0;border-bottom:1px solid ${t.rowBorder};font-family:monospace;font-size:.82em}
      .rk{color:${t.rankColor};width:26px;flex-shrink:0}
      .nm{color:${t.textColor};flex:1;padding:0 6px;overflow:hidden;text-overflow:ellipsis}
      .fr{color:${accent};font-weight:bold;width:38px;text-align:right}
      .de{color:${t.deathColor};width:44px;text-align:right;font-size:.85em}
      .empty{color:${t.emptyColor};font-family:monospace;font-size:.78em;padding:6px 0}
      .footer{display:flex;gap:12px;flex-wrap:wrap;padding:7px 16px;background:${t.footerBg};border-top:1px solid ${t.footerBorder}}
      .chip{font-family:monospace;font-size:.72em;color:${t.mutedColor};display:flex;align-items:center;gap:4px}
      .chip b{color:${accent}}
      .ctrls{display:flex;gap:6px;flex-wrap:wrap;padding:7px 16px;background:${t.ctrlBg};border-top:1px solid ${t.footerBorder}}
      button.ctrl{padding:4px 12px;background:${t.ctrlBtnBg};color:${t.ctrlColor};border:1px solid ${t.ctrlBorder};font-family:monospace;font-size:.72em;cursor:pointer;letter-spacing:1px}
      button.ctrl:hover{background:${t.ctrlBtnHover};color:${accent};border-color:${accentBright}}
      .refocus{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);color:${accent};font-family:monospace;font-size:1.1em;letter-spacing:3px;cursor:pointer;z-index:10}
      .refocus:hover{background:rgba(0,0,0,0.7)}
    `;
  }

  _render() {
    const c = this._config;
    const showHeader = c.show_header !== false;
    const showControls = c.show_controls !== false;
    const showLb = c.show_leaderboard !== false;
    const showMap = c.show_map !== false;
    const showTime = c.show_time !== false;
    const showFooter = showMap || showTime;

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        ${showHeader ? `
        <div class="header">
          <div>⚡ ${this._esc(c.title || "Quake III Arena")}</div>
          <div class="dot" id="dot"></div>
        </div>` : `<div class="dot hidden" id="dot"></div>`}
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
        ${showLb ? `<div class="lb"><div class="lbh">🏆 Leaderboard</div><div id="lbRows"><div class="empty">Waiting for match data…</div></div></div>` : ""}
        ${showFooter ? `
        <div class="footer">
          ${showMap ? `<div class="chip">🗺 <b id="fMap">–</b></div>` : ""}
          ${showTime ? `<div class="chip">⏱ <b id="fTime">--:--</b></div>` : ""}
          <div class="chip" id="fStatus">🔴 <b>Idle</b></div>
        </div>` : ""}
        ${showControls ? `
        <div class="ctrls">
          <button class="ctrl" id="btnFs">⛶ Fullscreen</button>
          <button class="ctrl" id="btnDisc">✕ Disconnect</button>
        </div>` : ""}
      </ha-card>`;

    this.shadowRoot.getElementById("playBtn").addEventListener("click", () => this._launch());
    this.shadowRoot.getElementById("refocus").addEventListener("click", () => this._refocus());
    if (showControls) {
      this.shadowRoot.getElementById("btnFs").addEventListener("click", () => this._fullscreen());
      this.shadowRoot.getElementById("btnDisc").addEventListener("click", () => this._disconnect());
    }

    window.addEventListener("blur", () => {
      if (!this._launched) return;
      const r = this.shadowRoot.getElementById("refocus");
      if (r) r.classList.add("hidden");
    });
    window.addEventListener("focus", () => {
      if (!this._launched) return;
      const r = this.shadowRoot.getElementById("refocus");
      if (r) r.classList.remove("hidden");
    });

    if (this._hass) this._updateUI();
    if (this._config.auto_launch && !this._launched) this._launch();
  }

  _launch() {
    const c = this._config;
    const host = c.server_host || window.location.hostname;
    const webPort = c.web_port || 8443;
    const base = c.game_url || `https://${host}:${webPort}`;
    const connectTarget = c.connect_server || "";
    const args = [];
    if (connectTarget) args.push("+connect " + connectTarget);
    if (c.auto_spectate) {
      const name = (c.spectator_name || "HA_Spectator").trim();
      args.push("+set name " + name);
      // Join as spectator — team 3 = spectator in Q3
      if (connectTarget) args.push("+team 3");
    }
    const src = args.length
      ? `${base}?${args.map(encodeURIComponent).join("&")}`
      : base;
    const frame = this.shadowRoot.getElementById("frame");
    frame.src = src;
    this.shadowRoot.getElementById("splash").classList.add("hidden");
    frame.classList.remove("hidden");
    this._launched = true;
    const r = this.shadowRoot.getElementById("refocus");
    if (r) r.classList.add("hidden");
  }

  _fullscreen() {
    const f = this.shadowRoot.getElementById("frame");
    if (f && this._launched && f.requestFullscreen) f.requestFullscreen();
  }

  _disconnect() {
    const frame = this.shadowRoot.getElementById("frame");
    frame.src = "about:blank";
    frame.classList.add("hidden");
    this.shadowRoot.getElementById("splash").classList.remove("hidden");
    this._launched = false;
    this._setActive(false);
  }

  _refocus() {
    const frame = this.shadowRoot.getElementById("frame");
    const r = this.shadowRoot.getElementById("refocus");
    if (r) r.classList.add("hidden");
    if (frame) { frame.focus(); frame.contentWindow && frame.contentWindow.focus(); }
  }

  _updateUI() {
    const hass = this._hass;
    if (!hass) return;
    const prefix = this._config.entity_prefix || "q3js";

    const mapState    = hass.states[`sensor.${prefix}_current_map`];
    const timeState   = hass.states[`sensor.${prefix}_match_time`];
    const activeState = hass.states[`binary_sensor.${prefix}_match_active`];

    const mapName     = mapState ? mapState.state : "–";
    const matchActive = activeState ? activeState.state === "on" : false;
    const timeFmt     = timeState ? (timeState.attributes.formatted || "00:00") : "00:00";

    this._setActive(matchActive);

    if (this._config.show_map !== false) {
      const fMap = this.shadowRoot.getElementById("fMap");
      if (fMap) fMap.textContent = mapName;
    }
    if (this._config.show_time !== false) {
      const fTime = this.shadowRoot.getElementById("fTime");
      if (fTime) fTime.textContent = timeFmt;
    }
    const fStatus = this.shadowRoot.getElementById("fStatus");
    if (fStatus) fStatus.innerHTML = matchActive ? "🟢 <b>Active</b>" : "🔴 <b>Idle</b>";

    if (this._config.show_leaderboard !== false) {
      const lbRows = this.shadowRoot.getElementById("lbRows");
      if (!lbRows) return;

      if (this._config.show_players !== false) {
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
        lbRows.innerHTML = `<div class="empty">${matchActive ? "Match in progress" : "Waiting for match…"}</div>`;
      }
    }
  }

  _setActive(on) {
    this.shadowRoot.getElementById("dot")?.classList.toggle("on", on);
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
    const sel = (key, val) => c[key] === val ? "selected" : "";
    this.innerHTML = `
      <style>
        .row{margin-bottom:10px}
        label{display:block;font-size:.8em;color:var(--secondary-text-color);margin-bottom:3px}
        input[type=text],input[type=number],select{width:100%;padding:6px 8px;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box}
        .toggles{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px}
        .toggle{display:flex;align-items:center;gap:6px;font-size:.82em;color:var(--primary-text-color);cursor:pointer}
        .toggle input{width:auto}
        .section{font-size:.75em;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;border-bottom:1px solid var(--divider-color);padding-bottom:4px}
        .hint{font-size:.75em;color:var(--secondary-text-color);margin-top:2px}
      </style>
      <div style="padding:12px">
        <div class="section">Connection</div>
        <div class="row"><label>Title</label><input type="text" id="title" value="${c.title || ""}"></div>
        <div class="row"><label>Server Host (web client)</label><input type="text" id="server_host" value="${c.server_host || window.location.hostname}"></div>
        <div class="row"><label>Web Client Port (HTTPS)</label><input type="number" id="web_port" value="${c.web_port || 8443}"></div>
        <div class="row"><label>Connect Server (host:wsport)</label><input type="text" id="connect_server" value="${c.connect_server || ""}"></div>
        <div class="row">
          <label class="toggle"><input type="checkbox" id="auto_spectate" ${chk("auto_spectate")}> Auto Spectate on join</label>
        </div>
        <div class="row"><label>Spectator Name</label><input type="text" id="spectator_name" value="${c.spectator_name || "HA_Spectator"}"></div>

        <div class="section">Integration</div>
        <div class="row"><label>Entity Prefix</label><input type="text" id="entity_prefix" value="${c.entity_prefix || "q3js"}"></div>

        <div class="section">Appearance</div>
        <div class="row">
          <label>Theme</label>
          <select id="theme">
            <option value="dark" ${sel("theme","dark")}>Dark (default)</option>
            <option value="minimal" ${sel("theme","minimal")}>Minimal (use HA theme)</option>
            <option value="transparent" ${sel("theme","transparent")}>Transparent</option>
          </select>
        </div>
        <div class="row"><label>Accent Color <span class="hint">(leave blank for default orange)</span></label><input type="text" id="accent_color" value="${c.accent_color || ""}" placeholder="#ff6600"></div>
        <div class="row"><label>Card Background <span class="hint">(leave blank for theme default)</span></label><input type="text" id="card_background" value="${c.card_background || ""}" placeholder="e.g. #0a0a14 or transparent"></div>
        <div class="row"><label>Card Height (px)</label><input type="number" id="height" value="${c.height || 600}"></div>

        <div class="section">Visibility</div>
        <div class="toggles">
          <label class="toggle"><input type="checkbox" id="auto_launch" ${chk("auto_launch")}> Auto Launch</label>
          <label class="toggle"><input type="checkbox" id="show_header" ${chk("show_header")}> Show Header</label>
          <label class="toggle"><input type="checkbox" id="show_controls" ${chk("show_controls")}> Show Controls</label>
          <label class="toggle"><input type="checkbox" id="show_map" ${chk("show_map")}> Show Map Name</label>
          <label class="toggle"><input type="checkbox" id="show_time" ${chk("show_time")}> Show Match Time</label>
          <label class="toggle"><input type="checkbox" id="show_leaderboard" ${chk("show_leaderboard")}> Show Leaderboard</label>
          <label class="toggle"><input type="checkbox" id="show_players" ${chk("show_players")}> Show Players</label>
        </div>
      </div>`;

    this.querySelectorAll("input[type=text],input[type=number],select")
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
          auto_launch: chk("auto_launch"),
          auto_spectate: chk("auto_spectate"),
          spectator_name: get("spectator_name"),
          title: get("title"),
          server_host: get("server_host"),
          web_port: num("web_port"),
          connect_server: get("connect_server"),
          entity_prefix: get("entity_prefix"),
          theme: get("theme"),
          accent_color: get("accent_color"),
          card_background: get("card_background"),
          height: num("height"),
          show_header: chk("show_header"),
          show_controls: chk("show_controls"),
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
console.info("%c Q3JS CARD %c loaded", "background:#ff6600;color:#000;font-weight:bold;padding:2px 4px;", "background:#111;color:#ff6600;padding:2px 4px;");        ctrlColor: "#888",
        ctrlBorder: "#222",
      },
      minimal: {
        cardBg: c.card_background || "var(--ha-card-background, var(--card-background-color))",
        headerBg: "transparent",
        footerBg: "var(--secondary-background-color)",
        lbBg: "var(--secondary-background-color)",
        ctrlBg: "var(--secondary-background-color)",
        ctrlBtnBg: "var(--card-background-color)",
        ctrlBtnHover: "var(--primary-background-color)",
        borderColor: "var(--divider-color)",
        footerBorder: "var(--divider-color)",
        lbBorder: "var(--divider-color)",
        rowBorder: "var(--divider-color)",
        textColor: "var(--primary-text-color)",
        mutedColor: "var(--secondary-text-color)",
        rankColor: "var(--secondary-text-color)",
        deathColor: "var(--secondary-text-color)",
        emptyColor: "var(--secondary-text-color)",
        ctrlColor: "var(--secondary-text-color)",
        ctrlBorder: "var(--divider-color)",
      },
      transparent: {
        cardBg: c.card_background || "transparent",
        headerBg: "transparent",
        footerBg: "transparent",
        lbBg: "transparent",
        ctrlBg: "transparent",
        ctrlBtnBg: "rgba(0,0,0,0.3)",
        ctrlBtnHover: "rgba(0,0,0,0.5)",
        borderColor: "rgba(255,255,255,0.1)",
        footerBorder: "rgba(255,255,255,0.1)",
        lbBorder: "rgba(255,255,255,0.1)",
        rowBorder: "rgba(255,255,255,0.08)",
        textColor: "var(--primary-text-color)",
        mutedColor: "var(--secondary-text-color)",
        rankColor: "var(--secondary-text-color)",
        deathColor: "var(--secondary-text-color)",
        emptyColor: "var(--secondary-text-color)",
        ctrlColor: "var(--primary-text-color)",
        ctrlBorder: "rgba(255,255,255,0.2)",
      },
    };

    const t = themes[theme] || themes.dark;
    const height = c.height || 600;

    return `
      :host{display:block}
      ha-card{background:${t.cardBg};overflow:hidden}
      .header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;font-family:monospace;font-size:1em;letter-spacing:2px;text-transform:uppercase;color:${accent};border-bottom:1px solid ${t.borderColor};background:${t.headerBg}}
      .dot{width:9px;height:9px;border-radius:50%;background:${t.rankColor};transition:all .4s}
      .dot.on{background:#22ff44;box-shadow:0 0 6px #22ff44}
      .wrap{position:relative;width:100%;height:${height}px;background:#000}
      .frame{width:100%;height:100%;border:none;display:block}
      .hidden{display:none!important}
      .splash{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,#1c0800,#000 70%)}
      .logo{font-family:monospace;font-size:3.5em;font-weight:900;color:${accent};text-shadow:0 0 30px ${accentBright};letter-spacing:6px;margin-bottom:4px}
      .sub{font-family:monospace;font-size:.72em;color:#884422;letter-spacing:4px;text-transform:uppercase;margin-bottom:28px}
      .play{padding:13px 42px;background:${accentDim};color:#fff;border:2px solid ${accentBright};font-family:monospace;font-size:.9em;letter-spacing:4px;text-transform:uppercase;cursor:pointer;clip-path:polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)}
      .play:hover{background:${accentBright}}
      .meta{margin-top:18px;font-family:monospace;font-size:.72em;color:#553322;text-align:center;line-height:1.8}
      .meta span{color:#cc6633}
      .lb{background:${t.lbBg};border-top:1px solid ${t.lbBorder};padding:10px 16px}
      .lbh{font-family:monospace;font-size:.7em;letter-spacing:3px;color:${accent};text-transform:uppercase;margin-bottom:6px}
      .lbrow{display:flex;align-items:center;padding:4px 0;border-bottom:1px solid ${t.rowBorder};font-family:monospace;font-size:.82em}
      .rk{color:${t.rankColor};width:26px;flex-shrink:0}
      .nm{color:${t.textColor};flex:1;padding:0 6px;overflow:hidden;text-overflow:ellipsis}
      .fr{color:${accent};font-weight:bold;width:38px;text-align:right}
      .de{color:${t.deathColor};width:44px;text-align:right;font-size:.85em}
      .empty{color:${t.emptyColor};font-family:monospace;font-size:.78em;padding:6px 0}
      .footer{display:flex;gap:12px;flex-wrap:wrap;padding:7px 16px;background:${t.footerBg};border-top:1px solid ${t.footerBorder}}
      .chip{font-family:monospace;font-size:.72em;color:${t.mutedColor};display:flex;align-items:center;gap:4px}
      .chip b{color:${accent}}
      .ctrls{display:flex;gap:6px;flex-wrap:wrap;padding:7px 16px;background:${t.ctrlBg};border-top:1px solid ${t.footerBorder}}
      button.ctrl{padding:4px 12px;background:${t.ctrlBtnBg};color:${t.ctrlColor};border:1px solid ${t.ctrlBorder};font-family:monospace;font-size:.72em;cursor:pointer;letter-spacing:1px}
      button.ctrl:hover{background:${t.ctrlBtnHover};color:${accent};border-color:${accentBright}}
      .refocus{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);color:${accent};font-family:monospace;font-size:1.1em;letter-spacing:3px;cursor:pointer;z-index:10}
      .refocus:hover{background:rgba(0,0,0,0.7)}
    `;
  }

  _render() {
    const c = this._config;
    const showHeader = c.show_header !== false;
    const showControls = c.show_controls !== false;
    const showLb = c.show_leaderboard !== false;
    const showMap = c.show_map !== false;
    const showTime = c.show_time !== false;
    const showFooter = showMap || showTime;

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        ${showHeader ? `
        <div class="header">
          <div>⚡ ${this._esc(c.title || "Quake III Arena")}</div>
          <div class="dot" id="dot"></div>
        </div>` : `<div class="dot hidden" id="dot"></div>`}
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
        ${showLb ? `<div class="lb"><div class="lbh">🏆 Leaderboard</div><div id="lbRows"><div class="empty">Waiting for match data…</div></div></div>` : ""}
        ${showFooter ? `
        <div class="footer">
          ${showMap ? `<div class="chip">🗺 <b id="fMap">–</b></div>` : ""}
          ${showTime ? `<div class="chip">⏱ <b id="fTime">--:--</b></div>` : ""}
          <div class="chip" id="fStatus">🔴 <b>Idle</b></div>
        </div>` : ""}
        ${showControls ? `
        <div class="ctrls">
          <button class="ctrl" id="btnFs">⛶ Fullscreen</button>
          <button class="ctrl" id="btnDisc">✕ Disconnect</button>
        </div>` : ""}
      </ha-card>`;

    this.shadowRoot.getElementById("playBtn").addEventListener("click", () => this._launch());
    this.shadowRoot.getElementById("refocus").addEventListener("click", () => this._refocus());
    if (showControls) {
      this.shadowRoot.getElementById("btnFs").addEventListener("click", () => this._fullscreen());
      this.shadowRoot.getElementById("btnDisc").addEventListener("click", () => this._disconnect());
    }

    window.addEventListener("blur", () => {
      if (!this._launched) return;
      const r = this.shadowRoot.getElementById("refocus");
      if (r) r.classList.add("hidden");
    });
    window.addEventListener("focus", () => {
      if (!this._launched) return;
      const r = this.shadowRoot.getElementById("refocus");
      if (r) r.classList.remove("hidden");
    });

    if (this._hass) this._updateUI();
    if (this._config.auto_launch && !this._launched) this._launch();
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
    const frame = this.shadowRoot.getElementById("frame");
    frame.src = src;
    this.shadowRoot.getElementById("splash").classList.add("hidden");
    frame.classList.remove("hidden");
    this._launched = true;
    const r = this.shadowRoot.getElementById("refocus");
    if (r) r.classList.add("hidden");
  }

  _fullscreen() {
    const f = this.shadowRoot.getElementById("frame");
    if (f && this._launched && f.requestFullscreen) f.requestFullscreen();
  }

  _disconnect() {
    const frame = this.shadowRoot.getElementById("frame");
    frame.src = "about:blank";
    frame.classList.add("hidden");
    this.shadowRoot.getElementById("splash").classList.remove("hidden");
    this._launched = false;
    this._setActive(false);
  }

  _refocus() {
    const frame = this.shadowRoot.getElementById("frame");
    const r = this.shadowRoot.getElementById("refocus");
    if (r) r.classList.add("hidden");
    if (frame) { frame.focus(); frame.contentWindow && frame.contentWindow.focus(); }
  }

  _updateUI() {
    const hass = this._hass;
    if (!hass) return;
    const prefix = this._config.entity_prefix || "q3js";

    const mapState    = hass.states[`sensor.${prefix}_current_map`];
    const timeState   = hass.states[`sensor.${prefix}_match_time`];
    const activeState = hass.states[`binary_sensor.${prefix}_match_active`];

    const mapName     = mapState ? mapState.state : "–";
    const matchActive = activeState ? activeState.state === "on" : false;
    const timeFmt     = timeState ? (timeState.attributes.formatted || "00:00") : "00:00";

    this._setActive(matchActive);

    if (this._config.show_map !== false) {
      const fMap = this.shadowRoot.getElementById("fMap");
      if (fMap) fMap.textContent = mapName;
    }
    if (this._config.show_time !== false) {
      const fTime = this.shadowRoot.getElementById("fTime");
      if (fTime) fTime.textContent = timeFmt;
    }
    const fStatus = this.shadowRoot.getElementById("fStatus");
    if (fStatus) fStatus.innerHTML = matchActive ? "🟢 <b>Active</b>" : "🔴 <b>Idle</b>";

    if (this._config.show_leaderboard !== false) {
      const lbRows = this.shadowRoot.getElementById("lbRows");
      if (!lbRows) return;

      if (this._config.show_players !== false) {
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
        lbRows.innerHTML = `<div class="empty">${matchActive ? "Match in progress" : "Waiting for match…"}</div>`;
      }
    }
  }

  _setActive(on) {
    this.shadowRoot.getElementById("dot")?.classList.toggle("on", on);
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
    const sel = (key, val) => c[key] === val ? "selected" : "";
    this.innerHTML = `
      <style>
        .row{margin-bottom:10px}
        label{display:block;font-size:.8em;color:var(--secondary-text-color);margin-bottom:3px}
        input[type=text],input[type=number],select{width:100%;padding:6px 8px;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box}
        .toggles{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px}
        .toggle{display:flex;align-items:center;gap:6px;font-size:.82em;color:var(--primary-text-color);cursor:pointer}
        .toggle input{width:auto}
        .section{font-size:.75em;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;border-bottom:1px solid var(--divider-color);padding-bottom:4px}
        .hint{font-size:.75em;color:var(--secondary-text-color);margin-top:2px}
      </style>
      <div style="padding:12px">
        <div class="section">Connection</div>
        <div class="row"><label>Title</label><input type="text" id="title" value="${c.title || ""}"></div>
        <div class="row"><label>Server Host (web client)</label><input type="text" id="server_host" value="${c.server_host || window.location.hostname}"></div>
        <div class="row"><label>Web Client Port (HTTPS)</label><input type="number" id="web_port" value="${c.web_port || 8443}"></div>
        <div class="row"><label>Connect Server (host:wsport)</label><input type="text" id="connect_server" value="${c.connect_server || ""}"></div>

        <div class="section">Integration</div>
        <div class="row"><label>Entity Prefix</label><input type="text" id="entity_prefix" value="${c.entity_prefix || "q3js"}"></div>

        <div class="section">Appearance</div>
        <div class="row">
          <label>Theme</label>
          <select id="theme">
            <option value="dark" ${sel("theme","dark")}>Dark (default)</option>
            <option value="minimal" ${sel("theme","minimal")}>Minimal (use HA theme)</option>
            <option value="transparent" ${sel("theme","transparent")}>Transparent</option>
          </select>
        </div>
        <div class="row"><label>Accent Color <span class="hint">(leave blank for default orange)</span></label><input type="text" id="accent_color" value="${c.accent_color || ""}" placeholder="#ff6600"></div>
        <div class="row"><label>Card Background <span class="hint">(leave blank for theme default)</span></label><input type="text" id="card_background" value="${c.card_background || ""}" placeholder="e.g. #0a0a14 or transparent"></div>
        <div class="row"><label>Card Height (px)</label><input type="number" id="height" value="${c.height || 600}"></div>

        <div class="section">Visibility</div>
        <div class="toggles">
          <label class="toggle"><input type="checkbox" id="auto_launch" ${chk("auto_launch")}> Auto Launch</label>
          <label class="toggle"><input type="checkbox" id="show_header" ${chk("show_header")}> Show Header</label>
          <label class="toggle"><input type="checkbox" id="show_controls" ${chk("show_controls")}> Show Controls</label>
          <label class="toggle"><input type="checkbox" id="show_map" ${chk("show_map")}> Show Map Name</label>
          <label class="toggle"><input type="checkbox" id="show_time" ${chk("show_time")}> Show Match Time</label>
          <label class="toggle"><input type="checkbox" id="show_leaderboard" ${chk("show_leaderboard")}> Show Leaderboard</label>
          <label class="toggle"><input type="checkbox" id="show_players" ${chk("show_players")}> Show Players</label>
        </div>
      </div>`;

    this.querySelectorAll("input[type=text],input[type=number],select")
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
          auto_launch: chk("auto_launch"),
          title: get("title"),
          server_host: get("server_host"),
          web_port: num("web_port"),
          connect_server: get("connect_server"),
          entity_prefix: get("entity_prefix"),
          theme: get("theme"),
          accent_color: get("accent_color"),
          card_background: get("card_background"),
          height: num("height"),
          show_header: chk("show_header"),
          show_controls: chk("show_controls"),
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
