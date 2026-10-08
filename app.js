// Italienisch-Vokabeltrainer – Daten liegen lokal im Browser (localStorage).
const KEY = 'ital-trainer-v1';
const DAY = 86400000;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let state = load();
let view = 'home';
let session = null; // {queue, current, revealed, mode, result}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.cards) { if (!s.unlocked) s.unlocked = ['a1-basis']; if (!s.log) s.log = {}; if (!s.since) s.since = ymd(new Date()); return s; }
  } catch (e) {}
  const now = Date.now();
  return {
    cards: PACKS[0].words.map(([it, de], i) => newCard(it, de, now + i, PACKS[0].id)),
    unlocked: [PACKS[0].id], mode: 'flip', reviewed: {}, newPerDay: 10, log: {}, since: ymd(new Date()),
  };
}
function newCard(it, de, id, pack = 'own') { return { id, it, de, pack, ease: 2.5, interval: 0, due: 0, reps: 0, seen: false }; }

// --- Wortpakete ---
const UNLOCK_AT = 0.8; // Anteil gefestigter Karten (Intervall >= 21 Tage)
function packProgress(id) {
  const cs = state.cards.filter((c) => c.pack === id || (id === 'a1-basis' && !c.pack));
  return cs.length ? cs.filter((c) => c.interval >= 21).length / cs.length : 0;
}
function nextPack() { return PACKS.find((p) => !state.unlocked.includes(p.id)); }
function unlockPack(p) {
  let t = Date.now();
  state.unlocked.push(p.id);
  for (const [it, de] of p.words) if (!state.cards.some((c) => wordKey(c.it) === wordKey(it))) state.cards.push(newCard(it, de, t++, p.id));
  session = null; save();
}
function autoUnlock() {
  const next = nextPack();
  const last = PACKS.filter((p) => state.unlocked.includes(p.id)).pop();
  if (next && last && packProgress(last.id) >= UNLOCK_AT) { unlockPack(next); return next; }
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
const today = () => ymd(new Date());

// --- Spaced Repetition (vereinfachtes SM-2) ---
// grade: 0 = nochmal, 1 = schwer, 2 = gut, 3 = leicht
function grade(card, g) {
  const now = Date.now();
  if (g === 0) { card.reps = 0; card.interval = 0; card.ease = Math.max(1.3, card.ease - 0.2); card.due = now + 60000; return; }
  card.seen = true;
  card.reps++;
  if (g === 1) { card.ease = Math.max(1.3, card.ease - 0.15); card.interval = Math.max(1, Math.round((card.interval || 1) * 1.2)); }
  else if (g === 2) { card.interval = card.reps === 1 ? 1 : card.reps === 2 ? 3 : Math.round(card.interval * card.ease); }
  else { card.ease += 0.15; card.interval = card.reps === 1 ? 3 : Math.round(Math.max(card.interval, 1) * card.ease * 1.3); }
  card.due = now + card.interval * DAY;
}

// Zusätzliche neue Wörter, die heute über das Tageslimit hinaus freigegeben wurden
function extraNew() { return state.extra && state.extra.day === today() ? state.extra.n : 0; }
function buildQueue() {
  const now = Date.now();
  const doneNew = state.reviewed[today()] || 0;
  const due = state.cards.filter((c) => c.seen && c.due <= now).sort((a, b) => a.due - b.due);
  // Eigene Wörter haben Vorrang vor Paketwörtern
  const isOwn = (c) => (c.pack === 'own' || c.priority ? 0 : 1);
  const fresh = state.cards.filter((c) => !c.seen).sort((a, b) => isOwn(a) - isOwn(b))
    .slice(0, Math.max(0, state.newPerDay + extraNew() - doneNew));
  return [...due, ...fresh];
}

// mode: 'more' = 10 weitere neue Wörter, 'practice' = Übungsrunde (ändert den Lernplan nicht)
function startSession(mode) {
  if (mode === 'more') state.extra = { day: today(), n: extraNew() + 10 };
  if (mode === 'practice') {
    const queue = state.cards.filter((c) => c.seen).sort((a, b) => a.due - b.due).slice(0, 20);
    session = { queue, revealed: false, result: null, done: 0, practice: true };
  } else session = { queue: buildQueue(), revealed: false, result: null, done: 0 };
  if (mode === 'more') save();
  render();
}

// --- Views ---
function render() {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  const app = $('#app');
  if (view === 'home') app.innerHTML = homeView();
  else if (view === 'words') app.innerHTML = wordsView();
  else app.innerHTML = statsView();
  if (view === 'home') { const i = $('#ans'); if (i && !session.revealed) i.focus(); }
}

function homeView() {
  if (!session) session = { queue: buildQueue(), revealed: false, result: null, done: 0 };
  const c = session.queue[0];
  const left = session.queue.length;
  if (!c) {
    return `${topBar(0)}<div class="card flash" style="cursor:default;font-size:30px">${session.practice ? 'Übungsrunde beendet' : 'Für heute ist alles gelernt'}<small>${session.done} Karten in dieser Runde</small></div>
      ${state.cards.some((c) => !c.seen) ? `<button class="pri" onclick="startSession('more')">10 weitere neue Wörter</button>` : ''}
      ${state.cards.some((c) => c.seen) ? `<button class="sec" onclick="startSession('practice')">Gelernte Wörter üben</button>` : ''}
      <p class="mut" style="text-align:center;margin-top:12px">Übungsrunden ändern deinen Lernplan nicht.</p>`;
  }
  // Richtung: neue/unsichere Karten IT -> DE, sonst DE -> IT (aktiver Abruf)
  const toIt = c.reps >= 2;
  const q = toIt ? c.de : c.it, a = toIt ? c.it : c.de;
  let body;
  if (state.mode === 'type') {
    if (!session.revealed) {
      body = `<div class="card flash" style="cursor:default">${esc(q)}<small>${toIt ? 'Auf Italienisch?' : 'Auf Deutsch?'}</small></div>
        <input id="ans" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Antwort eintippen"
          onkeydown="if(event.key==='Enter')check()">
        <button class="pri" onclick="check()">Prüfen</button><button class="sec" onclick="reveal()">Weiß ich nicht</button>`;
    } else {
      body = `<div class="card flash" style="cursor:default">${esc(q)}
        <div class="ans">${esc(a)}</div>
        ${feedback(session.result)}</div>${gradeButtons()}`;
    }
  } else {
    body = `<div class="card flash" onclick="reveal()">${esc(q)}
      ${session.revealed ? `<div class="ans">${esc(a)}</div>` : `<small>Tippen zum Umdrehen</small>`}</div>
      ${session.revealed ? gradeButtons() : ''}`;
  }
  return `${topBar(left)}${body}`;
}
// Kopfzeile: übrige Karten, Modus, Serie + Fortschrittsbalken (erledigt / gesamt in dieser Runde)
function topBar(left) {
  const total = session.done + left;
  const pct = total ? Math.round((session.done / total) * 100) : 100;
  const s = streak();
  return `<div class="top"><span>${left} übrig</span>
    <span><a href="#" onclick="setMode('${state.mode === 'flip' ? 'type' : 'flip'}');return false" style="color:var(--mut)">${state.mode === 'flip' ? 'Umdrehen' : 'Tippen'} ⇄</a></span>
    <span>${s ? 'Serie ' + s + (s === 1 ? ' Tag' : ' Tage') : 'Los geht\'s'}</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>`;
}
function streak() {
  const st = state.streak;
  if (!st) return 0;
  const d = (x) => Math.round(new Date(x) / 86400000);
  return d(today()) - d(st.last) <= 1 ? st.count : 0;
}
function gradeButtons() {
  return `<div class="row">
    <button class="b0" onclick="answer(0)">Nochmal</button><button class="b1" onclick="answer(1)">Schwer</button>
    <button class="b2" onclick="answer(2)">Gut</button><button class="b3" onclick="answer(3)">Leicht</button></div>`;
}

function wordsView() {
  const list = [...state.cards].sort((a, b) => a.it.localeCompare(b.it, 'it'));
  return `<h1>Wörter (${list.length})</h1>
    <div class="card"><b>Neues Wort</b>
      <input id="nit" placeholder="Italienisch" autocapitalize="off" autocorrect="off" spellcheck="false" oninput="liveCheck()">
      <div id="status" class="mut" style="margin-top:6px"></div>
      <input id="nde" placeholder="Deutsch" oninput="$('#dup').innerHTML=''">
      <div id="dup" style="margin-top:8px"></div>
      <button class="pri" onclick="addWord()">Prüfen &amp; hinzufügen</button></div>
    <div class="card"><b>Import</b><p class="mut">Eine Zeile pro Wort: <code>italienisch;deutsch</code> (oder Tab / Komma)</p>
      <textarea id="imp" rows="4" placeholder="il gatto;die Katze"></textarea>
      <button class="sec" onclick="importWords()">Importieren</button></div>
    <div class="card"><b>Teilen und Backup</b>
      <p class="mut">${state.cards.filter((c) => c.pack === 'own').length} eigene Wörter. Teilen enthält nur Italienisch und Deutsch, das Backup alles (Fortschritt, Statistik).</p>
      <button onclick="shareWords()">Eigene Wörter teilen</button>
      <button class="sec" onclick="copyWords()">Eigene Wörter kopieren</button>
      <button class="sec" onclick="exportBackup()">Backup speichern</button>
      <button class="sec" onclick="$('#restore').click()">Backup wiederherstellen</button>
      <input id="restore" type="file" accept=".json,application/json" style="display:none" onchange="restoreBackup(this.files[0])"></div>
    <div class="card">${list.map((c) => `<div class="word"><span>${esc(c.it)}</span><span>${esc(c.de)}
      <a href="#" onclick="delWord(${c.id});return false" style="margin-left:8px">✕</a></span></div>`).join('')}</div>`;
}

let statsRange = 'week';
// Wiederholungen / neue Wörter / aktive Tage je Woche (Mo–So), Monat oder Jahr; neueste zuerst
function buckets(range) {
  const now = new Date(), out = [];
  const startOf = (d) => {
    const x = new Date(d.getFullYear(), range === 'year' ? 0 : range === 'month' ? d.getMonth() : d.getMonth(), range === 'week' ? d.getDate() - ((d.getDay() + 6) % 7) : 1);
    return x;
  };
  const count = range === 'week' ? 8 : range === 'month' ? 6 : Math.max(1, now.getFullYear() - new Date(state.since).getFullYear() + 1);
  let cur = startOf(now);
  for (let i = 0; i < count; i++) {
    const next = range === 'week' ? new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7)
      : range === 'month' ? new Date(cur.getFullYear(), cur.getMonth() + 1, 1) : new Date(cur.getFullYear() + 1, 0, 1);
    const b = { r: 0, n: 0, d: 0 };
    for (const [day, v] of Object.entries(state.log)) if (day >= ymd(cur) && day < ymd(next)) { b.r += v.r; b.n += v.n; if (v.r) b.d++; }
    b.label = range === 'week' ? (i === 0 ? 'Diese Woche' : i === 1 ? 'Letzte Woche' : 'ab ' + cur.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }))
      : range === 'month' ? cur.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : String(cur.getFullYear());
    out.push(b);
    cur = range === 'week' ? new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 7)
      : range === 'month' ? new Date(cur.getFullYear(), cur.getMonth() - 1, 1) : new Date(cur.getFullYear() - 1, 0, 1);
  }
  return out;
}
function activityRows() {
  const bs = buckets(statsRange), max = Math.max(1, ...bs.map((b) => b.r));
  return bs.map((b) => `<div style="margin-top:14px"><div style="display:flex;justify-content:space-between">
      <span>${esc(b.label)}</span><span>${b.r} <span class="mut">Wiederholungen</span></span></div>
      <div class="bar" style="margin:4px 0"><i style="width:${Math.round((b.r / max) * 100)}%"></i></div>
      <div class="mut">${b.n} neue Wörter · ${b.d} ${b.d === 1 ? 'Tag' : 'Tage'} aktiv</div></div>`).join('');
}

