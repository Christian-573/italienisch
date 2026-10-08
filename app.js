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
  for (const [it, de] of p.words) state.cards.push(newCard(it, de, t++, p.id));
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
  const isOwn = (c) => (c.pack === 'own' ? 0 : 1);
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
        <small>${session.result === true ? '✓ richtig' : session.result === false ? '✗ falsch' : ''}</small></div>${gradeButtons()}`;
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
      <input id="nde" placeholder="Deutsch">
      <button class="pri" onclick="addWord()">Prüfen &amp; hinzufügen</button></div>
    <div class="card"><b>Import</b><p class="mut">Eine Zeile pro Wort: <code>italienisch;deutsch</code> (oder Tab / Komma)</p>
      <textarea id="imp" rows="4" placeholder="il gatto;die Katze"></textarea>
      <button class="sec" onclick="importWords()">Importieren</button></div>
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
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9äöüß ]/g, '').replace(/\s+/g, ' ').trim();
function check() {
  const c = session.queue[0];
  const toIt = c.reps >= 2;
  const given = norm($('#ans').value);
  // mehrere Lösungen erlaubt ("hallo / tschüss", "(Bitte)")
  const options = (toIt ? c.it : c.de).split('/').map((s) => norm(s.replace(/\(.*?\)/g, '')));
  session.result = !!given && options.includes(given);
  session.revealed = true;
  render();
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
async function addWord() {
  const it = $('#nit').value.trim(), de = $('#nde').value.trim();
  if (!it || !de) return;
  const res = await spellcheck(it, false);
  if (res.bad && res.bad.length &&
      !confirm(`Nicht gefunden: ${res.bad.map((b) => b.word).join(', ')}\nTrotzdem speichern?`)) return;
  state.cards.push(newCard(it, de, Date.now(), 'own')); session = null; save(); render();
}
async function importWords() {
  const rows = $('#imp').value.split('\n').map((l) => l.split(/;|\t|,/).map((s) => s.trim())).filter((p) => p.length >= 2 && p[0] && p[1]);
  if (!rows.length) return;
  const res = await spellcheck(rows.map((r) => r[0]).join(' '), false);
  if (res.bad && res.bad.length &&
      !confirm(`Nicht gefunden: ${res.bad.map((b) => b.word).join(', ')}\nTrotzdem alle importieren?`)) return;
  let t = Date.now();
  rows.forEach((p) => state.cards.push(newCard(p[0], p[1], t++, 'own')));
  session = null; save(); render();
  alert(rows.length + ' Wörter importiert.');
}
function delWord(id) { state.cards = state.cards.filter((c) => c.id !== id); session = null; save(); render(); }
function resetAll() { if (confirm('Wirklich alle Fortschritte und eigenen Wörter löschen?')) { localStorage.removeItem(KEY); state = load(); session = null; render(); } }

document.querySelectorAll('#tabs button').forEach((b) => b.onclick = () => { view = b.dataset.view; if (view === 'home') session = null; render(); });
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
