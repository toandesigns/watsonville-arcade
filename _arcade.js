/* ============================================================
   Arcade — shared player + leaderboard helpers (localStorage).
   Exposes window.Arcade with:
     listPlayers()                 -> [{name, color}]
     addPlayer(name)               -> {name, color}
     currentPlayer() / setCurrent(name)
     addScore(gameKey, name, score)
     topScores(gameKey, n=5)       -> [{player, score, when}]
     initialOf(name)               -> "A" or "UT"
   ============================================================ */
(function () {
  const KEY_PLAYERS = 'arcade-players';
  const KEY_CURRENT = 'arcade-current-player';
  const KEY_SCORES  = 'arcade-scores';

  const DEFAULTS = [
    { name: 'Atlas',      color: '#ff8c42' },
    { name: 'Dakota',     color: '#7ec45b' },
    { name: 'Cathy',      color: '#e85d8c' },
    { name: 'Nick',       color: '#4a90d9' },
    { name: 'Uncle Toan', color: '#9163d0' },
  ];

  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  function colorForName(name) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
    return `hsl(${Math.abs(h) % 360}, 65%, 55%)`;
  }

  /* Merge defaults with anything the user has added. Defaults always
     appear; custom players persist across visits. */
  function listPlayers() {
    const customs = load(KEY_PLAYERS, []);
    const seen = new Set();
    const out = [];
    for (const p of DEFAULTS) { out.push(p); seen.add(p.name.toLowerCase()); }
    for (const p of customs) {
      const k = p.name.toLowerCase();
      if (!seen.has(k)) { out.push(p); seen.add(k); }
    }
    return out;
  }

  function addPlayer(name) {
    name = String(name || '').trim().slice(0, 24);
    if (!name) return null;
    const list = listPlayers();
    let existing = list.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const player = { name, color: colorForName(name) };
    const customs = load(KEY_PLAYERS, []);
    customs.push(player);
    save(KEY_PLAYERS, customs);
    return player;
  }

  function currentPlayer() {
    const name = localStorage.getItem(KEY_CURRENT);
    if (!name) return null;
    return listPlayers().find(p => p.name === name) || null;
  }
  function setCurrent(name) {
    try { localStorage.setItem(KEY_CURRENT, name); } catch {}
  }

  function addScore(gameKey, playerName, score) {
    const key = `${KEY_SCORES}-${gameKey}`;
    const list = load(key, []);
    list.push({ player: playerName, score, when: Date.now() });
    /* Cap stored history so localStorage doesn't grow unbounded. */
    if (list.length > 200) list.splice(0, list.length - 200);
    save(key, list);
  }

  /* Top N — one entry per player, their best ever. */
  function topScores(gameKey, n) {
    const key = `${KEY_SCORES}-${gameKey}`;
    const list = load(key, []);
    const byPlayer = {};
    for (const e of list) {
      const cur = byPlayer[e.player];
      if (!cur || e.score > cur.score) byPlayer[e.player] = e;
    }
    return Object.values(byPlayer)
      .sort((a, b) => b.score - a.score)
      .slice(0, n || 5);
  }

  function initialOf(name) {
    const parts = String(name || '').trim().split(/\s+/);
    if (!parts[0]) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* ---------- UI render helpers ----------
     Both games inject their own picker / leaderboard markup; the
     helpers below populate it. Markup expects CSS classes defined
     in each game's stylesheet: .picker .who .avatar .name .add,
     and .leaderboard .row .av .n .s. */
  function renderPicker(container, opts) {
    container.innerHTML = '';
    const players = listPlayers();
    const current = (opts && opts.currentName) || '';
    for (const p of players) {
      const btn = document.createElement('button');
      btn.className = 'who' + (p.name === current ? ' selected' : '');
      btn.type = 'button';
      btn.innerHTML =
        `<span class="avatar" style="background:${p.color}">${initialOf(p.name)}</span>` +
        `<span class="name">${escapeHtml(p.name)}</span>`;
      btn.addEventListener('click', () => opts.onPick(p));
      container.appendChild(btn);
    }
    const add = document.createElement('button');
    add.className = 'who add';
    add.type = 'button';
    add.innerHTML = `<span class="avatar">+</span><span class="name">Add</span>`;
    add.addEventListener('click', () => {
      const name = (prompt('Who is playing? Type a name.') || '').trim();
      if (!name) return;
      const player = addPlayer(name);
      if (player) opts.onPick(player);
    });
    container.appendChild(add);
  }

  function renderLeaderboard(container, gameKey, opts) {
    const currentName = (opts && opts.currentName) || '';
    const top = topScores(gameKey, 5);
    if (top.length === 0) {
      container.innerHTML =
        '<div class="lb-title">Leaderboard</div>' +
        '<div class="empty">No scores yet — be the first!</div>';
      return;
    }
    const players = listPlayers();
    let html = '<div class="lb-title">Leaderboard</div>';
    top.forEach((e, i) => {
      const p = players.find(x => x.name === e.player) || { color: colorForName(e.player) };
      const mine = e.player === currentName ? ' mine' : '';
      const rank = ['🥇', '🥈', '🥉'][i] || `${i + 1}`;
      html +=
        `<div class="row${mine}">` +
          `<span class="av" style="background:${p.color}">${initialOf(e.player)}</span>` +
          `<span class="n">${escapeHtml(e.player)}</span>` +
          `<span class="s">${rank} ${e.score}</span>` +
        `</div>`;
    });
    container.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]
    ));
  }

  window.Arcade = {
    listPlayers, addPlayer,
    currentPlayer, setCurrent,
    addScore, topScores,
    initialOf, colorForName,
    renderPicker, renderLeaderboard,
  };
})();