function statsView() {
  const n = state.cards.length, now = Date.now();
  const seen = state.cards.filter((c) => c.seen).length;
  const known = state.cards.filter((c) => c.interval >= 21).length;
  const due = state.cards.filter((c) => c.seen && c.due <= now).length;
  const pct = (x) => (n ? Math.round((x / n) * 100) : 0);
  const learning = seen - known, unseen = n - seen;
  const row = (label, k, cls) => `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px">
      <span>${label}</span><span><span class="big" style="font-size:28px">${k}</span> <span class="mut">${pct(k)} %</span></span></div>
      <div class="bar" style="margin:4px 0 0"><i style="width:${pct(k)}%;${cls}"></i></div>`;
  const days = Math.floor((new Date(today()) - new Date(state.since)) / 86400000) + 1;
  const activeDays = Object.keys(state.log).filter((d) => state.log[d].r > 0).length;
  return `<h1>Statistik</h1>
    <div class="card"><div class="mut">Du lernst seit</div>
      <div class="big">${days} ${days === 1 ? 'Tag' : 'Tagen'}</div>
      <div class="mut">Start ${new Date(state.since).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
        · an ${activeDays} ${activeDays === 1 ? 'Tag' : 'Tagen'} gelernt${streak() ? ' · Serie ' + streak() : ''}</div></div>
    <div class="card"><b>Wortschatz</b> <span class="mut">(${n} Wörter)</span>
      ${row('Beherrsche ich', known, '')}
      ${row('Lerne ich gerade', learning, 'background:#c9b97a')}
      ${row('Noch nicht gelernt', unseen, 'background:var(--line2)')}
      <p class="mut" style="margin-top:14px">Beherrscht = nächste Wiederholung in mindestens 21 Tagen. Heute fällig: ${due}.</p></div>
    <div class="card"><b>Aktivität</b>
      <div class="row" style="margin:10px 0 4px">${[['week', 'Woche'], ['month', 'Monat'], ['year', 'Jahr']].map(([k, l]) =>
        `<button class="${statsRange === k ? 'on' : 'sec'}" onclick="statsRange='${k}';render()">${l}</button>`).join('')}</div>
      ${activityRows()}</div>
    <div class="card"><b>Wortpakete</b>
      ${PACKS.map((p) => state.unlocked.includes(p.id)
        ? `<div class="mut" style="margin-top:10px">${esc(p.name)} · ${Math.round(packProgress(p.id) * 100)} % gefestigt</div>
           <div class="bar"><i style="width:${Math.round(packProgress(p.id) * 100)}%"></i></div>`
        : `<div class="mut" style="margin-top:10px">gesperrt · ${esc(p.name)} (${p.words.length} Wörter)</div>`).join('')}
      <p class="mut">Das nächste Paket öffnet sich automatisch bei ${UNLOCK_AT * 100} % im letzten freigeschalteten.</p>
      ${nextPack() ? `<button class="sec" onclick="if(confirm('Paket jetzt freischalten?')){unlockPack(nextPack());render()}">Nächstes Paket jetzt freischalten</button>` : ''}</div>
    <div class="card"><b>Neue Wörter pro Tag</b>
      <input type="number" min="1" max="50" value="${state.newPerDay}" onchange="state.newPerDay=Math.max(1,+this.value||10);save()">
      <button class="sec" onclick="resetAll()">Alles zurücksetzen</button></div>`;
}

