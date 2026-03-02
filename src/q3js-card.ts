/**
 * Q3JS Lovelace Card
 *
 * Embeds Quake III Arena (via q3js WebAssembly) in a Home Assistant
 * dashboard card, with a live leaderboard pulled from the Q3JS metrics server.
 *
 * Card YAML configuration:
 *
 *   type: custom:q3js-card
 *   title: "Quake III Arena"         # optional header
 *   server_host: "192.168.1.100"     # HA host running the Q3JS addon
 *   ws_port: 27961                    # WebSocket proxy port
 *   metrics_url: "http://192.168.1.100:8090/api/metrics"
 *   map_name: "q3dm17"
 *   frag_limit: 30
 *   bots:
 *     - name: "Keel"
 *       skill: 3
 *     - name: "Sarge"
 *       skill: 3
 *   auto_spectate: true
 *   spectator_name: "HA_Spectator"
 *   show_leaderboard: true
 *   height: 600
 *   game_url: ""                      # override q3js client URL (optional)
 */

interface BotConfig {
  name: string;
  skill: number;
}

interface Q3JSCardConfig {
  type: string;
  title?: string;
  server_host?: string;
  ws_port?: number;
  metrics_url?: string;
  map_name?: string;
  frag_limit?: number;
  bots?: BotConfig[];
  auto_spectate?: boolean;
  spectator_name?: string;
  show_leaderboard?: boolean;
  height?: number;
  game_url?: string;
}

interface PlayerData {
  name: string;
  frags: number;
  deaths: number;
}

interface MetricsData {
  map_name: string;
  match_active: boolean;
  match_time_seconds: number;
  match_time_formatted: string;
  leaderboard: PlayerData[];
  last_updated: string;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

class Q3JSCard extends HTMLElement {
  private _config!: Q3JSCardConfig;
  private _metrics: MetricsData | null = null;
  private _metricsInterval: ReturnType<typeof setInterval> | null = null;
  private _launched = false;

  static getConfigElement(): HTMLElement {
    return document.createElement("q3js-card-editor");
  }

