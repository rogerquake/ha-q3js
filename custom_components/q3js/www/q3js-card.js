class Q3JSCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._metrics = null;
    this._metricsInterval = null;
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
      ws_port: 27961,
      show_leaderboard: true,
      height: 600,
    };
  }

  setConfig(config) {
    this._config = { server_host: window.location.hostname, web_port: 8443, ws_port: 27961, show_leaderboard: true, height: 600, ...config };
    if (!this._config.metrics_url) this._config.metrics_url = `http://${this._config.server_host}:8090/api/metrics`;
    this._render();
    this._startPolling();
  }

  set hass(_) {}
  disconnectedCallback() { this._stopPolling(); }

  _render() {
    const c = this._config;
    const height = c.height || 600;
    const showLb = c.show_leaderboard !== false;
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
        .row{display:flex;align-items:center;padding:4px 0;border-bottom:1px solid #111;font-family:monospace;font-size:.82em}
        .rk{color:#444;width:26px;flex-shrink:0}.nm{color:#ccc;flex:1;padding:0 6px;overflow:hidden;text-overflow:ellipsis}
        .fr{color:#ff6600;font-weight:bold;width:38px;text-align:right}.de{color:#555;width:44px;text-align:right;font-size:.85em}
        .empty{color:#333;font-family:monospace;font-size:.78em;padding:6px 0}
        .footer{display:flex;gap:12px;flex-wrap:wrap;padding:7px 16px;background:#04040c;border-top:1px solid #111}
        .chip{font-family:monospace;font-size:.72em;color:#666;display:flex;align-items:center;gap:4px}
        .chip b{color:#cc7733}
        .ctrls{display:flex;gap:6px;flex-wrap:wrap;padding:7px 16px;background:#04040c;border-top:1px solid #0f0f1a}
        button.ctrl{padding:4px 12px;background:#0e0e1a;color:#888;border:1px solid #222;font-family:monospace;font-size:.72em;cursor:pointer;letter-spacing:1px}
        button.ctrl:hover{background:#1a1a2e;color:#ff6600;border-color:#ff4400}
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
              Server <span>${this._esc(c.server_host || window.location.hostname)}:${c.web_port || 8443}</span><br>
              WSS port <span>${c.ws_port || 27961}</span>
            </div>
          </div>
          <iframe class="frame hidden" id="frame" allow="autoplay;fullscreen;pointer-lock" allowfullscreen></iframe>
        </div>
        ${showLb ? `<div class="lb"><div class="lbh">🏆 Leaderboard</div><div id="lbRows"><div class="empty">Waiting for match data…</div></div></div>` : ""}
        <div class="footer">
          <div class="chip">🗺 <b id="fMap">${this._esc(c.map_name || "–")}</b></div>
          <div class="chip">⏱ <b id="fTime">--:--</b></div>
          <div class="chip" id="fStatus">🔴 <b>Idle</b></div>
        </div>
        <div class="ctrls">
          <button class="ctrl" id="btnFs">⛶ Fullscreen</button>
          <button class="ctrl" id="btnDisc">✕ Disconnect</button>
        </div>
      </ha-card>`;
    this.shadowRoot.getElementById("playBtn").addEventListener("click", () => this._launch());
    this.shadowRoot.getElementById("btnFs").addEventListener("click", () => this._fullscreen());
    this.shadowRoot.getElementById("btnDisc").addEventListener("click", () => this._disconnect());
  }

  _launch() {
    const c = this._config;
    const host = c.server_host || window.location.hostname;
    const webPort = c.web_port || 8443;
    const wsPort = c.ws_port || 27961;
    const base = c.game_url || `https://${host}:${webPort}`;
    const sep = base.includes("?") ? "&" : "?";
    this.shadowRoot.getElementById("frame").src = `${base}${sep}connect=${host}&port=${wsPort}`;
    this.shadowRoot.getElementById("splash").classList.add("hidden");
    this.shadowRoot.getElementById("frame").classList.remove("hidden");
    this._launched = true;
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

  _startPolling() {
    this._stopPolling();
    const url = this._config.metrics_url;
    if (!url) return;
    const tick = async () => { try { const r = await fetch(url,{cache:"no-store"}); if(r.ok){this._metrics=await r.json();this._updateUI();} } catch {} };
    tick();
    this._metricsInterval = setInterval(tick, 10000);
  }

  _stopPolling() { if (this._metricsInterval !== null) { clearInterval(this._metricsInterval); this._metricsInterval = null; } }

  _updateUI() {
    const m = this._metrics;
    if (!m) return;
    this._setActive(m.match_active);
    const fMap = this.shadowRoot.getElementById("fMap");
    const fTime = this.shadowRoot.getElementById("fTime");
    const fStatus = this.shadowRoot.getElementById("fStatus");
    if (fMap) fMap.textContent = m.map_name || "–";
    if (fTime) fTime.textContent = m.match_time_formatted || "00:00";
    if (fStatus) fStatus.innerHTML = m.match_active ? "🟢 <b>Active</b>" : "🔴 <b>Idle</b>";
    const lbRows = this.shadowRoot.getElementById("lbRows");
    if (!lbRows) return;
    const lb = m.leaderboard || [];
    lbRows.innerHTML = lb.length
      ? lb.map((p,i) => `<div class="row"><span class="rk">#${i+1}</span><span class="nm">${this._esc(p.name)}</span><span class="fr">${p.frags}</span><span class="de">${p.deaths}💀</span></div>`).join("")
      : `<div class="empty">No players yet…</div>`;
  }

  _setActive(on) { const d = this.shadowRoot.getElementById("dot"); if (d) d.classList.toggle("on", on); }
  _esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  getCardSize() { return Math.ceil((this._config.height||600)/50)+4; }
}

class Q3JSCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  _render() {
    const c = this._config;
    this.innerHTML = `
      <style>.row{margin-bottom:10px}label{display:block;font-size:.8em;color:var(--secondary-text-color);margin-bottom:3px}input{width:100%;padding:6px 8px;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box}</style>
      <div style="padding:12px">
        <div class="row"><label>Title</label><input id="title" value="${c.title||""}"></div>
        <div class="row"><label>Server Host</label><input id="server_host" value="${c.server_host||window.location.hostname}"></div>
        <div class="row"><label>Web Client Port (HTTPS)</label><input id="web_port" type="number" value="${c.web_port||8443}"></div>
        <div class="row"><label>WebSocket Port</label><input id="ws_port" type="number" value="${c.ws_port||27961}"></div>
        <div class="row"><label>Metrics URL</label><input id="metrics_url" value="${c.metrics_url||""}"></div>
        <div class="row"><label>Card Height (px)</label><input id="height" type="number" value="${c.height||600}"></div>
      </div>`;
    this.querySelectorAll("input").forEach(el => el.addEventListener("change", () => this._fire()));
  }
  _fire() {
    const get = id => this.querySelector(`#${id}`).value;
    const num = id => parseInt(get(id),10)||0;
    this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:{...this._config,title:get("title"),server_host:get("server_host"),web_port:num("web_port"),ws_port:num("ws_port"),metrics_url:get("metrics_url"),height:num("height")}},bubbles:true,composed:true}));
  }
}

customElements.define("q3js-card", Q3JSCard);
customElements.define("q3js-card-editor", Q3JSCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: "q3js-card", name: "Q3JS – Quake III Arena", description: "Play Quake III Arena in your dashboard with live match stats.", preview: true });
console.info("%c Q3JS CARD %c loaded", "background:#ff6600;color:#000;font-weight:bold;padding:2px 4px;", "background:#111;color:#ff6600;padding:2px 4px;");