// --- Aktionen ---
function setMode(m) { state.mode = m; save(); session.revealed = false; session.result = null; render(); }
function reveal() { session.revealed = true; render(); }
// --- Antwort prüfen (Tippen-Modus) ---
// Stufen: ok (exakt) > accent (Akzent/Umlaut fehlt) > article (Artikel fehlt) > close (kleiner Tippfehler) > wrong
const strictForm = (s) => s.toLowerCase().replace(/[’`´]/g, "'").replace(/[^\p{L}\p{N}' ]/gu, '').replace(/\s+/g, ' ').trim();
const looseForm = (s) => strictForm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const noArticle = (s) => s.replace(/^(il|lo|la|i|gli|le|un|uno|una|der|die|das|ein|eine)\s+/, '').replace(/^(l|un|dell|all)'/, '');
const RANK = { ok: 4, accent: 3, article: 2, close: 1, wrong: 0 };
function compareAnswer(given, option) {
  const g = strictForm(given), t = strictForm(option);
  if (!g) return 'wrong';
  if (g === t) return 'ok';
  const gl = looseForm(given), tl = looseForm(option);
  if (gl === tl) return 'accent';
  const ga = noArticle(gl), ta = noArticle(tl);
  if (ga === ta) return 'article';
  const limit = ta.length >= 8 ? 2 : ta.length >= 4 ? 1 : 0;
  return distance(ga, ta) <= limit ? 'close' : 'wrong';
}
// Zielwort mit hervorgehobenen Buchstaben, die in deiner Eingabe fehlten oder falsch waren
function highlightDiff(given, target) {
  const g = [...strictForm(given)], t = [...target];
  const tl = t.map((ch) => ch.toLowerCase());
  const d = Array.from({ length: g.length + 1 }, (_, i) => [i, ...Array(t.length).fill(0)]);
  for (let j = 1; j <= t.length; j++) d[0][j] = j;
  for (let i = 1; i <= g.length; i++) for (let j = 1; j <= t.length; j++)
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (g[i-1] === tl[j-1] ? 0 : 1));
  const bad = new Set();
  let i = g.length, j = t.length;
  while (j > 0) {
    if (i > 0 && d[i][j] === d[i-1][j-1] + (g[i-1] === tl[j-1] ? 0 : 1)) { if (g[i-1] !== tl[j-1]) bad.add(j - 1); i--; j--; }
    else if (i > 0 && d[i][j] === d[i-1][j] + 1) i--;
    else { bad.add(j - 1); j--; }
  }
  return t.map((ch, k) => (bad.has(k) ? `<b style="color:var(--bad)">${esc(ch)}</b>` : esc(ch))).join('');
}
function check() {
  const c = session.queue[0];
  const toIt = c.reps >= 2;
  const given = $('#ans').value;
  // mehrere Lösungen erlaubt ("hallo / tschüss"); Klammerzusätze zählen nicht
  const options = (toIt ? c.it : c.de).split('/').map((x) => x.replace(/\(.*?\)/g, '').trim()).filter(Boolean);
  let best = { status: 'wrong', target: options[0] };
  for (const o of options) { const st = compareAnswer(given, o); if (RANK[st] > RANK[best.status]) best = { status: st, target: o }; }
  session.result = { ...best, given: given.trim() };
  session.revealed = true;
  render();
}
function feedback(r) {
  if (!r) return '';
  const msg = { ok: '✓ richtig', accent: '✓ richtig – achte auf Akzente und Umlaute', article: 'Fast richtig – es fehlt der Artikel',
    close: 'Fast richtig – achte auf die Schreibweise', wrong: '✗ falsch' }[r.status];
  const detail = r.status !== 'ok' && r.given
    ? `<div style="font:15px -apple-system,system-ui,sans-serif;margin-top:10px;color:var(--mut)">Du: ${esc(r.given)}<br>Richtig: <span style="color:var(--tx);font-family:var(--serif);font-size:18px">${r.status === 'wrong' ? esc(r.target) : highlightDiff(r.given, r.target)}</span></div>` : '';
  return `<small style="color:${r.status === 'wrong' ? 'var(--bad)' : 'var(--sage)'}">${msg}</small>${detail}`;
}
function markStreak() {
  const t = today(), st = state.streak;
  if (st && st.last === t) return;
  const d = (x) => Math.round(new Date(x) / 86400000);
  state.streak = { last: t, count: st && d(t) - d(st.last) === 1 ? st.count + 1 : 1 };
}
function answer(g) {
  const c = session.queue.shift();
  if (session.practice) { // Übungsrunde: nur abfragen, nichts speichern
    if (g === 0) session.queue.push(c); else session.done++;
    session.revealed = false; session.result = null;
    render();
    return;
  }
  const wasNew = !c.seen;
  grade(c, g);
  markStreak();
  const day = (state.log[today()] = state.log[today()] || { r: 0, n: 0 });
  day.r++; if (wasNew) day.n++;
  if (wasNew) state.reviewed[today()] = (state.reviewed[today()] || 0) + 1;
  if (g === 0) session.queue.push(c); // in dieser Runde nochmal
  else session.done++;
  session.revealed = false; session.result = null;
  save();
  const unlocked = autoUnlock();
  if (unlocked) alert('🎉 Neues Wortpaket freigeschaltet: ' + unlocked.name);
  render();
}

// --- Rechtschreibprüfung (it.wiktionary.org) ---
// Ein Wort gilt als richtig, wenn es dort einen Eintrag gibt. Braucht Internet; offline wird nicht geprüft.
const API = 'https://it.wiktionary.org/w/api.php';
const ELISIONS = new Set(['l','un','dov','c','com','quest','quell','nell','dell','all','dall','sull','d','s','m','t','v','n','po','anch','cos','tutt','bell','buon','sant','nessun','null']);
const cache = {}; // Wort -> true/false
function tokenize(text) {
  return text.toLowerCase().replace(/[’`´]/g, "'").split(/[\s,.;:!?()\/"„“”\-]+/).filter((t) => t && !/^\d+$/.test(t));
}
// Formen, von denen mindestens eine existieren muss (l'acqua -> l'acqua oder acqua)
function forms(tok) {
  const f = [tok];
  const i = tok.indexOf("'");
  if (i > 0 && ELISIONS.has(tok.slice(0, i)) && tok.slice(i + 1)) f.push(tok.slice(i + 1));
  return f;
}
async function lookup(titles) {
  const todo = [...new Set(titles)].filter((t) => !(t in cache));
  for (let i = 0; i < todo.length; i += 40) {
    const batch = todo.slice(i, i + 40);
    const r = await fetch(`${API}?action=query&format=json&origin=*&titles=${encodeURIComponent(batch.join('|'))}`);
    const pages = (await r.json()).query.pages;
    const found = new Set(Object.values(pages).filter((p) => !('missing' in p) && !('invalid' in p)).map((p) => p.title));
    batch.forEach((t) => (cache[t] = found.has(t)));
  }
}
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[a.length][b.length];
}
async function suggest(word) {
  try {
    const r = await fetch(`${API}?action=query&list=search&format=json&origin=*&srnamespace=0&srlimit=15&srprop=&srsearch=${encodeURIComponent(word + '~2')}`);
    const hits = (await r.json()).query.search.map((h) => h.title);
    return hits.map((t) => [t, distance(word, t.toLowerCase())]).filter(([, d]) => d <= 2).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([t]) => t);
  } catch (e) { return []; }
}
// Ergebnis: {offline:true} oder {bad:[{word, suggestions}]}
async function spellcheck(text, withSuggestions = true) {
  const toks = tokenize(text);
  try {
    await lookup(toks.flatMap(forms));
    const bad = toks.filter((t) => !forms(t).some((f) => cache[f]));
    const out = [];
    for (const word of bad) out.push({ word, suggestions: withSuggestions ? await suggest(word) : [] });
    return { bad: out };
  } catch (e) { return { offline: true }; }
}
let checkTimer;
function liveCheck() {
  clearTimeout(checkTimer);
  const el = $('#nit'), st = $('#status');
  el.classList.remove('ok', 'bad'); st.innerHTML = '';
  if (!el.value.trim()) return;
  checkTimer = setTimeout(async () => {
    const text = el.value, res = await spellcheck(text);
    if (el.value !== text) return; // inzwischen weitergetippt
    if (res.offline) { st.innerHTML = '<span class="mut">Keine Verbindung – Schreibweise nicht geprüft.</span>'; return; }
    if (!res.bad.length) { el.classList.add('ok'); st.innerHTML = '✓ Schreibweise gefunden'; return; }
    el.classList.add('bad');
    st.innerHTML = res.bad.map((b) => `<div>„${esc(b.word)}" nicht gefunden.${b.suggestions.length ? ' Meintest du: ' +
      b.suggestions.map((s) => `<a href="#" onclick="fixWord('${esc(b.word)}','${esc(s)}');return false">${esc(s)}</a>`).join(', ') + '?' : ''}</div>`).join('');
  }, 500);
}
function fixWord(wrong, right) {
  const el = $('#nit');
  el.value = el.value.replace(new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), right);
  liveCheck();
}
// --- Doppelte erkennen, Teilen, Backup ---
const wordKey = (it) => noArticle(looseForm(it));
// Existiert das Wort schon? -> {card} (in deiner Liste) oder {pack, it, de} (in einem noch gesperrten Paket)
function findExisting(it) {
  const k = wordKey(it);
  const card = state.cards.find((c) => wordKey(c.it) === k);
  if (card) return { card };
  for (const p of PACKS) {
    if (state.unlocked.includes(p.id)) continue;
    const w = p.words.find(([i]) => wordKey(i) === k);
    if (w) return { pack: p, it: w[0], de: w[1] };
  }
  return null;
}
let pendingDup = null;
function showDuplicate(ex, de) {
  const el = $('#dup');
  const have = ex.card ? ex.card : { it: ex.it, de: ex.de };
  const diff = wordKey(have.de) !== wordKey(de) ? ` (bei dir: ${esc(have.de)})` : '';
  if (ex.card && ex.card.seen) {
    el.innerHTML = `<span class="mut">„${esc(have.it)}" = ${esc(have.de)} ist schon in deinem Übungswortschatz.${diff} Nichts geändert.</span>`;
    return;
  }
  pendingDup = ex;
  el.innerHTML = `<div class="mut">„${esc(have.it)}" = ${esc(have.de)} gibt es schon${ex.pack ? ' (' + esc(ex.pack.name) + ', noch gesperrt)' : ' (noch nicht gelernt)'}.
    In den aktuellen Übungswortschatz übernehmen?</div>
    <div class="row" style="margin-top:8px"><button class="pri" onclick="promoteDup()">Ja</button><button class="sec" onclick="pendingDup=null;$('#dup').innerHTML=''">Nein</button></div>`;
}
function promoteDup() {
  const ex = pendingDup; pendingDup = null;
  if (!ex) return;
  let c = ex.card;
  if (!c) { c = newCard(ex.it, ex.de, Date.now(), ex.pack.id); state.cards.push(c); }
  c.priority = true; session = null; save(); render();
  $('#dup').innerHTML = '<span class="mut">Übernommen – kommt als Nächstes dran.</span>';
}
async function addWord() {
  const it = $('#nit').value.trim(), de = $('#nde').value.trim();
  if (!it || !de) return;
  const ex = findExisting(it);
  if (ex) { showDuplicate(ex, de); return; }
  const res = await spellcheck(it, false);
  if (res.bad && res.bad.length &&
      !confirm(`Nicht gefunden: ${res.bad.map((b) => b.word).join(', ')}\nTrotzdem speichern?`)) return;
  state.cards.push(newCard(it, de, Date.now(), 'own')); session = null; save(); render();
}
async function importWords() {
  const rows = $('#imp').value.split('\n').map((l) => l.split(/;|\t|,/).map((x) => x.trim())).filter((p) => p.length >= 2 && p[0] && p[1]);
  if (!rows.length) return;
  const fresh = [], skipped = [], other = [];
  for (const [it, de] of rows) {
    const ex = findExisting(it) || (fresh.find((r) => wordKey(r[0]) === wordKey(it)) && { card: { it, de } });
    if (!ex) { fresh.push([it, de]); continue; }
    skipped.push(it);
    const have = ex.card || ex;
    if (wordKey(have.de) !== wordKey(de)) other.push(`${it}: bei dir „${have.de}", neu „${de}"`);
  }
  if (!fresh.length) { alert(`Nichts importiert: alle ${skipped.length} Wörter gibt es schon.` + (other.length ? '\n\nAndere Übersetzung:\n' + other.join('\n') : '')); return; }
  const res = await spellcheck(fresh.map((r) => r[0]).join(' '), false);
  if (res.bad && res.bad.length &&
      !confirm(`Nicht gefunden: ${res.bad.map((b) => b.word).join(', ')}\nTrotzdem importieren?`)) return;
  let t = Date.now();
  fresh.forEach(([it, de]) => state.cards.push(newCard(it, de, t++, 'own')));
  session = null; save(); render();
  alert(`${fresh.length} neu hinzugefügt, ${skipped.length} übersprungen (schon vorhanden).` +
    (other.length ? '\n\nAndere Übersetzung, nichts überschrieben:\n' + other.join('\n') : ''));
}
const ownWordsText = () => state.cards.filter((c) => c.pack === 'own').map((c) => `${c.it};${c.de}`).join('\n');
async function copyWords() {
  const text = ownWordsText();
  if (!text) { alert('Du hast noch keine eigenen Wörter.'); return; }
  try { await navigator.clipboard.writeText(text); alert('Kopiert. Füge die Liste im Importfeld ein.'); }
  catch (e) { prompt('Zum Kopieren markieren:', text); }
}
async function shareWords() {
  const text = ownWordsText();
  if (!text) { alert('Du hast noch keine eigenen Wörter.'); return; }
  if (navigator.share) { try { await navigator.share({ title: 'Italienisch-Wörter', text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copyWords();
}
async function exportBackup() {
  const file = new File([JSON.stringify(state)], `italiano-backup-${today()}.json`, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Italiano-Backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function restoreBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.cards) || !data.cards.every((c) => c && c.it && c.de)) throw new Error('format');
    if (!confirm(`Backup mit ${data.cards.length} Wörtern wiederherstellen? Dein aktueller Stand wird ersetzt.`)) return;
    state = data;
    if (!state.unlocked) state.unlocked = ['a1-basis'];
    if (!state.log) state.log = {};
    if (!state.since) state.since = today();
    if (!state.reviewed) state.reviewed = {};
    session = null; save(); render();
    alert('Backup wiederhergestellt.');
  } catch (e) { alert('Diese Datei ist kein gültiges Backup.'); }
}
function delWord(id) { state.cards = state.cards.filter((c) => c.id !== id); session = null; save(); render(); }
function resetAll() { if (confirm('Wirklich alle Fortschritte und eigenen Wörter löschen?')) { localStorage.removeItem(KEY); state = load(); session = null; render(); } }

document.querySelectorAll('#tabs button').forEach((b) => b.onclick = () => { view = b.dataset.view; if (view === 'home') session = null; render(); });
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