  static getStubConfig(): Q3JSCardConfig {
    return {
      type: "custom:q3js-card",
      title: "Quake III Arena",
      server_host: window.location.hostname,
      ws_port: 27961,
      metrics_url: `http://${window.location.hostname}:8090/api/metrics`,
      map_name: "q3dm17",
      frag_limit: 30,
      bots: [
        { name: "Keel", skill: 3 },
        { name: "Sarge", skill: 3 },
      ],
      auto_spectate: true,
      spectator_name: "HA_Spectator",
      show_leaderboard: true,
      height: 600,
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config: Q3JSCardConfig): void {
    this._config = {
      server_host: window.location.hostname,
      ws_port: 27961,
      map_name: "q3dm17",
      frag_limit: 30,
      bots: [],
      auto_spectate: true,
      spectator_name: "HA_Spectator",
      show_leaderboard: true,
      height: 600,
      ...config,
    };
    if (!this._config.metrics_url) {
      this._config.metrics_url = `http://${this._config.server_host}:8090/api/metrics`;
    }
    this._render();
    this._startPolling();
  }

  set hass(_hass: unknown) {
    // unused — data comes from metrics server directly
  }

  disconnectedCallback(): void {
    this._stopPolling();
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  private _render(): void {
    const c = this._config;
    const height = c.height ?? 600;
    const showLb = c.show_leaderboard !== false;

    this.shadowRoot!.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { background: #0a0a14; overflow: hidden; }

        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px 8px;
          font-family: monospace; font-size: 1em; letter-spacing: 2px;
          text-transform: uppercase; color: #ff6600;
          border-bottom: 1px solid #1e1e2e;
        }
        .header-title { display: flex; align-items: center; gap: 8px; }
        .status-dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: #333; transition: all 0.4s;
        }
        .status-dot.on { background: #22ff44; box-shadow: 0 0 6px #22ff44; }

        .game-wrap {
          position: relative; width: 100%; height: ${height}px; background: #000;
        }
        .game-iframe { width: 100%; height: 100%; border: none; display: block; }
        .hidden { display: none !important; }

        .splash {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: radial-gradient(ellipse at 50% 40%, #1c0800 0%, #000 70%);
          cursor: default;
        }
        .splash-logo {
          font-family: monospace; font-size: 3.5em; font-weight: 900;
          color: #ff6600; text-shadow: 0 0 30px #ff4400;
          letter-spacing: 6px; margin-bottom: 4px;
        }
        .splash-sub {
          font-family: monospace; font-size: 0.72em; color: #884422;
          letter-spacing: 4px; text-transform: uppercase; margin-bottom: 28px;
        }
        .play-btn {
          padding: 13px 42px;
          background: #992200; color: #fff;
          border: 2px solid #ff4400; font-family: monospace;
          font-size: 0.9em; letter-spacing: 4px; text-transform: uppercase;
          cursor: pointer; transition: all 0.15s;
          clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
        }
        .play-btn:hover { background: #ff4400; transform: scale(1.04); }
        .splash-meta {
          margin-top: 18px; font-family: monospace; font-size: 0.72em;
          color: #553322; text-align: center; line-height: 1.8;
        }
        .splash-meta span { color: #cc6633; }

        .leaderboard {
          background: #07070f; border-top: 1px solid #1a1a2a; padding: 10px 16px;
        }
        .lb-head {
          font-family: monospace; font-size: 0.7em; letter-spacing: 3px;
          color: #ff6600; text-transform: uppercase; margin-bottom: 6px;
        }
        .lb-row {
          display: flex; align-items: center;
          padding: 4px 0; border-bottom: 1px solid #111;
          font-family: monospace; font-size: 0.82em;
        }
        .lb-rank { color: #444; width: 26px; flex-shrink: 0; }
        .lb-name { color: #ccc; flex: 1; padding: 0 6px; overflow: hidden; text-overflow: ellipsis; }
        .lb-frags { color: #ff6600; font-weight: bold; width: 38px; text-align: right; }
        .lb-deaths { color: #555; width: 44px; text-align: right; font-size: 0.85em; }
        .lb-empty { color: #333; font-family: monospace; font-size: 0.78em; padding: 6px 0; }

        .footer {
          display: flex; gap: 12px; flex-wrap: wrap;
          padding: 7px 16px; background: #04040c;
          border-top: 1px solid #111;
        }
        .chip {
          font-family: monospace; font-size: 0.72em; color: #666;
          display: flex; align-items: center; gap: 4px;
        }
        .chip b { color: #cc7733; }

        .controls {
          display: flex; gap: 6px; flex-wrap: wrap;
          padding: 7px 16px; background: #04040c;
          border-top: 1px solid #0f0f1a;
        }
        button.ctrl {
          padding: 4px 12px; background: #0e0e1a; color: #888;
          border: 1px solid #222; font-family: monospace; font-size: 0.72em;
          cursor: pointer; transition: all 0.12s; letter-spacing: 1px;
        }
        button.ctrl:hover { background: #1a1a2e; color: #ff6600; border-color: #ff4400; }
      </style>

      <ha-card>
        ${c.title ? `
        <div class="header">
          <div class="header-title">⚡ ${this._esc(c.title)}</div>
          <div class="status-dot" id="dot"></div>
        </div>` : `<div style="position:absolute;top:10px;right:12px;z-index:10">
          <div class="status-dot" id="dot"></div>
        </div>`}

        <div class="game-wrap">
          <div class="splash" id="splash">
            <div class="splash-logo">Q3JS</div>
            <div class="splash-sub">Quake III Arena</div>
            <button class="play-btn" id="playBtn">▶ PLAY</button>
            <div class="splash-meta">
              Map <span>${this._esc(c.map_name ?? "q3dm17")}</span>
              &nbsp;·&nbsp; Frag limit <span>${c.frag_limit ?? 30}</span>
              &nbsp;·&nbsp; ${(c.bots ?? []).length} bot(s)
            </div>
          </div>
          <iframe class="game-iframe hidden" id="frame"
            allow="autoplay; fullscreen; pointer-lock"
            allowfullscreen></iframe>
        </div>

        ${showLb ? `
        <div class="leaderboard">
          <div class="lb-head">🏆 Leaderboard</div>
          <div id="lbRows"><div class="lb-empty">Waiting for match data…</div></div>
        </div>` : ""}

        <div class="footer">
          <div class="chip">🗺 <b id="fMap">${this._esc(c.map_name ?? "q3dm17")}</b></div>
          <div class="chip">⏱ <b id="fTime">--:--</b></div>
          <div class="chip" id="fStatus">🔴 <b>Idle</b></div>
        </div>

        <div class="controls">
          <button class="ctrl" id="btnFs">⛶ Fullscreen</button>
          <button class="ctrl" id="btnSpec">👁 Spectate</button>
          <button class="ctrl" id="btnRestart">↺ Restart</button>
          <button class="ctrl" id="btnDisc">✕ Disconnect</button>
        </div>
      </ha-card>
    `;

    this._bindEvents();
  }

  private _bindEvents(): void {
    this.shadowRoot!.getElementById("playBtn")?.addEventListener("click", () => this._launch());
    this.shadowRoot!.getElementById("btnFs")?.addEventListener("click", () => this._fullscreen());
    this.shadowRoot!.getElementById("btnSpec")?.addEventListener("click", () => this._spectate());
    this.shadowRoot!.getElementById("btnRestart")?.addEventListener("click", () => this._restart());
    this.shadowRoot!.getElementById("btnDisc")?.addEventListener("click", () => this._disconnect());
  }

  // ─── Game control ────────────────────────────────────────────────────────

  private _launch(): void {
    const c = this._config;
    const splash = this.shadowRoot!.getElementById("splash")!;
    const frame = this.shadowRoot!.getElementById("frame") as HTMLIFrameElement;

    // Prefer a locally hosted q3js instance; fall back to q3js.com
    const clientUrl = c.game_url || "https://q3js.com";
    frame.src = clientUrl;
    splash.classList.add("hidden");
    frame.classList.remove("hidden");
    this._launched = true;

    frame.addEventListener("load", () => {
      if (c.auto_spectate !== false) {
        setTimeout(() => this._spectate(), 4000);
      }
    }, { once: true });
  }

  private _spectate(): void {
    const frame = this.shadowRoot!.getElementById("frame") as HTMLIFrameElement | null;
    if (!frame || !this._launched) return;
    const name = this._config.spectator_name ?? "HA_Spectator";
    // q3js accepts postMessage commands
    frame.contentWindow?.postMessage({ type: "q3cmd", command: `name "${name}"` }, "*");
    frame.contentWindow?.postMessage({ type: "q3cmd", command: "team spectator" }, "*");
  }

  private _fullscreen(): void {
    const frame = this.shadowRoot!.getElementById("frame") as HTMLElement | null;
    if (frame && this._launched) frame.requestFullscreen?.();
  }

  private _restart(): void {
    const c = this._config;
    fetch(`http://${c.server_host}:8090/api/rcon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "map_restart" }),
    }).catch(() => {/* best-effort */});
  }

  private _disconnect(): void {
    const splash = this.shadowRoot!.getElementById("splash")!;
    const frame = this.shadowRoot!.getElementById("frame") as HTMLIFrameElement;
    frame.src = "about:blank";
    frame.classList.add("hidden");
    splash.classList.remove("hidden");
    this._launched = false;
    this._setActive(false);
  }

  // ─── Metrics polling ─────────────────────────────────────────────────────

  private _startPolling(): void {
    this._stopPolling();
    const url = this._config.metrics_url;
    if (!url) return;
    const tick = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) {
          this._metrics = await r.json() as MetricsData;
          this._updateUI();
        }
      } catch {/* network down */}
    };
    void tick();
    this._metricsInterval = setInterval(tick, 10_000);
  }

  private _stopPolling(): void {
    if (this._metricsInterval !== null) {
      clearInterval(this._metricsInterval);
      this._metricsInterval = null;
    }
  }

  private _updateUI(): void {
    const m = this._metrics;
    if (!m) return;

    this._setActive(m.match_active);

    const fMap = this.shadowRoot!.getElementById("fMap");
    const fTime = this.shadowRoot!.getElementById("fTime");
    const fStatus = this.shadowRoot!.getElementById("fStatus");
    if (fMap) fMap.textContent = m.map_name ?? "–";
    if (fTime) fTime.textContent = m.match_time_formatted ?? "00:00";
    if (fStatus) fStatus.innerHTML = m.match_active
      ? '🟢 <b>Active</b>'
      : '🔴 <b>Idle</b>';

    const lbRows = this.shadowRoot!.getElementById("lbRows");
    if (!lbRows) return;
    const lb = m.leaderboard ?? [];
    lbRows.innerHTML = lb.length
      ? lb.map((p, i) => `
          <div class="lb-row">
            <span class="lb-rank">#${i + 1}</span>
            <span class="lb-name">${this._esc(p.name)}</span>
            <span class="lb-frags">${p.frags}</span>
            <span class="lb-deaths">${p.deaths}💀</span>
          </div>`).join("")
      : `<div class="lb-empty">No players yet…</div>`;
  }

  private _setActive(on: boolean): void {
    this.shadowRoot!.getElementById("dot")?.classList.toggle("on", on);
  }

  private _esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  getCardSize(): number {
    return Math.ceil((this._config.height ?? 600) / 50) + 4;
  }
}

// ─── Card Editor ──────────────────────────────────────────────────────────────

class Q3JSCardEditor extends HTMLElement {
  private _config!: Q3JSCardConfig;

  setConfig(config: Q3JSCardConfig): void {
    this._config = config;
    this._render();
  }

  private _render(): void {
    const c = this._config;
    this.innerHTML = `
      <style>
        .row { margin-bottom: 10px; }
        label { display: block; font-size: 0.8em; color: var(--secondary-text-color); margin-bottom: 3px; }
        input { width: 100%; padding: 6px 8px; border: 1px solid var(--divider-color); border-radius: 4px;
          background: var(--card-background-color); color: var(--primary-text-color); box-sizing: border-box; }
      </style>
      <div style="padding:12px">
        <div class="row"><label>Title</label>
          <input id="title" value="${c.title ?? ""}"></div>
        <div class="row"><label>Server Host</label>
          <input id="server_host" value="${c.server_host ?? window.location.hostname}"></div>
        <div class="row"><label>WebSocket Port</label>
          <input id="ws_port" type="number" value="${c.ws_port ?? 27961}"></div>
        <div class="row"><label>Metrics URL</label>
          <input id="metrics_url" value="${c.metrics_url ?? ""}"></div>
        <div class="row"><label>Map Name</label>
          <input id="map_name" value="${c.map_name ?? "q3dm17"}"></div>
        <div class="row"><label>Frag Limit</label>
          <input id="frag_limit" type="number" value="${c.frag_limit ?? 30}"></div>
        <div class="row"><label>Card Height (px)</label>
          <input id="height" type="number" value="${c.height ?? 600}"></div>
        <div class="row"><label>Spectator Name</label>
          <input id="spectator_name" value="${c.spectator_name ?? "HA_Spectator"}"></div>
      </div>
    `;
    this.querySelectorAll("input").forEach((el) =>
      el.addEventListener("change", () => this._fire())
    );
  }

  private _fire(): void {
    const get = (id: string) =>
      (this.querySelector(`#${id}`) as HTMLInputElement)?.value ?? "";
    const getNum = (id: string) => parseInt(get(id), 10) || 0;

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: {
          config: {
            ...this._config,
            title: get("title"),
            server_host: get("server_host"),
            ws_port: getNum("ws_port"),
            metrics_url: get("metrics_url"),
            map_name: get("map_name"),
            frag_limit: getNum("frag_limit"),
            height: getNum("height"),
            spectator_name: get("spectator_name"),
          } satisfies Q3JSCardConfig,
        },
        bubbles: true,
        composed: true,
      })
    );
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────

customElements.define("q3js-card", Q3JSCard);
customElements.define("q3js-card-editor", Q3JSCardEditor);

(window as unknown as Record<string, unknown>)["customCards"] ??= [];
((window as unknown as Record<string, unknown[]>)["customCards"]).push({
  type: "q3js-card",
  name: "Q3JS – Quake III Arena",
  description: "Play Quake III Arena in your dashboard with live match stats.",
  preview: true,
  documentationURL: "https://github.com/YOUR_GITHUB_USER/ha-q3js",
});

console.info(
  "%c Q3JS CARD %c v0.1.0 ",
  "background:#ff6600;color:#000;font-weight:bold;padding:2px 4px;",
  "background:#111;color:#ff6600;padding:2px 4px;"
);
