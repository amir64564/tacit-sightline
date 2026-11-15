/* Sightline — read-only Tacit explorer. No wallet, no keys, no transactions. */
(() => {
  const POOL = "0x000000000Ed1eabD231Be41d93b719056F7febFC";
  const ENGINE = "0x000000003f608BDdF0ca45934003ffb9DbDF70DB";
  const TAC = "0xA1313eb9f3A445606D9583bcAc3ebeB56a858279";
  const CBTC = "0xdf1d99148bEb7a9AFf1d95C49B3d22b7ed90D696";
  const CUSD = "0x23cACFFAc2674514A6d4F6cD420B4cc2aC921564";
  const WTAC = "0x2018139a8FDd3666855BE3315C7683b4D6aB7AEf";
  const EVM_POOL = "0x000000c2A20657CE25f2Ba99737933D031AFBEE9";
  const XNS = "0x6e797ba2d3103aF167918e71a7E01DE40D45f74b";
  const AMM_POOL_ID = "aa3eab26215844c32ba27ed51413c48f881b4c605a233a5ccd169517bf33eb79";

  const ETH_RPCS = [
    "https://ethereum-rpc.publicnode.com",
    "https://cloudflare-eth.com",
    "https://rpc.ankr.com/eth"
  ];
  const BASE_RPCS = [
    "https://base-rpc.publicnode.com",
    "https://mainnet.base.org"
  ];

  const SEL = {
    cbtcBackingSats: "0x9f5b61d9",
    outstandingCusd: "0xa42542c0",
    totalSupply: "0x18160ddd",
    decimals: "0x313ce567",
    symbol: "0x95d89b41",
    balanceOf: "0x70a08231",
    getName: "0x5fd4b08a",
    getAddress: "0xbf40fac1"
  };

  const state = { sources: {}, data: {} };

  const $ = (id) => document.getElementById(id);
  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content;
  };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function shortHash(h, n = 6) {
    const s = String(h || "");
    if (s.length <= n * 2 + 2) return s;
    return s.slice(0, n + (s.startsWith("0x") ? 2 : 0)) + "…" + s.slice(-n);
  }

  function fmtInt(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return Number(n).toLocaleString("en-US");
  }

  function fmtDec(n, max = 8) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const x = Number(n);
    if (Math.abs(x) >= 1e6) return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return x.toLocaleString("en-US", { maximumFractionDigits: max });
  }

  function fromUnits(raw, decimals) {
    if (raw == null) return null;
    const s = BigInt(raw).toString().padStart(decimals + 1, "0");
    const i = s.slice(0, s.length - decimals);
    const f = s.slice(s.length - decimals).replace(/0+$/, "");
    return f ? Number(i + "." + f) : Number(i);
  }

  function ago(isoOrMs) {
    const t = typeof isoOrMs === "number" ? isoOrMs : Date.parse(isoOrMs);
    if (!t) return "";
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.round(s / 60) + "m ago";
    return Math.round(s / 3600) + "h ago";
  }

  function unixIST(sec) {
    if (!sec) return "—";
    const d = new Date(Number(sec) * 1000);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Calcutta",
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).format(d) + " IST";
  }

  async function fetchOfficial(url, { timeout = 18000 } = {}) {
    const direct = await tryFetch(url, timeout);
    if (direct.ok) {
      return { ...direct, via: "direct", officialUrl: url };
    }
    const relay = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
    const via = await tryFetch(relay, timeout + 4000);
    if (via.ok) {
      return { ...via, via: "relay", officialUrl: url, note: "Official URL read via allorigins because the Tacit API origin is restricted to tacit.finance." };
    }
    return { ok: false, error: direct.error || via.error, officialUrl: url, via: "failed" };
  }

  async function tryFetch(url, timeout) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json,text/plain;q=0.9,*/*;q=0.1" } });
      if (!res.ok) return { ok: false, error: "HTTP " + res.status };
      const text = await res.text();
      let data = text;
      try { data = JSON.parse(text); } catch {}
      return { ok: true, data, raw: text };
    } catch (e) {
      return { ok: false, error: e.name === "AbortError" ? "timeout" : (e.message || String(e)) };
    } finally {
      clearTimeout(t);
    }
  }

  async function ethCall(rpcs, to, data) {
    let last = "no rpc";
    for (const rpc of rpcs) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] })
        });
        const body = await res.json();
        if (body.error) { last = body.error.message || "rpc error"; continue; }
        if (body.result && body.result !== "0x") return { ok: true, result: body.result, rpc };
        last = "empty result";
      } catch (e) {
        last = e.message || String(e);
      }
    }
    return { ok: false, error: last };
  }

  async function ethBlockNumber(rpcs) {
    for (const rpc of rpcs) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })
        });
        const body = await res.json();
        if (body.result) return { ok: true, number: parseInt(body.result, 16), rpc };
      } catch {}
    }
    return { ok: false };
  }

  async function ethBalance(rpcs, address) {
    for (const rpc of rpcs) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] })
        });
        const body = await res.json();
        if (body.result) return { ok: true, wei: BigInt(body.result), rpc };
      } catch {}
    }
    return { ok: false };
  }

  function pad32(hex) {
    return hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  }

  function encodeAddress(addr) {
    return pad32(addr);
  }

  function encodeString(str) {
    const bytes = new TextEncoder().encode(str);
    const len = pad32(bytes.length.toString(16));
    let data = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    while (data.length % 64 !== 0) data += "00";
    return pad32("20") + len + data;
  }

  function decodeString(result) {
    if (!result || result === "0x") return "";
    const hex = result.replace(/^0x/, "");
    const offset = parseInt(hex.slice(0, 64), 16);
    const start = offset * 2;
    const len = parseInt(hex.slice(start, start + 64), 16);
    const data = hex.slice(start + 64, start + 64 + len * 2);
    const bytes = new Uint8Array(data.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
    return new TextDecoder().decode(bytes);
  }

  function decodeUint(result) {
    if (!result || result === "0x") return null;
    return BigInt(result);
  }

  function setStatus() {
    const ul = $("status-list");
    ul.innerHTML = "";
    for (const [name, s] of Object.entries(state.sources)) {
      const li = document.createElement("li");
      li.className = s.ok ? (s.via === "relay" ? "warn" : "ok") : "fail";
      const tag = s.ok ? (s.via === "relay" ? "relay" : "live") : "failed";
      li.textContent = name + " · " + tag + (s.detail ? " · " + s.detail : "");
      ul.appendChild(li);
    }
  }

  function mark(name, rec) {
    state.sources[name] = rec;
    setStatus();
  }

  function metric(label, value, extra = "") {
    return `<div class="metric"><span class="n">${esc(value)}</span><span class="l">${esc(label)}${extra ? " · " + esc(extra) : ""}</span></div>`;
  }

  function viaBadge(via) {
    if (via === "direct") return `<span class="badge direct">direct</span>`;
    if (via === "relay") return `<span class="badge relay">via allorigins</span>`;
    return "";
  }

  function linkTx(txid) {
    const id = String(txid || "");
    return `<a href="https://tacitscan.io/tx/${esc(id)}" target="_blank" rel="noopener">${esc(shortHash(id, 5))}</a>
      <a href="https://mempool.space/tx/${esc(id)}" target="_blank" rel="noopener" title="mempool.space">↗</a>`;
  }

  function refreshViews() {
    renderBitcoin();
    renderBridge();
    renderEvm();
    renderPrivacy();
    renderVerify();
  }

  async function loadAll() {
    const jobs = [
      loadReflection(),
      loadRelay(),
      loadAssetsAndMarket(),
      loadAmm(),
      loadFarm(),
      loadPoolReads(),
      loadKeepers(),
      loadBtcTips()
    ].map((p) => p.then(() => refreshViews(), () => refreshViews()));
    await Promise.allSettled(jobs);
    refreshViews();
  }

  async function loadReflection() {
    const r = await fetchOfficial("https://api.tacit.finance/reflection/status?network=mainnet");
    mark("reflection/status", { ok: r.ok, via: r.via, detail: r.ok ? ago(r.data.updatedAt) : r.error });
    if (r.ok) state.data.reflection = r.data;
    state.data.reflectionMeta = r;
  }

  async function loadRelay() {
    const r = await fetchOfficial("https://api.tacit.finance/confidential/relay");
    mark("confidential/relay", { ok: r.ok, via: r.via, detail: r.ok ? r.data.state : r.error });
    if (r.ok) state.data.relay = r.data;
  }

  async function loadAssetsAndMarket() {
    const a = await fetchOfficial("https://api.tacit.finance/assets?network=mainnet");
    mark("/assets", { ok: a.ok, via: a.via, detail: a.ok ? (a.data.count + " assets") : a.error });
    if (a.ok) state.data.assets = a.data;
    state.data.assetsMeta = a;
    const m = await fetchOfficial("https://api.tacit.finance/market?network=mainnet");
    mark("/market", { ok: m.ok, via: m.via, detail: m.ok ? "ok" : m.error });
    if (m.ok) state.data.market = m.data;
    state.data.marketMeta = m;
  }

  async function loadAmm() {
    const r = await fetchOfficial("https://api.tacit.finance/amm/pools?network=mainnet");
    mark("/amm/pools", { ok: r.ok, via: r.via, detail: r.ok ? r.data.pools?.length + " pool(s)" : r.error });
    if (r.ok) state.data.amm = r.data;
    state.data.ammMeta = r;
  }

  async function loadFarm() {
    const r = await fetchOfficial("https://api.tacit.finance/farm/program?network=mainnet");
    mark("farm/program", { ok: r.ok, via: r.via, detail: r.ok ? r.data.epoch?.ratePerDayTac + " TAC/day" : r.error });
    if (r.ok) state.data.farm = r.data;
  }

  async function loadBtcTips() {
    const [m, b] = await Promise.all([
      tryFetch("https://mempool.space/api/blocks/tip/height", 12000),
      tryFetch("https://blockstream.info/api/blocks/tip/height", 12000)
    ]);
    const mh = m.ok ? Number(m.data) : null;
    const bh = b.ok ? Number(b.data) : null;
    state.data.btcTip = { mempool: mh, blockstream: bh };
    mark("mempool tip", { ok: m.ok, via: "direct", detail: mh != null ? String(mh) : m.error });
    mark("blockstream tip", { ok: b.ok, via: "direct", detail: bh != null ? String(bh) : b.error });
    const fees = await tryFetch("https://mempool.space/api/v1/fees/recommended", 12000);
    if (fees.ok) state.data.fees = fees.data;
    mark("mempool fees", { ok: fees.ok, via: "direct", detail: fees.ok ? fees.data.halfHourFee + " sat/vB" : fees.error });
  }

  async function loadPoolReads() {
    const reads = {};
    const jobs = [
      ["cbtcBackingSats", ETH_RPCS, POOL, SEL.cbtcBackingSats],
      ["outstandingCusd", ETH_RPCS, ENGINE, SEL.outstandingCusd],
      ["tacSupply", ETH_RPCS, TAC, SEL.totalSupply],
      ["tacDec", ETH_RPCS, TAC, SEL.decimals],
      ["cbtcSupply", ETH_RPCS, CBTC, SEL.totalSupply],
      ["cbtcDec", ETH_RPCS, CBTC, SEL.decimals],
      ["cusdSupply", ETH_RPCS, CUSD, SEL.totalSupply],
      ["cusdDec", ETH_RPCS, CUSD, SEL.decimals],
      ["wtacSupply", ETH_RPCS, WTAC, SEL.totalSupply],
      ["wtacDec", ETH_RPCS, WTAC, SEL.decimals]
    ];
    let okN = 0;
    let rpcUsed = "";
    await Promise.all(jobs.map(async ([k, rpcs, to, data]) => {
      const r = await ethCall(rpcs, to, data);
      reads[k] = r.ok ? decodeUint(r.result) : null;
      if (r.ok) { okN++; rpcUsed = r.rpc; }
    }));
    const blk = await ethBlockNumber(ETH_RPCS);
    reads.ethBlock = blk.ok ? blk.number : null;
    state.data.chain = reads;
    mark("Ethereum RPC", { ok: okN > 0, via: "direct", detail: okN + "/10 views · block " + (reads.ethBlock ?? "—") });
  }

  async function loadKeepers() {
    const chains = [
      { id: 1, name: "Ethereum", url: "https://tacit-evm-pool-keepers.onrender.com/1/evm-pool/keeper/head" },
      { id: 8453, name: "Base", url: "https://tacit-evm-pool-keepers.onrender.com/8453/evm-pool/keeper/head" },
      { id: 4663, name: "Robinhood", url: "https://tacit-evm-pool-keepers.onrender.com/4663/evm-pool/keeper/head" }
    ];
    const out = [];
    for (const c of chains) {
      const r = await tryFetch(c.url, 15000);
      mark(c.name + " keeper", { ok: r.ok, via: "direct", detail: r.ok ? ("size " + r.data.size) : r.error });
      out.push({ ...c, ok: r.ok, data: r.data, error: r.error });
    }
    const open = await fetchOfficial("https://api.tacit.finance/confidential/open?limit=10");
    mark("relay board", { ok: open.ok, via: open.via, detail: open.ok ? ((open.data.jobs || []).length + " open jobs") : open.error });
    state.data.keepers = out;
    state.data.openBoard = open.ok ? open.data : null;
  }

  function collectEvents(assets) {
    const ev = [];
    for (const a of assets || []) {
      if (a.etch_txid) {
        ev.push({ kind: "etch", ticker: a.ticker, height: a.etched_at_height, at: a.etched_at, txid: a.etch_txid, asset: a });
      }
      for (const m of a.mints || []) {
        ev.push({ kind: "mint", ticker: a.ticker, height: m.minted_at_height, at: m.minted_at, txid: m.mint_txid, asset: a });
      }
      for (const b of a.burns || []) {
        ev.push({ kind: "burn", ticker: a.ticker, height: b.burned_at_height, at: b.burned_at, txid: b.burn_txid, amount: b.burned_amount, asset: a });
      }
    }
    ev.sort((x, y) => (y.height || 0) - (x.height || 0) || (y.at || 0) - (x.at || 0));
    return ev;
  }

  function renderBitcoin() {
    const box = $("bitcoin-body");
    const assets = state.data.assets;
    const tip = state.data.btcTip || {};
    const tipsAgree = tip.mempool != null && tip.blockstream != null && tip.mempool === tip.blockstream;
    const tipN = tip.mempool ?? tip.blockstream;
    let html = `<div class="metrics">
      ${metric("Bitcoin tip", tipN != null ? fmtInt(tipN) : "—", tipsAgree ? "mempool = blockstream" : "")}
      ${metric("Recommended fee", state.data.fees ? state.data.fees.halfHourFee + " sat/vB" : "—")}
    `;
    if (tip.mempool != null && tip.blockstream != null && !tipsAgree) {
      html += `<div class="metric wide"><div class="disagree">The two public Bitcoin explorers disagree: mempool.space ${fmtInt(tip.mempool)} vs blockstream.info ${fmtInt(tip.blockstream)}.</div></div>`;
    }
    if (!assets) {
      html += `</div><p class="note">The official assets index could not be loaded (${esc(state.data.assetsMeta?.error || "unknown")}). Open the JSON directly: <a href="https://api.tacit.finance/assets?network=mainnet" target="_blank" rel="noopener">api.tacit.finance/assets</a>.</p>`;
      box.className = "body";
      box.innerHTML = html;
      return;
    }
    const list = assets.assets || [];
    const holders = list.reduce((s, a) => s + (a.holder_count || 0), 0);
    const transfers = list.reduce((s, a) => s + (a.transfer_count || 0), 0);
    const listings = list.reduce((s, a) => s + (a.listing_count || 0), 0);
    html += `${metric("Assets etched", fmtInt(assets.count))}
      ${metric("Holders (indexed)", fmtInt(holders))}
      ${metric("Confidential transfers (indexed)", fmtInt(transfers))}
      ${metric("Live listings", fmtInt(listings))}
    </div>`;
    html += `<p class="note">${viaBadge(state.data.assetsMeta?.via)} Indexer last scanned height ${fmtInt(assets.meta?.last_scanned)}. ${
      tipN != null && assets.meta?.last_scanned
        ? (tipN - assets.meta.last_scanned === 0
          ? `<span class="agree">Matches the live Bitcoin tip.</span>`
          : `Lag vs live tip: ${fmtInt(tipN - assets.meta.last_scanned)} block(s).`)
        : ""
    }</p>`;

    const events = collectEvents(list).slice(0, 10);
    html += `<h3>Recent envelope events</h3>
      <table><thead><tr><th>Kind</th><th>Asset</th><th>Height</th><th>When (IST)</th><th>Tx</th></tr></thead><tbody>`;
    for (const e of events) {
      html += `<tr><td>${esc(e.kind)}</td><td><a href="https://tacitscan.io/assets/${esc(e.asset.asset_id)}" target="_blank" rel="noopener">${esc(e.ticker)}</a></td><td>${fmtInt(e.height)}</td><td>${esc(unixIST(e.at))}</td><td>${linkTx(e.txid)}</td></tr>`;
    }
    html += `</tbody></table>`;

    const top = [...list].sort((a, b) => (b.transfer_count || 0) - (a.transfer_count || 0)).slice(0, 8);
    html += `<h3>Assets by confidential transfers</h3>
      <table><thead><tr><th>Ticker</th><th>Holders</th><th>Transfers</th><th>Listings</th></tr></thead><tbody>`;
    for (const a of top) {
      html += `<tr><td><a href="https://tacitscan.io/assets/${esc(a.asset_id)}" target="_blank" rel="noopener">${esc(a.ticker)}</a></td><td>${fmtInt(a.holder_count)}</td><td>${fmtInt(a.transfer_count)}</td><td>${fmtInt(a.listing_count)}</td></tr>`;
    }
    html += `</tbody></table>`;

    const amm = (state.data.amm?.pools || []).find((p) => p.pool_id === AMM_POOL_ID) || (state.data.amm?.pools || [])[0];
    html += `<h3>Bitcoin-native AMM (tETH / TAC)</h3>`;
    if (amm) {
      html += `<p class="note">${viaBadge(state.data.ammMeta?.via)} Pool <code>${esc(shortHash("0x" + amm.pool_id, 4))}</code> · validation: ${esc(amm.validation || "—")} · fee ${esc(amm.fee_bps)} bps</p>
        <div class="metrics">
          ${metric("Reserve A (tETH units)", fmtInt(amm.reserve_a))}
          ${metric("Reserve B (TAC units)", fmtInt(amm.reserve_b))}
          ${metric("LP shares", fmtInt(amm.lp_total_shares))}
          ${metric("Last swap height", fmtInt(amm.last_swap_height))}
        </div>
        <p class="note">Founding reveal: ${linkTx(amm.init_txid)}. Official write-up: <a href="https://github.com/src-company/tacit/blob/main/docs/DEPLOYMENTS.md" target="_blank" rel="noopener">DEPLOYMENTS.md</a>.</p>`;
    } else {
      html += `<p class="note">Live AMM JSON could not be read here. Official endpoint: <a href="https://api.tacit.finance/amm/pools?network=mainnet" target="_blank" rel="noopener">/amm/pools</a>.</p>`;
    }

    const market = state.data.market;
    if (market) {
      const liveListings = (market.listings || []).filter((x) => !x.expired);
      const vol = (market.assets || []).reduce((s, a) => s + (a.volume_24h_sats || 0), 0);
      html += `<h3>Secondary market (public listings)</h3>
        <div class="metrics">
          ${metric("Non-expired listings", fmtInt(liveListings.length || market.listings?.length || 0))}
          ${metric("24h volume (indexed sats)", fmtInt(vol))}
        </div>
        <p class="note">${viaBadge(state.data.marketMeta?.via)} Amounts on a listing are what a seller chose to disclose. Confidential note amounts that were never listed stay hidden.</p>`;
    }

    box.className = "body";
    box.innerHTML = html;
  }

  function renderBridge() {
    const box = $("bridge-body");
    const r = state.data.reflection;
    if (!r) {
      box.className = "body";
      box.innerHTML = `<p>Reflection status failed to load. Official JSON: <a href="https://api.tacit.finance/reflection/status?network=mainnet" target="_blank" rel="noopener">/reflection/status</a>.</p>`;
      return;
    }
    const tip = state.data.btcTip || {};
    const btcTip = tip.mempool ?? tip.blockstream;
    const lagRe = r.tipHeight - r.attestedHeight;
    const lagMatch = lagRe === r.lagBlocks;
    const inFlight = r.bridgeBurns - r.bridgeMinted;
    const relay = state.data.relay;
    let html = `<div class="metrics">
      ${metric("Attested height", fmtInt(r.attestedHeight))}
      ${metric("Relay tip height", fmtInt(r.tipHeight))}
      ${metric("Lag (blocks)", fmtInt(r.lagBlocks), lagMatch ? "matches tip − attested" : "see note")}
      ${metric("Required confirmations", fmtInt(r.confirmations))}
      ${metric("Bridge burns", fmtInt(r.bridgeBurns))}
      ${metric("Bridge minted", fmtInt(r.bridgeMinted))}
      ${metric("Burns in flight", fmtInt(inFlight), "burns − minted")}
      ${metric("Burns awaiting bundle", fmtInt(r.burnsAwaitingBundle))}
      ${metric("Live notes (anonymity set)", fmtInt(r.liveNotes))}
      ${metric("Folded cross-outs", fmtInt(r.foldedCrossoutCount))}
    </div>`;
    html += `<p class="note">${viaBadge(state.data.reflectionMeta?.via)} Updated ${esc(ago(r.updatedAt))} (${esc(r.updatedAt)}).</p>`;
    if (!lagMatch) {
      html += `<p class="disagree">Recomputed lag (relay tip − attested) is ${fmtInt(lagRe)}, but the API field lagBlocks is ${fmtInt(r.lagBlocks)}.</p>`;
    } else {
      html += `<p class="agree">Lag recomputed from the API’s own heights matches lagBlocks.</p>`;
    }
    if (btcTip != null && r.tipHeight != null) {
      const d = btcTip - r.tipHeight;
      html += d === 0
        ? `<p class="agree">Relay tip matches the public Bitcoin tip (${fmtInt(btcTip)}).</p>`
        : `<p class="note">Public Bitcoin tip is ${fmtInt(btcTip)}; relay tip is ${fmtInt(r.tipHeight)} (${d > 0 ? d + " behind" : Math.abs(d) + " ahead"}).</p>`;
    }
    if (relay) {
      html += `<p class="note">Relay process: state <strong>${esc(relay.state)}</strong>, proving ${relay.proving ? "yes" : "no"}, settling ${relay.settling ? "yes" : "no"}, age ${fmtInt(relay.ageSeconds)}s, failing ${fmtInt(relay.failing)}.</p>`;
    }
    html += `<p class="note">In-flight burns are a count of public legs, not a sum of amounts. The amounts inside the corresponding notes are not visible here.</p>`;
    box.className = "body";
    box.innerHTML = html;
  }

  function renderEvm() {
    const box = $("evm-body");
    const c = state.data.chain || {};
    const tacDec = Number(c.tacDec ?? 18n);
    const cbtcDec = Number(c.cbtcDec ?? 18n);
    const cusdDec = Number(c.cusdDec ?? 18n);
    const wtacDec = Number(c.wtacDec ?? 18n);
    const sats = c.cbtcBackingSats != null ? Number(c.cbtcBackingSats) : null;
    const outstandingRaw = c.outstandingCusd;
    const outstanding8 = outstandingRaw != null ? Number(outstandingRaw) / 1e8 : null;
    let html = `<h3>Confidential pool (Ethereum), from the contracts</h3>
      <div class="metrics">
        ${metric("cBTC backing", sats != null ? fmtDec(sats / 1e8, 8) + " BTC" : "—", "cbtcBackingSats()")}
        ${metric("Outstanding cUSD", outstanding8 != null ? fmtDec(outstanding8, 8) : "—", "engine units ÷ 1e8")}
        ${metric("TAC ERC-20 supply", c.tacSupply != null ? fmtDec(fromUnits(c.tacSupply, tacDec), 4) : "—")}
        ${metric("wTAC supply", c.wtacSupply != null ? fmtDec(fromUnits(c.wtacSupply, wtacDec), 4) : "—")}
        ${metric("tacBTC ERC-20 supply", c.cbtcSupply != null ? fmtDec(fromUnits(c.cbtcSupply, cbtcDec), 8) : "—")}
        ${metric("tacUSD ERC-20 supply", c.cusdSupply != null ? fmtDec(fromUnits(c.cusdSupply, cusdDec), 8) : "—")}
      </div>
      <p class="note">Official docs: cBTC and cUSD are pool-minted; most of the value can sit in notes rather than in the public ERC-20. A tiny ERC-20 supply next to a larger <code>cbtcBackingSats()</code> or <code>outstandingCusd()</code> is expected, not a bug. Pool amounts use 8-decimal units (<a href="https://tacit.finance/build/" target="_blank" rel="noopener">tacit.finance/build</a>). Ethereum block ${fmtInt(c.ethBlock)}.</p>`;

    const farm = state.data.farm;
    if (farm) {
      html += `<h3>Launch farms (wTAC rewards)</h3>
        <p class="note">Manager <code>${esc(farm.manager)}</code> · ${esc(farm.epoch?.ratePerDayTac)} TAC/day · treasury ${esc(farm.epoch?.treasuryTac)} TAC · runway ${farm.epoch?.fundedRunwaySeconds ? (farm.epoch.fundedRunwaySeconds / 86400).toFixed(1) + "d" : "—"}.</p>
        <table><thead><tr><th>Pair</th><th>Weight</th><th>TAC / day</th><th>Reserve A</th><th>Reserve B</th></tr></thead><tbody>`;
      for (const p of farm.pools || []) {
        html += `<tr><td>${esc(p.pair)}</td><td>${esc(p.sharePct)}%</td><td>${esc(p.tacPerDayForPool)}</td><td>${fmtInt(p.reserves?.reserveA)}</td><td>${fmtInt(p.reserves?.reserveB)}</td></tr>`;
      }
      html += `</tbody></table>
        <p class="note">These farm reserves are public pool-side figures from the official farm program API. Individual note amounts remain hidden.</p>`;
    }

    html += `<h3>Pay pool heads (TacitEvmPool)</h3>
      <p class="note">Same pool address on every chain: <code>${EVM_POOL}</code>. Size is the keeper’s public tree size, not an amount.</p>
      <table><thead><tr><th>Chain</th><th>Size</th><th>Pending</th><th>Root (public)</th></tr></thead><tbody>`;
    for (const k of state.data.keepers || []) {
      if (!k.ok) {
        html += `<tr><td>${esc(k.name)}</td><td colspan="3">Failed: ${esc(k.error)}</td></tr>`;
        continue;
      }
      const pending = (k.data.pending || []).length;
      html += `<tr><td>${esc(k.name)} (${k.id})</td><td>${fmtInt(k.data.size)}</td><td>${fmtInt(pending)}</td><td class="mono">${esc(shortHash(k.data.root, 6))}</td></tr>`;
    }
    html += `</tbody></table>`;
    const jobs = state.data.openBoard?.jobs || [];
    html += `<p class="note">Open relay board jobs for the confidential pool: ${fmtInt(jobs.length)} (public job metadata only).</p>`;
    box.className = "body";
    box.innerHTML = html;
  }

  function renderPrivacy() {
    const box = $("privacy-body");
    const r = state.data.reflection || {};
    const assets = state.data.assets;
    const transfers = (assets?.assets || []).reduce((s, a) => s + (a.transfer_count || 0), 0);
    const inFlight = r.bridgeBurns != null ? r.bridgeBurns - r.bridgeMinted : null;
    const html = `<div class="split">
      <div class="col">
        <p><span class="badge public">Public</span> An observer can see</p>
        <ul>
          <li>Timing and heights: Bitcoin tip, relay tip, attested height, confirmation lag${r.lagBlocks != null ? ` (now ${fmtInt(r.lagBlocks)} blocks)` : ""}.</li>
          <li>Counts: ${fmtInt(r.liveNotes)} live notes, ${fmtInt(r.bridgeBurns)} bridge burns, ${fmtInt(r.bridgeMinted)} mints, ${fmtInt(inFlight)} still in flight, ${fmtInt(transfers)} indexed confidential transfers, ${fmtInt(assets?.count)} etched assets.</li>
          <li>Fees: Bitcoin recommended fees, farm rates, AMM fee bps, public ERC-20 supplies, <code>cbtcBackingSats()</code> and <code>outstandingCusd()</code>.</li>
          <li>Public addresses and txids on the clear legs: etches, burns, listings, EVM token contracts, pay-pool roots.</li>
        </ul>
      </div>
      <div class="col hidden-col">
        <p><span class="badge hidden">Hidden</span> This page cannot show, and should not</p>
        <ul>
          <li>Amounts inside confidential notes, and the links between notes (the spend graph).</li>
          <li>Who owns a tacit1 account, unless they published a corresponding public trail themselves.</li>
          <li>The contents of a note given only the address. A lookup here will never ask for a key in order to “reveal” more.</li>
          <li>Anything a seller did not disclose on a public listing. Listings are optional openings, not a deanonymising index.</li>
        </ul>
      </div>
    </div>
    <p class="note" style="margin-top:14px">Blind spots of this page itself: some official indexer routes are origin-locked to tacit.finance, so a third-party explorer may have to relay them (labelled when that happens). The page does not reconstruct the Bitcoin envelope set from raw blocks — it reads Tacit's public indexer and explorers, then cross-checks heights and contract views. If you need the envelope decode itself, use <a href="https://tacitscan.io/" target="_blank" rel="noopener">tacitscan.io</a>.</p>`;
    box.className = "body";
    box.innerHTML = html;
  }

  function renderVerify() {
    const box = $("verify-body");
    const cmds = [
      `curl -sS https://mempool.space/api/blocks/tip/height`,
      `curl -sS https://blockstream.info/api/blocks/tip/height`,
      `curl -sS "https://api.tacit.finance/reflection/status?network=mainnet"`,
      `curl -sS https://api.tacit.finance/confidential/relay`,
      `cast call 0x000000000Ed1eabD231Be41d93b719056F7febFC "cbtcBackingSats()(uint256)" --rpc-url https://ethereum-rpc.publicnode.com`,
      `cast call 0x000000003f608BDdF0ca45934003ffb9DbDF70DB "outstandingCusd()(uint256)" --rpc-url https://ethereum-rpc.publicnode.com`,
      `cast call 0xA1313eb9f3A445606D9583bcAc3ebeB56a858279 "totalSupply()(uint256)" --rpc-url https://ethereum-rpc.publicnode.com`,
      `curl -sS https://tacit-evm-pool-keepers.onrender.com/8453/evm-pool/keeper/head`
    ];
    box.className = "body";
    box.innerHTML = `<p class="note">Paste any of these into a terminal. They are reads only.</p>` +
      cmds.map((c) => `<pre class="cmd">${esc(c)}</pre>`).join("");
  }

  function looksTxid(s) {
    return /^(0x)?[0-9a-fA-F]{64}$/.test(s);
  }
  function looksAddr(s) {
    return /^0x[0-9a-fA-F]{40}$/.test(s);
  }
  function looksTacit1(s) {
    return /^tacit1[0-9a-z]+$/i.test(s);
  }
  function looksXns(s) {
    return /^[^@\s]+@[^@\s]+$/.test(s);
  }

  async function doLookup(raw) {
    const q = raw.trim();
    const out = $("lookup-out");
    out.hidden = false;
    if (!q) { out.innerHTML = `<p>Type a tacit1 ID, a Bitcoin txid, an EVM address, or an XNS name such as vitalik@eth.</p>`; return; }
    out.innerHTML = `<p>Looking up public data for <code>${esc(q)}</code>…</p>`;

    if (looksTacit1(q)) {
      const url = "https://tacitscan.io/address/" + encodeURIComponent(q);
      out.innerHTML = `<h3>Tacit account</h3>
        <p>A tacit1 ID is a Tacit account identifier. This page will not derive keys or scan private notes for it. The public envelope explorer is the right place to see whatever is already visible.</p>
        <p><a href="${esc(url)}" target="_blank" rel="noopener">Open ${esc(q)} on tacitscan.io</a></p>`;
      return;
    }

    if (looksXns(q)) {
      const data = SEL.getAddress + encodeString(q);
      const r = await ethCall(ETH_RPCS, XNS, data);
      if (!r.ok) { out.innerHTML = `<p>XNS lookup failed: ${esc(r.error)}</p>`; return; }
      const addr = "0x" + r.result.slice(-40);
      if (/^0x0+$/.test(addr)) {
        out.innerHTML = `<p>XNS name <code>${esc(q)}</code> is not registered (getAddress returned the zero address). Official registry: <code>${XNS}</code>.</p>`;
        return;
      }
      out.innerHTML = `<p>XNS <code>${esc(q)}</code> resolves on Ethereum to <code>${esc(addr)}</code>. Fetching the public footprint of that address…</p>`;
      await renderEvmFootprint(out, addr, q);
      return;
    }

    if (looksAddr(q)) {
      await renderEvmFootprint(out, q, null);
      return;
    }

    if (looksTxid(q)) {
      const txid = q.replace(/^0x/, "").toLowerCase();
      const [mp, evm] = await Promise.all([
        tryFetch("https://mempool.space/api/tx/" + txid, 15000),
        lookupEvmTx(txid)
      ]);
      let html = `<h3>Transaction</h3>`;
      if (mp.ok && mp.data && mp.data.txid) {
        const t = mp.data;
        html += `<p>Found on Bitcoin via mempool.space.</p>
          <dl class="kv">
            <dt>Txid</dt><dd>${linkTx(t.txid)}</dd>
            <dt>Status</dt><dd>${t.status?.confirmed ? "confirmed in block " + fmtInt(t.status.block_height) : "unconfirmed"}</dd>
            <dt>Fee</dt><dd>${t.fee != null ? fmtInt(t.fee) + " sats" : "—"}</dd>
            <dt>Inputs / outputs</dt><dd>${fmtInt(t.vin?.length)} / ${fmtInt(t.vout?.length)}</dd>
          </dl>
          <p class="note">Envelope decode (if this is a Tacit transaction): <a href="https://tacitscan.io/tx/${esc(txid)}" target="_blank" rel="noopener">tacitscan.io/tx/${esc(shortHash(txid))}</a>. Amounts in confidential envelopes stay hidden there too, except what the protocol makes public.</p>`;
      } else if (evm) {
        html += evm;
      } else {
        html += `<p>No Bitcoin transaction with that id was found on mempool.space, and it was not found on the Ethereum or Base RPCs either. You can still try <a href="https://tacitscan.io/tx/${esc(txid)}" target="_blank" rel="noopener">tacitscan</a>.</p>`;
      }
      out.innerHTML = html;
      return;
    }

    out.innerHTML = `<p>That does not look like a tacit1 ID, a 64-character Bitcoin txid, a 0x EVM address, or an XNS <code>name@namespace</code>.</p>`;
  }

  async function lookupEvmTx(txid) {
    const hash = txid.startsWith("0x") ? txid : "0x" + txid;
    const tryOne = async (rpcs, label, expl) => {
      for (const rpc of rpcs) {
        try {
          const res = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [hash] })
          });
          const body = await res.json();
          if (body.result) {
            const t = body.result;
            return `<p>Found on ${esc(label)}.</p>
              <dl class="kv">
                <dt>Hash</dt><dd><a href="${expl}${t.hash}" target="_blank" rel="noopener">${esc(t.hash)}</a></dd>
                <dt>From</dt><dd>${esc(t.from)}</dd>
                <dt>To</dt><dd>${esc(t.to || "(contract creation)")}</dd>
                <dt>Block</dt><dd>${t.blockNumber ? parseInt(t.blockNumber, 16) : "pending"}</dd>
              </dl>`;
          }
        } catch {}
      }
      return null;
    };
    return (await tryOne(ETH_RPCS, "Ethereum", "https://etherscan.io/tx/"))
        || (await tryOne(BASE_RPCS, "Base", "https://basescan.org/tx/"));
  }

  async function renderEvmFootprint(out, address, xnsFrom) {
    const addr = address.toLowerCase();
    const checksum = address; // display as given
    const nameCall = await ethCall(ETH_RPCS, XNS, SEL.getName + encodeAddress(addr));
    const xnsName = nameCall.ok ? decodeString(nameCall.result) : "";
    const [ethBal, baseBal, tacBal, cbtcBal, cusdBal, wtacBal] = await Promise.all([
      ethBalance(ETH_RPCS, addr),
      ethBalance(BASE_RPCS, addr),
      ethCall(ETH_RPCS, TAC, SEL.balanceOf + encodeAddress(addr)),
      ethCall(ETH_RPCS, CBTC, SEL.balanceOf + encodeAddress(addr)),
      ethCall(ETH_RPCS, CUSD, SEL.balanceOf + encodeAddress(addr)),
      ethCall(ETH_RPCS, WTAC, SEL.balanceOf + encodeAddress(addr))
    ]);
    const dec = (r, d) => r.ok && r.result ? fmtDec(fromUnits(decodeUint(r.result), d), 8) : "—";
    const wei = (b) => b.ok ? fmtDec(fromUnits(b.wei, 18), 8) + " ETH" : "—";
    out.innerHTML = `<h3>EVM address footprint (public)</h3>
      <dl class="kv">
        <dt>Address</dt><dd>${esc(checksum)}</dd>
        <dt>XNS name</dt><dd>${xnsName ? esc(xnsName) : (xnsFrom ? esc(xnsFrom) + " (forward lookup)" : "none registered")}</dd>
        <dt>Ethereum ETH</dt><dd>${wei(ethBal)}</dd>
        <dt>Base ETH</dt><dd>${wei(baseBal)}</dd>
        <dt>TAC</dt><dd>${dec(tacBal, 18)}</dd>
        <dt>tacBTC ERC-20</dt><dd>${dec(cbtcBal, 18)}</dd>
        <dt>tacUSD ERC-20</dt><dd>${dec(cusdBal, 18)}</dd>
        <dt>wTAC</dt><dd>${dec(wtacBal, 18)}</dd>
      </dl>
      <p>
        <a href="https://etherscan.io/address/${esc(addr)}" target="_blank" rel="noopener">Etherscan</a> ·
        <a href="https://basescan.org/address/${esc(addr)}" target="_blank" rel="noopener">Basescan</a> ·
        <a href="https://xns.name/resolve" target="_blank" rel="noopener">XNS resolve</a>
      </p>
      <p class="note">These are public ERC-20 and ETH balances only. Confidential-pool notes held by this address are not listed here and cannot be listed without the spending key, which this page will not ask for.</p>`;
  }

  $("lookup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    doLookup($("q").value);
  });

  const preset = new URLSearchParams(location.search).get("q");
  if (preset) {
    $("q").value = preset;
    doLookup(preset);
  }

  loadAll();
})();
