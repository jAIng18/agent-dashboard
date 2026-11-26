'use strict';
/* Bảng điều khiển Agent — giao diện (không dùng thư viện ngoài)
   Hoạt động: mỗi vòng (một lần bạn giao việc) là một dòng thời gian gồm các bước ở mức agent / skill.
   Các thao tác nhỏ (đọc file, chạy lệnh…) được gộp lại, không hiện chi tiết. */

// ================================================================== helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const base = p => (p ? String(p).split('\n')[0].split('/').filter(Boolean).pop() : '');

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', 'x-agent-dashboard': 'ui' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra, hãy thử lại.');
  return data;
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3200);
}

function modal({ title, text = '', okText = 'Đồng ý', okClass = 'primary', cancelText = 'Huỷ', html = '' }) {
  return new Promise(resolve => {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-box" role="dialog">
      <h3>${esc(title)}</h3>
      ${text ? `<div class="muted">${esc(text)}</div>` : ''}
      ${html}
      <div style="height:16px"></div>
      <div class="modal-actions">
        ${cancelText ? `<button class="btn" data-a="cancel">${esc(cancelText)}</button>` : ''}
        <button class="btn ${okClass}" data-a="ok">${esc(okText)}</button>
      </div></div>`;
    m.hidden = false;
    const done = v => { m.hidden = true; m.innerHTML = ''; document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', onKey, true);
    m.onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'ok') done(true);
      else if (a === 'cancel' || e.target === m) done(null);
    };
  });
}

const pad = n => String(n).padStart(2, '0');
const fmtHM = ts => { if (!ts) return ''; const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtTime = ts => { if (!ts) return ''; const d = new Date(ts); return `${fmtHM(ts)}:${pad(d.getSeconds())}`; };
function fmtDur(ms) {
  if (!(ms >= 0)) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${Math.max(1, s)} giây`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút${s % 60 && m < 10 ? ` ${s % 60} giây` : ''}`;
  return `${Math.floor(m / 60)} giờ ${m % 60} phút`;
}
function timeAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 30) return 'vừa xong';
  if (s < 3600) return `${Math.round(s / 60) || 1} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

// ================================================================== icons
const ICONS = {
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1.5M15 13v1.5"/>',
  zap: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  list: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  ret: '<path d="M20 5v6a4 4 0 0 1-4 4H5"/><path d="M9 11l-4 4 4 4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.6 2.4 2.8-.6.6 2.8 2.4 1.6-1.2 2.6 1.2 2.6-2.4 1.6-.6 2.8-2.8-.6L12 21.2l-1.6-2.4-2.8.6-.6-2.8L4.6 15l1.2-2.6L4.6 9.8 7 8.2l.6-2.8 2.8.6z"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  minus: '<path d="M5 12h14"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.gear}</svg>`;

// ================================================================== constants
const MODELS = [
  { v: '', n: 'Mặc định', d: 'Để Claude Code tự chọn' },
  { v: 'inherit', n: 'Giống agent chính', d: 'Cùng model với cửa sổ chính', agentOnly: true },
  { v: 'opus', n: 'Opus', d: 'Thông minh nhất, chậm và tốn hơn' },
  { v: 'sonnet', n: 'Sonnet', d: 'Cân bằng tốc độ và chất lượng' },
  { v: 'haiku', n: 'Haiku', d: 'Nhanh nhất, tiết kiệm nhất' },
  { v: 'fable', n: 'Fable', d: 'Dòng model Fable của Anthropic' },
];
const modelName = v => (MODELS.find(m => m.v === (v || '')) || { n: v }).n;
// "claude-haiku-5-5" -> "Haiku 5.5"
function prettyModel(id) {
  if (!id) return '';
  const m = /(opus|sonnet|haiku|fable)[-_]?(\d+)?(?:[-_.](\d+))?/i.exec(id);
  if (!m) return MODELS.some(x => x.v === id) ? modelName(id) : id;
  const name = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  return m[2] ? `${name} ${m[2]}${m[3] && m[3].length < 3 ? '.' + m[3] : ''}` : name;
}
const STATUS = {
  working: ['accent', 'Đang chạy', true],
  waiting: ['warn', 'Đang chờ bạn', true],
  done: ['ok', 'Xong vòng'],
  ended: ['muted', 'Đã đóng'],
  idle: ['muted', 'Sẵn sàng'],
  stale: ['muted', 'Không hoạt động'],
  unknown: ['muted', 'Đã dừng ghi'],
};
const ACTIVE = new Set(['working', 'waiting']);
const effStatus = s => {
  const st = s.status === 'needs-permission' ? 'waiting' : s.status === 'approval' ? 'working' : s.status === 'stopped' ? 'done' : s.status;
  return st === 'working' && Date.now() - s.updatedAt > 20 * 60e3 ? 'stale' : st || 'idle';
};
function statusTag(st) {
  const [c, label, live] = STATUS[st] || STATUS.unknown;
  return `<span class="st ${c}"><span class="dot ${live ? 'blink' : ''}"></span>${esc(label)}</span>`;
}
const LANE_COLORS = ['#4f46e5', '#0891b2', '#db2777', '#ea580c', '#059669', '#7c3aed', '#ca8a04', '#0284c7'];
const laneColor = (s, key) => LANE_COLORS[Math.max(0, (s.agents || []).findIndex(a => a.key === key)) % LANE_COLORS.length];
const BUILTIN_AGENTS = ['general-purpose', 'Explore', 'Plan', 'statusline-setup', 'claude-code-guide', 'claude', 'fork', 'web-fetch', 'output-style-setup'];
const BUILTIN_DESC = {
  'general-purpose': 'Agent đa năng có sẵn, làm được hầu hết mọi việc',
  Explore: 'Agent có sẵn chuyên tìm và đọc thông tin, không sửa gì',
  Plan: 'Agent có sẵn chuyên lập kế hoạch',
  fork: 'Bản sao của agent chính, làm một phần việc',
};
const AGENT_LIVE = new Set(['working', 'starting']);
const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const fullPath = st => String(st.detail || '').split('\n')[0].trim();
const filesOf = steps => [...new Set(steps.filter(x => EDIT_TOOLS.has(x.tool) && x.status !== 'failed').map(fullPath).filter(Boolean))];
const READABLE = /\.(md|markdown|txt|csv|json|html?)$/i;
const fileLinks = files => files.map(f => READABLE.test(f)
  ? `<a href="#" class="flink" data-open-file="${esc(f)}" title="${esc(f)}">${icon('file', 'sm')}${esc(base(f))}</a>`
  : `<span class="flink off" title="${esc(f)}">${icon('file', 'sm')}${esc(base(f))}</span>`).join('');
const PLAN_TOOLS = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet']);

// ================================================================== state
const S = {
  tab: location.hash.slice(1) || 'live',
  sessions: new Map(),
  config: {}, hooks: {}, mainModel: '', autostart: { supported: false }, projects: [],
  items: null,
  selected: null, // session id
  sel: null, // selected step in the timeline, e.g. "agent:<key>"
  loopOpen: {},
  live: false,
  lastRendered: { session: null, size: 0 },
  team: { q: '', kind: 'all', groups: JSON.parse(localStorage.getItem('groups') || '{}') },
};
if (!['live', 'team', 'settings'].includes(S.tab)) S.tab = 'live';
S.selected = new URLSearchParams(location.search).get('s') || null; // link straight to one session: /?s=<id>

// ================================================================== realtime
async function loadState() {
  try {
    const st = await api('/api/state');
    S.sessions = new Map(st.sessions.map(s => [s.id, s]));
    S.config = st.config; S.hooks = st.hooks; S.mainModel = st.mainModel;
    S.autostart = st.autostart || { supported: false }; S.projects = st.projects || [];
    renderAll();
    updateTitle();
    loadItems().then(() => scheduleLive()).catch(() => {});
  } catch (e) { toast('Không tải được dữ liệu: ' + e.message, 'error'); }
}

function connect() {
  const es = new EventSource('/api/stream');
  es.onopen = () => { S.live = true; loadState(); };
  es.onerror = () => { S.live = false; renderConn(); };
  es.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type === 'session') {
      const old = S.sessions.get(m.session.id);
      const s = { ...m.session, steps: old?.steps || [] };
      S.sessions.set(m.session.id, s);
      if (old) alertOnChange(s, effStatus(old), effStatus(s));
      updateTitle();
      scheduleLive();
    } else if (m.type === 'step') {
      let s = S.sessions.get(m.sessionId);
      if (!s) { s = { id: m.sessionId, steps: [], agents: [], todos: [], tasks: {}, updatedAt: Date.now(), status: 'working', project: '' }; S.sessions.set(s.id, s); }
      const i = s.steps.findIndex(x => x.id === m.step.id);
      if (i >= 0) s.steps[i] = m.step; else s.steps.push(m.step);
      scheduleLive();
    } else if (m.type === 'config') { S.config = m.config; if (S.tab === 'settings') renderSettings(); }
    else if (m.type === 'hooks') { S.hooks = m.hooks; renderConn(); if (S.tab === 'settings') renderSettings(); scheduleLive(); }
    else if (m.type === 'autostart') { S.autostart = m.autostart; if (S.tab === 'settings') renderSettings(); }
    else if (m.type === 'hidden') { S.sessions.delete(m.sessionId); scheduleLive(); }
  };
}

let liveRaf = null;
function scheduleLive() {
  if (liveRaf) return;
  liveRaf = requestAnimationFrame(() => {
    liveRaf = null;
    if (S.tab !== 'live') return;
    // Don't redraw under the person's hands: an open model list or a text selection would be lost.
    const ae = document.activeElement;
    const sel = window.getSelection();
    if ((ae && ae.tagName === 'SELECT' && $('#view-live').contains(ae)) || (sel && sel.toString() && $('#view-live').contains(sel.anchorNode))) {
      setTimeout(scheduleLive, 800); return;
    }
    renderLive();
  });
}

// ================================================================== shell
function setTab(t) { S.tab = t; history.replaceState(null, '', '#' + t); renderAll(); }
function renderAll() {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === S.tab));
  $('#view-live').hidden = S.tab !== 'live';
  $('#view-team').hidden = S.tab !== 'team';
  $('#view-settings').hidden = S.tab !== 'settings';
  renderConn();
  if (S.tab === 'live') renderLive();
  if (S.tab === 'team') renderTeam();
  if (S.tab === 'settings') renderSettings();
}
function renderConn() {
  const b = $('#conn');
  if (!S.live) { b.className = 'conn warn'; b.innerHTML = '<span class="dot"></span>Mất kết nối với bảng điều khiển'; return; }
  if (S.hooks.connected) { b.className = 'conn ok'; b.innerHTML = '<span class="dot"></span>Đã kết nối Claude Code'; }
  else { b.className = 'conn warn'; b.innerHTML = '<span class="dot"></span>Chưa kết nối Claude Code'; }
  const ask = $('#notif-ask');
  if (ask) ask.hidden = !('Notification' in window) || Notification.permission !== 'default' || !!localStorage.getItem('notifAskDismissed');
}

// ================================================================== alerts: tell you when Claude needs you or is done
// You are usually in the Claude Code window, not here, so a browser notification (and a short chime) does the telling.
const BASE_TITLE = document.title;
const PREFS_DEFAULT = { wait: true, done: true, sound: true };
const prefs = () => ({ ...PREFS_DEFAULT, ...JSON.parse(localStorage.getItem('alertPrefs') || '{}') });
const setPref = (k, v) => localStorage.setItem('alertPrefs', JSON.stringify({ ...prefs(), [k]: v }));

function updateTitle() {
  const list = [...S.sessions.values()].map(effStatus);
  const waiting = list.filter(st => st === 'waiting').length;
  document.title = waiting ? `🔔 Đang chờ bạn${waiting > 1 ? ` (${waiting})` : ''} · ${BASE_TITLE}`
    : list.includes('working') ? `⏳ Đang làm · ${BASE_TITLE}` : BASE_TITLE;
}

let audio = null;
const wakeAudio = () => { try { audio = audio || new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch {} };
document.addEventListener('pointerdown', wakeAudio, { once: true });
document.addEventListener('keydown', wakeAudio, { once: true });
function chime(kind) {
  if (!audio || audio.state !== 'running') return;
  const notes = kind === 'wait' ? [880, 660, 880] : [660, 880];
  notes.forEach((f, i) => {
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.16;
    o.frequency.value = f; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.32);
  });
}

async function askNotifyPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

const lastAlert = new Map();
function showAlert(kind, s, title, body) {
  const p = prefs();
  const key = `${s.id}|${kind}`;
  if (Date.now() - (lastAlert.get(key) || 0) < 5000) return;
  lastAlert.set(key, Date.now());
  if (document.hasFocus()) { if (kind === 'wait') toast(`${title}: ${body}`); return; } // you're already looking at the page
  if (p.sound) chime(kind);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, tag: key, requireInteraction: kind === 'wait' });
  n.onclick = () => { window.focus(); S.selected = s.id; setTab('live'); n.close(); };
}

function alertOnChange(s, before, after) {
  if (before === after) return;
  const p = prefs();
  const what = [s.project, s.title].filter(Boolean).join(' · ') || 'Phiên Claude Code';
  if (after === 'waiting' && p.wait) {
    const ask = [...(s.steps || [])].reverse().find(x => x.mark === 'waiting' || (x.tool && ['AskUserQuestion', 'ExitPlanMode'].includes(x.tool) && x.status === 'running'));
    showAlert('wait', s, '🔔 Claude đang chờ bạn', `${ask && ask.text ? ask.text + ' · ' : ''}${what}`);
  } else if (after === 'done' && ACTIVE.has(before) && p.done) {
    showAlert('done', s, '✅ Claude đã làm xong', what);
  }
}

// ================================================================== agents & skills on disk
async function loadItems(force) {
  if (S.items && !force) return S.items;
  S.items = (await api('/api/items')).items;
  return S.items;
}
function findItem(kind, name) {
  if (!S.items || !name) return null;
  const [plug, short] = name.includes(':') ? name.split(':') : [null, name];
  const matches = S.items.filter(i => i.kind === kind && (i.invokeName === name || (i.name === short && (!plug || i.plugin === plug))));
  return matches.find(i => i.editable) || matches[0] || null;
}

// A model picker that saves on change. Read-only items get a plain label instead.
function modelPicker(it, cls = '') {
  if (!it) return '';
  if (!it.editable) return `<span class="chip" title="Mục chỉ xem: tạo bản sao để đổi model">${icon('lock', 'sm')}${esc(modelName(it.model))}</span>`;
  const opts = MODELS.filter(m => !m.agentOnly || it.kind === 'agent');
  if (it.model && !opts.some(o => o.v === it.model)) opts.push({ v: it.model, n: it.model });
  return `<select class="msel ${cls}" data-setmodel="${esc(it.id)}" title="Đổi model (lưu ngay)">${opts.map(o =>
    `<option value="${esc(o.v)}" ${o.v === (it.model || '') ? 'selected' : ''}>${esc(o.n)}</option>`).join('')}</select>`;
}

async function setItemModel(id, model, el) {
  const it = S.items?.find(i => i.id === id);
  try {
    if (el) el.disabled = true;
    const out = await api(`/api/items/${id}/model`, { model });
    if (it) it.model = out.item.model;
    toast(`Đã đổi model của “${it ? it.name : 'mục này'}” thành ${modelName(model)}. Áp dụng từ lần chạy tiếp theo.`);
  } catch (err) { toast(err.message, 'error'); }
  if (el) { el.disabled = false; el.blur(); }
  if (S.tab === 'team') renderTeam(); else scheduleLive();
}
document.addEventListener('change', e => {
  const sel = e.target.closest?.('[data-setmodel]');
  if (sel) setItemModel(sel.dataset.setmodel, sel.value, sel);
});

// ================================================================== loops
// Turns a session's raw steps into loops (one per request you send). Each loop is a list of readable steps:
//   prompt · work (the main agent working on its own, small actions grouped) · plan (a job started / finished)
//   agents (one or more agents handed a job, side by side when they run in parallel) · skill · report · waiting
function buildLoops(s) {
  const agents = s.agents || [];
  const byTool = new Map(agents.filter(a => a.toolUseId).map(a => [a.toolUseId, a]));
  const byKey = new Map(agents.map(a => [a.key, a]));
  const lanes = new Map(); // agent key -> what happened inside that agent
  const laneInfo = k => { if (!lanes.has(k)) lanes.set(k, { ops: 0, skills: [], files: [], agents: [] }); return lanes.get(k); };
  const index = new Map();
  const loops = [];
  let L = null;
  const open = p => { L = { key: p ? p.id : `pre-${loops.length}`, prompt: p, items: [], start: p ? p.ts : null, end: null, last: p ? p.ts : null, done: false, agentKeys: new Set(), skills: new Set(), files: [] }; loops.push(L); };
  const tail = () => L.items[L.items.length - 1];
  const push = it => { const t = tail(); if (t && t.type === 'agents') t.closed = true; L.items.push(it); index.set(it.id, it); return it; };
  const addAgent = (ag, step) => {
    const t = tail();
    if (t && t.type === 'agents' && !t.closed) t.list.push({ ag, step });
    else { const it = { type: 'agents', id: `ag-${step ? step.id : ag.key}`, list: [{ ag, step }], ts: step ? step.ts : ag.startedAt }; L.items.push(it); index.set(it.id, it); }
    if (ag) L.agentKeys.add(ag.key);
  };

  for (const st of s.steps || []) {
    if (st.kind === 'prompt') {
      open(st);
      if (st.command && findItem('skill', st.command)) { push({ type: 'skill', id: `sk-${st.id}`, name: st.command, step: st, ts: st.ts, fromPrompt: true }); L.skills.add(st.command); }
      continue;
    }
    if (st.mark === 'session-start' || st.mark === 'session-end') continue;
    if (!L) open(null);
    if (!L.start) L.start = st.ts;
    L.last = Math.max(L.last || 0, st.endedAt || st.ts);

    if (st.kind === 'tool' && EDIT_TOOLS.has(st.tool) && st.status !== 'failed' && fullPath(st) && !L.files.includes(fullPath(st))) L.files.push(fullPath(st));
    if (st.lane) { // inside a sub-agent: only remember a summary for its card
      const info = laneInfo(st.lane);
      if (st.kind === 'tool') {
        info.ops++;
        if (st.tool === 'Skill' && st.link && !info.skills.includes(st.link.name)) { info.skills.push(st.link.name); L.skills.add(st.link.name); }
        if (EDIT_TOOLS.has(st.tool) && st.status !== 'failed' && fullPath(st) && !info.files.includes(fullPath(st))) info.files.push(fullPath(st));
        if ((st.tool === 'Agent' || st.tool === 'Task') && byTool.get(st.toolUseId)) info.agents.push(byTool.get(st.toolUseId));
      }
      if (st.mark === 'subagent-start') {
        const ag = byKey.get(st.lane);
        if (ag && !ag.toolUseId && ag.type && ag.type !== 'agent') addAgent(ag, st); // started by a workflow, not by an Agent step
      }
      continue;
    }

    if (st.kind === 'tool') {
      if (st.tool === 'Agent' || st.tool === 'Task') { addAgent(byTool.get(st.toolUseId) || null, st); continue; }
      if (st.tool === 'Skill') { push({ type: 'skill', id: `sk-${st.id}`, name: st.link?.name || '', step: st, ts: st.ts }); L.skills.add(st.link?.name); continue; }
      if (st.plan && st.plan.length) {
        st.plan.forEach((c, i) => {
          const t = tail();
          // Jobs added one by one (TaskCreate) read as a single "made a plan of N jobs" step.
          if (c.kind === 'add' && t && t.type === 'plan' && t.change.kind === 'plan') { t.change.items.push(c.content); return; }
          push({ type: 'plan', id: `pl-${st.id}-${i}`, change: c.kind === 'add' ? { kind: 'plan', items: [c.content] } : c, ts: st.ts });
        });
        continue;
      }
      if (PLAN_TOOLS.has(st.tool)) continue; // plan bookkeeping that changed nothing visible
      const t = tail();
      if (t && t.type === 'work') { t.steps.push(st); continue; }
      push({ type: 'work', id: `wk-${st.id}`, steps: [st], ts: st.ts });
      continue;
    }
    if (st.mark === 'turn-end') { L.done = true; L.end = st.ts; const t = tail(); if (t && t.type === 'agents') t.closed = true; continue; }
    if (st.mark === 'agent-report' && byKey.get(st.agentKey)?.background) { push({ type: 'report', id: `rp-${st.id}`, ag: byKey.get(st.agentKey), ts: st.ts }); continue; }
    if (st.mark === 'waiting') { push({ type: 'waiting', id: `wt-${st.id}`, text: st.text, ts: st.ts }); continue; }
  }
  return { loops, lanes, index };
}

const agentModel = ag => {
  if (!ag) return '';
  if (ag.resolvedModel) return prettyModel(ag.resolvedModel);
  if (ag.model) return prettyModel(ag.model);
  const it = findItem('agent', ag.type);
  return it && it.model ? modelName(it.model) : '';
};
const agentDur = ag => (ag && ag.startedAt ? fmtDur((ag.endedAt || (AGENT_LIVE.has(ag.status) ? Date.now() : ag.startedAt)) - ag.startedAt) : '');
const agentTask = (ag, step) => (ag && ag.description) || (step && (/”:\s*(.*)$/.exec(step.text || '') || [])[1]) || '';
const agentType = (ag, step) => (ag && ag.type) || step?.link?.name || 'agent';

function statusMark(status) {
  if (status === 'working' || status === 'starting' || status === 'running') return '<span class="spinner" title="Đang làm"></span>';
  if (status === 'done') return `<span class="ok-i" title="Xong">${icon('check', 'sm')}</span>`;
  if (status === 'failed') return `<span class="bad-i" title="Bị lỗi">${icon('x', 'sm')}</span>`;
  return '';
}
const workStatus = w => (w.steps.some(x => x.status === 'running') ? 'running' : w.steps.some(x => x.status === 'failed') && w.steps.every(x => x.status !== 'done') ? 'failed' : 'done');

// ================================================================== live view: a flow canvas, like n8n
// Each loop (one request you send) is drawn left to right as connected steps. Agents handed work at the same
// time sit in the same column, one under the other. Click a step to see what went in, what came out, and to
// change its settings (model, "when to use", instructions).
const NODE_W = 248, NODE_H = 72, GAP_X = 76, GAP_Y = 24, TOP_PAD = 26;
S.loopSel = {}; // session id -> loop key the person picked (none = follow the latest loop)
S.view = {}; // "session|loop" -> { x, y, k, user } pan / zoom of that canvas
S.flow = null; // what the canvas shows right now
S.openNode = null;

function sortedSessions() {
  return [...S.sessions.values()].sort((a, b) => {
    const aa = ACTIVE.has(effStatus(a)) ? 1 : 0, bb = ACTIVE.has(effStatus(b)) ? 1 : 0;
    return bb - aa || b.updatedAt - a.updatedAt;
  });
}

function onboardingHTML() {
  return `<div class="page"><div class="card empty" style="max-width:620px;margin:40px auto">
    <div class="ico">${icon('plug', 'lg')}</div>
    <div class="title">Kết nối bảng điều khiển với Claude Code</div>
    <div style="max-width:480px;margin:0 auto 18px">Bấm một lần. Sau đó mỗi lần bạn giao việc cho Claude Code, các bước AI đang làm và các agent được gọi sẽ hiện ở đây.</div>
    <button class="btn primary lg" data-global="install">${icon('plug', 'sm')}Kết nối ngay</button>
    <div class="small faint" style="margin-top:14px">Bảng điều khiển chỉ xem, không can thiệp vào Claude Code. Có thể ngắt kết nối trong tab Cài đặt.</div>
  </div></div>`;
}

function loopState(s, L, idx, total) {
  if (L.done) return 'done';
  if (idx === total - 1 && ACTIVE.has(effStatus(s))) return effStatus(s) === 'waiting' ? 'waiting' : 'running';
  return 'cut';
}

// ---------------------------------------------------------------- loop -> nodes
function agentNode(s, ag, step, model) {
  const key = ag ? ag.key : `step-${step.id}`;
  const info = (ag && model.lanes.get(ag.key)) || { ops: 0, skills: [], files: [], agents: [] };
  const status = ag ? ag.status : step?.status === 'running' ? 'working' : step?.status;
  const extra = [info.skills.length ? `${info.skills.length} skill` : '', info.agents.length ? `${info.agents.length} agent con` : ''].filter(Boolean).join(', ');
  return {
    id: `agent:${key}`, kind: 'agent', icon: 'bot', color: ag ? laneColor(s, ag.key) : 'var(--c-agent)', editable: true,
    title: agentType(ag, step), sub: agentTask(ag, step) || 'Agent',
    meta: [agentModel(ag), agentDur(ag), ag && ag.background ? 'chạy nền' : '', extra].filter(Boolean).join(' · '),
    status: status === 'starting' ? 'working' : status, data: { ag, step, info },
  };
}

function flowOf(s, L, idx, total, model) {
  const state = loopState(s, L, idx, total);
  const stages = [];
  const add = (...nodes) => { stages.push(nodes); return nodes[0]; };
  const p = L.prompt;
  add({
    id: `prompt:${L.key}`, kind: 'trigger', icon: p && p.command ? 'zap' : 'user', color: 'var(--ink)',
    title: p ? (p.command ? 'Bạn chạy lệnh' : 'Bạn yêu cầu') : 'Phiên đã chạy sẵn',
    sub: p ? (p.promptText || p.text) : 'Các bước trước khi bảng điều khiển bắt đầu ghi', meta: p ? fmtHM(p.ts) : '',
  });
  for (const it of L.items) {
    // Small actions and plan updates by the main agent are folded into one "Agent chính tự xử lý" step.
    if (it.type === 'work' || (it.type === 'plan' && it.change.kind !== 'plan')) {
      const tail = stages[stages.length - 1];
      let w = tail.length === 1 && tail[0].kind === 'work' ? tail[0] : null;
      if (!w) w = add({ id: `work:${it.id}`, kind: 'work', icon: 'cog', color: '#64748b', editable: true, data: { steps: [], progress: [] } });
      if (it.type === 'work') w.data.steps.push(...it.steps); else w.data.progress.push(it.change);
      continue;
    }
    if (it.type === 'plan') {
      add({ id: `plan:${it.id}`, kind: 'plan', icon: 'list', color: '#52525b', title: `Lập kế hoạch ${it.change.items.length} việc`, sub: it.change.items[0] || '', meta: fmtHM(it.ts), data: { it } });
      continue;
    }
    if (it.type === 'agents') { add(...it.list.map(x => agentNode(s, x.ag, x.step, model))); continue; }
    if (it.type === 'skill') {
      const sk = findItem('skill', it.name);
      add({
        id: `skill:${it.id}`, kind: 'skill', icon: 'zap', color: 'var(--c-skill)', editable: true, title: it.name || 'Skill',
        sub: (sk && sk.description) || 'Skill', meta: [sk && sk.model ? modelName(sk.model) : '', it.fromPrompt ? 'bạn gọi bằng lệnh' : fmtHM(it.ts)].filter(Boolean).join(' · '),
        status: it.step && it.step.status === 'running' ? 'running' : '', data: { it },
      });
      continue;
    }
    if (it.type === 'report') {
      add({ id: `report:${it.id}`, kind: 'report', icon: 'ret', color: laneColor(s, it.ag.key), title: `${it.ag.type} gửi kết quả`, sub: it.ag.description || 'Agent chạy nền đã xong', meta: fmtHM(it.ts), data: { ag: it.ag } });
      continue;
    }
    if (it.type === 'waiting') add({ id: `wait:${it.id}`, kind: 'waiting', icon: 'bell', color: 'var(--warn)', title: 'Chờ bạn', sub: it.text, meta: fmtHM(it.ts) });
  }
  for (const st of stages) for (const n of st) {
    if (n.kind !== 'work') continue;
    const { steps, progress } = n.data;
    const files = filesOf(steps);
    n.title = 'Agent chính tự xử lý';
    n.sub = steps.length ? `${steps.length} thao tác${files.length ? ` · tạo/sửa ${files.length} file` : ''}` : 'Cập nhật kế hoạch';
    n.meta = [progress.length ? `${progress.length} cập nhật kế hoạch` : '', steps.length ? fmtHM(steps[0].ts) : ''].filter(Boolean).join(' · ');
    n.status = steps.length && workStatus({ steps }) === 'running' ? 'running' : '';
  }
  const endTs = L.end || (state === 'running' || state === 'waiting' ? Date.now() : L.last);
  const dur = L.start && endTs ? fmtDur(endTs - L.start) : '';
  const END = {
    done: ['flag', 'Xong vòng này', dur ? `Mất ${dur}` : ''],
    running: ['', 'Đang làm tiếp…', dur ? `Đã chạy ${dur}` : ''],
    waiting: ['bell', 'Đang chờ bạn', 'Trả lời trong cửa sổ Claude Code'],
    cut: ['pause', 'Dừng giữa chừng', 'Bị ngắt, hoặc bảng điều khiển đã tắt'],
  }[state];
  add({
    id: `end:${L.key}`, kind: 'end', icon: END[0], color: state === 'done' ? 'var(--ok)' : state === 'waiting' ? 'var(--warn)' : 'var(--faint)',
    title: END[1], sub: L.files.length ? `${L.files.length} file kết quả · bấm để xem` : END[2], meta: L.files.length ? END[2] : '',
    status: state === 'running' ? 'running' : '', ghost: state === 'running', data: { state, dur },
  });
  return stages;
}

// Stages go left to right and wrap onto a new row when the canvas is too narrow, so text stays readable.
const ROW_GAP = 70, READ_K = 0.85;
function perRowFor(width) {
  return Math.max(3, Math.floor((width / READ_K - 2 * 48 + GAP_X) / (NODE_W + GAP_X)));
}
function layoutFlow(stages, perRow) {
  const nodes = [], edges = [], labels = [];
  const rows = [];
  for (let i = 0; i < stages.length; i += perRow) rows.push(stages.slice(i, i + perRow));
  let top = TOP_PAD;
  rows.forEach(row => {
    const half = Math.max(...row.map(st => st.length * (NODE_H + GAP_Y) - GAP_Y)) / 2;
    const mid = top + half;
    row.forEach((st, i) => {
      const x = i * (NODE_W + GAP_X);
      st.forEach((n, j) => { n.x = x; n.y = mid - NODE_H / 2 + (j - (st.length - 1) / 2) * (NODE_H + GAP_Y); n.rowBottom = mid + half; nodes.push(n); });
      if (st.length > 1) labels.push({ x, y: st[0].y, text: `${st.length} agent làm song song` });
    });
    top = mid + half + ROW_GAP + (row.length && rows.length > 1 ? 10 : 0);
  });
  stages.forEach((st, i) => { if (i) for (const a of stages[i - 1]) for (const b of st) edges.push({ a, b, wrap: i % perRow === 0 }); });
  const w = Math.min(stages.length, perRow) * (NODE_W + GAP_X) - GAP_X;
  return { nodes, edges, labels, w, h: Math.max(...nodes.map(n => n.y)) + NODE_H + 8 };
}

function nodeHTML(n) {
  return `<div class="fnode k-${n.kind}${n.status ? ' st-' + esc(n.status) : ''}${n.ghost ? ' ghost' : ''}${S.openNode === n.id ? ' sel' : ''}" data-node="${esc(n.id)}"
    style="left:${n.x}px;top:${n.y}px;width:${NODE_W}px;height:${NODE_H}px;--c:${n.color || 'var(--muted)'}" title="${esc([n.title, n.sub].filter(Boolean).join('\n'))}">
    ${n.kind !== 'trigger' ? '<span class="hdl in"></span>' : ''}${n.kind !== 'end' ? '<span class="hdl out"></span>' : ''}
    <div class="fn-ic">${n.icon ? icon(n.icon) : '<span class="spinner"></span>'}</div>
    <div class="fn-tx"><div class="fn-t">${esc(n.title)}</div>${n.sub ? `<div class="fn-s">${esc(n.sub)}</div>` : ''}${n.meta ? `<div class="fn-m">${esc(n.meta)}</div>` : ''}</div>
    ${n.icon || n.status !== 'running' ? `<div class="fn-st">${statusMark(n.status)}</div>` : ''}
    ${n.editable ? `<span class="fn-edit">${icon('edit', 'sm')}Sửa</span>` : ''}
  </div>`;
}

function edgeHTML({ a, b, wrap }) {
  const x1 = a.x + NODE_W + 5, y1 = a.y + NODE_H / 2, x2 = b.x - 7, y2 = b.y + NODE_H / 2;
  const live = b.status === 'running' || b.status === 'working';
  let d;
  if (wrap) { // end of a row -> start of the next row: out to the right, down, back left, into the node
    const r = 14, ox = x1 + 22, ix = x2 - 22, by = a.rowBottom + ROW_GAP / 2;
    d = `M${x1},${y1} H${ox - r} Q${ox},${y1} ${ox},${y1 + r} V${by - r} Q${ox},${by} ${ox - r},${by} H${ix + r} Q${ix},${by} ${ix},${by + r} V${y2 - r} Q${ix},${y2} ${ix + r},${y2} H${x2}`;
  } else {
    const c = Math.max(28, (x2 - x1) / 2);
    d = `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`;
  }
  return `<path class="edge${live ? ' live' : ''}" d="${d}" marker-end="url(#arrow)"/>`;
}

// ---------------------------------------------------------------- pan / zoom
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Fits the width (rows wrap, so that is enough); a tall flow starts at the top, or at the bottom while it runs.
function fitView(lay, followEnd) {
  const flow = $('#flow');
  const vw = flow.clientWidth, vh = flow.clientHeight, pad = 48;
  const k = clamp(Math.min((vw - pad * 2) / lay.w, Math.max(READ_K, (vh - pad * 2) / lay.h)), 0.6, 1);
  const x = Math.max(pad, (vw - lay.w * k) / 2);
  const y = lay.h * k <= vh - pad * 2 ? (vh - lay.h * k) / 2 : followEnd ? vh - pad - lay.h * k : pad / 2;
  return { x, y, k, user: false };
}
const curView = () => (S.flow ? S.view[S.flow.key] : null);
function applyView() {
  const v = curView();
  const flow = $('#flow'), world = $('#world');
  if (!v || !flow || !world) return;
  world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.k})`;
  flow.style.backgroundSize = `${22 * v.k}px ${22 * v.k}px`;
  flow.style.backgroundPosition = `${v.x}px ${v.y}px`;
  const z = $('#zoomv');
  if (z) z.textContent = `${Math.round(v.k * 100)}%`;
}
function zoomAt(v, px, py, f) {
  const k = clamp(v.k * f, 0.3, 1.8);
  v.x = px - (px - v.x) * (k / v.k);
  v.y = py - (py - v.y) * (k / v.k);
  v.k = k; v.user = true;
}
function bindFlow() {
  const flow = $('#flow');
  let drag = null;
  flow.addEventListener('pointerdown', e => {
    const v = curView();
    if (e.button !== 0 || !v || e.target.closest('.flow-ctl')) return;
    drag = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false };
  });
  flow.addEventListener('pointermove', e => {
    const v = curView();
    if (!drag || !v) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) { drag.moved = true; flow.setPointerCapture(e.pointerId); flow.classList.add('panning'); }
    v.x = drag.vx + dx; v.y = drag.vy + dy; v.user = true;
    applyView();
  });
  const end = () => { if (drag && drag.moved) S.panEndAt = Date.now(); drag = null; flow.classList.remove('panning'); };
  flow.addEventListener('pointerup', end);
  flow.addEventListener('pointercancel', end);
  flow.addEventListener('wheel', e => {
    const v = curView();
    if (!v) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const r = flow.getBoundingClientRect(); zoomAt(v, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01)); }
    else { v.x -= e.shiftKey ? e.deltaY : e.deltaX; v.y -= e.shiftKey ? 0 : e.deltaY; v.user = true; }
    applyView();
  }, { passive: false });
  window.addEventListener('resize', () => { if (S.tab === 'live' && S.flow) scheduleLive(); });
}

// ---------------------------------------------------------------- render
function renderLive() {
  const root = $('#view-live');
  const list = sortedSessions();
  if (!S.hooks.connected && !list.length) { root.innerHTML = onboardingHTML(); delete root.dataset.ready; return; }
  if (!root.dataset.ready) {
    root.innerHTML = `<div class="live">
      <aside class="pane pane-left" id="sess"></aside>
      <section class="pane-center">
        <div id="banner"></div><div id="shead" class="shead"></div><div id="nowbar"></div><div id="loopbar" class="loopbar"></div>
        <div class="flow" id="flow">
          <div class="flow-world" id="world"></div>
          <div class="flow-empty" id="flow-empty" hidden></div>
          <div class="flow-ctl">
            <button data-zoom="fit" title="Vừa khung">${icon('expand', 'sm')}</button>
            <button data-zoom="out" title="Thu nhỏ">${icon('minus', 'sm')}</button>
            <span id="zoomv">100%</span>
            <button data-zoom="in" title="Phóng to">${icon('plus', 'sm')}</button>
          </div>
          <div class="flow-hint">Kéo để di chuyển · Ctrl + cuộn để phóng to · Bấm vào một bước để xem và sửa</div>
        </div>
      </section></div>`;
    root.dataset.ready = '1';
    bindFlow();
  }
  if (!S.selected || !S.sessions.has(S.selected)) S.selected = list[0]?.id || null;

  $('#banner').innerHTML = S.hooks.connected ? '' : `<div class="callout warn" style="border-radius:0">${icon('alert', 'sm')}<div style="flex:1">Chưa kết nối với Claude Code nên sẽ không thấy bước mới.</div><button class="btn sm primary" data-global="install">Kết nối ngay</button></div>`;

  $('#sess').innerHTML = `<div class="pane-title"><span class="label">Phiên làm việc</span><span class="small faint">${list.length}</span></div>` +
    (list.map(s => `<div class="session ${s.id === S.selected ? 'active' : ''}" data-session="${esc(s.id)}">
      <div class="top">${statusTag(effStatus(s))}<span class="spacer"></span><span>${timeAgo(s.updatedAt)}</span></div>
      <div class="title">${esc(s.title || 'Phiên mới')}</div>
      <div class="foot">${esc(s.project || '')}${(s.agents || []).filter(a => a.type && a.type !== 'agent').length ? ` · ${s.agents.filter(a => a.type && a.type !== 'agent').length} lần gọi agent` : ''}</div>
    </div>`).join('') || `<div class="empty small">Chưa có phiên nào.<br>Mở Claude Code và giao việc.</div>`);

  const s = S.sessions.get(S.selected);
  const empty = $('#flow-empty');
  const showEmpty = html => { S.flow = null; $('#world').innerHTML = ''; empty.hidden = false; empty.innerHTML = html; $('#loopbar').hidden = true; };
  if (!s) {
    $('#shead').hidden = true; $('#nowbar').hidden = true;
    return showEmpty(`<div class="empty"><div class="ico">${icon('play', 'lg')}</div><div class="title">Chưa có phiên nào</div><div>Mở Claude Code và giao việc, các bước sẽ hiện ở đây ngay.</div></div>`);
  }
  const model = buildLoops(s);
  const { loops } = model;
  $('#shead').hidden = false;
  renderSessionHead(s, model);
  if (!loops.length) return showEmpty(`<div class="empty"><div class="title">Phiên này chưa có bước nào</div></div>`);
  empty.hidden = true;

  let li = loops.findIndex(L => L.key === S.loopSel[s.id]);
  if (li < 0) li = loops.length - 1;
  const L = loops[li];
  renderLoopbar(s, loops, li);
  const lay = layoutFlow(flowOf(s, L, li, loops.length, model), perRowFor($('#flow').clientWidth));
  const state = loopState(s, L, li, loops.length);
  S.flow = { key: `${s.id}|${L.key}`, sessionId: s.id, loopKey: L.key, L, lay, model, follow: state === 'running' || state === 'waiting' };
  $('#world').innerHTML = `<svg class="edges" width="${lay.w}" height="${lay.h}" viewBox="0 0 ${lay.w} ${lay.h}">
      <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" class="arrowhead"/></marker></defs>
      ${lay.edges.map(edgeHTML).join('')}</svg>
    ${lay.labels.map(l => `<div class="fgroup" style="left:${l.x}px;top:${l.y - 22}px;width:${NODE_W}px">${icon('bot', 'sm')}${esc(l.text)}</div>`).join('')}
    ${lay.nodes.map(nodeHTML).join('')}`;
  const v = S.view[S.flow.key];
  if (!v || !v.user) S.view[S.flow.key] = fitView(lay, S.flow.follow);
  applyView();
  refreshOpenNode();
}

function renderSessionHead(s, model) {
  const st = effStatus(s);
  $('#shead').innerHTML = `
    <div style="flex:1;min-width:0">
      <div class="t">${esc(s.title || 'Phiên mới')}</div>
      <div class="m">${statusTag(st)}<span class="row" style="gap:4px">${icon('folder', 'sm')}${esc(s.project || '')}</span><span>bắt đầu ${fmtHM(s.startedAt)}</span><span>${model.loops.length} vòng</span>
        <span class="row" style="gap:4px">${icon('user', 'sm')}Agent chính: ${esc(prettyModel(s.model) || modelName(S.mainModel) || 'Mặc định')}</span></div>
    </div>
    <button class="btn ghost" data-sact="hide" title="Ẩn phiên này khỏi danh sách">${icon('trash', 'sm')}</button>`;

  const nb = $('#nowbar');
  let cls = '', html = '';
  const running = (s.agents || []).filter(a => AGENT_LIVE.has(a.status) && a.type !== 'agent');
  if (st === 'waiting') { cls = 'warn'; html = `${icon('bell', 'sm')}<span><b>Đang chờ bạn</b> trả lời trong cửa sổ Claude Code</span>`; }
  else if (st === 'working') {
    if (running.length > 1) html = `<span class="spinner"></span><span><b>Đang làm:</b> ${running.length} agent chạy song song (${running.map(a => esc(a.type)).join(', ')})</span>`;
    else if (running.length === 1) html = `<span class="spinner"></span><span><b>Đang làm:</b> agent “${esc(running[0].type)}”${running[0].description ? ` · ${esc(running[0].description)}` : ''}</span>`;
    else html = `<span class="spinner"></span><span><b>Đang làm:</b> agent chính đang xử lý</span>`;
  }
  nb.className = `nowbar ${cls}`;
  nb.hidden = !html;
  nb.innerHTML = html;
}

function renderLoopbar(s, loops, li) {
  const bar = $('#loopbar');
  bar.hidden = false;
  const L = loops[li];
  const state = loopState(s, L, li, loops.length);
  const endTs = L.end || (state === 'running' || state === 'waiting' ? Date.now() : L.last);
  const dur = L.start && endTs ? fmtDur(endTs - L.start) : '';
  const sum = [fmtHM(L.start), dur, L.agentKeys.size ? `${L.agentKeys.size} agent` : '', L.skills.size ? `${L.skills.size} skill` : '', L.files.length ? `${L.files.length} file` : ''].filter(Boolean).join(' · ');
  const list = bar.querySelector('.lp-list');
  const keep = list ? list.scrollLeft : null;
  bar.innerHTML = `<div class="lp-list">${loops.map((x, i) => {
    const st = loopState(s, x, i, loops.length);
    const pr = x.prompt ? x.prompt.promptText || x.prompt.text : '';
    return `<button class="lp ${i === li ? 'on' : ''} lp-${st}" data-loopsel="${esc(x.key)}" title="${esc(pr)}"><span class="dot ${st === 'running' || st === 'waiting' ? 'blink' : ''}"></span>${x.prompt ? `Vòng ${i + 1}` : 'Trước đó'}</button>`;
  }).join('')}</div><div class="lp-sum">${esc(sum)}</div>`;
  const nl = bar.querySelector('.lp-list'), on = nl.querySelector('.lp.on');
  if (keep != null && S.lastLoopbar === `${s.id}|${L.key}`) nl.scrollLeft = keep;
  else if (on) nl.scrollLeft = on.offsetLeft - nl.clientWidth / 2 + on.offsetWidth / 2;
  S.lastLoopbar = `${s.id}|${L.key}`;
}

$('#view-live').addEventListener('click', async e => {
  const t = e.target;
  if (t.closest('select')) return;
  const sessEl = t.closest('[data-session]');
  if (sessEl) { S.selected = sessEl.dataset.session; await ensureSteps(S.selected); return renderLive(); }
  const sact = t.closest('[data-sact]');
  if (sact && sact.dataset.sact === 'hide') return hideSession();
  const lp = t.closest('[data-loopsel]');
  if (lp) {
    const { loops } = buildLoops(S.sessions.get(S.selected));
    S.loopSel[S.selected] = loops.length && loops[loops.length - 1].key === lp.dataset.loopsel ? null : lp.dataset.loopsel;
    return renderLive();
  }
  const z = t.closest('[data-zoom]');
  if (z) {
    const v = curView(), flow = $('#flow');
    if (!v) return;
    if (z.dataset.zoom === 'fit') S.view[S.flow.key] = fitView(S.flow.lay, S.flow.follow);
    else zoomAt(v, flow.clientWidth / 2, flow.clientHeight / 2, z.dataset.zoom === 'in' ? 1.2 : 1 / 1.2);
    return applyView();
  }
  const node = t.closest('[data-node]');
  if (node && !(S.panEndAt && Date.now() - S.panEndAt < 250)) return openFlowNode(node.dataset.node);
});

// ================================================================== step panel (like n8n's node view)
// Three columns: what went into the step, its settings (editable), what came out.
let N = null; // the open step: { sessionId, loopKey, nodeId, ctx }

const blk = (label, html) => `<div class="ndv-blk"><div class="label">${label}</div>${html}</div>`;
const tbox = (t, none = 'Không có.') => (t ? `<div class="textbox">${esc(t)}</div>` : `<div class="small muted">${esc(none)}</div>`);
const kvs = rows => `<div class="kv">${rows.filter(r => r && r[1]).map(([k, v]) => `<span class="k">${esc(k)}</span><span>${v}</span>`).join('')}</div>`;

function mainModelHTML() {
  const opts = [['', 'Mặc định của Claude Code'], ['opus', 'Opus · thông minh nhất'], ['sonnet', 'Sonnet · cân bằng'], ['haiku', 'Haiku · nhanh, tiết kiệm'], ['fable', 'Fable'], ['opusplan', 'Opus khi lập kế hoạch, Sonnet khi làm']];
  if (S.mainModel && !opts.some(o => o[0] === S.mainModel)) opts.push([S.mainModel, S.mainModel]);
  return `<div class="field"><div class="flabel">Model của agent chính</div>
    <div class="help">Model Claude Code dùng cho các phiên mới. Agent đặt “Giống agent chính” cũng dùng model này. Lưu ngay khi đổi.</div>
    <select class="select" id="ndv-main">${opts.map(([v, l]) => `<option value="${esc(v)}" ${S.mainModel === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
}

function opsHTML(steps) {
  if (!steps.length) return '';
  const shown = steps.slice(-200);
  return `<div class="ops">${steps.length > shown.length ? `<div class="small faint">… và ${steps.length - shown.length} thao tác trước đó</div>` : ''}${shown.map(x => `
    <div class="op ${esc(x.status || '')}"><span class="op-t">${fmtTime(x.ts)}</span><span class="op-x">${esc(x.text || x.tool)}</span>${statusMark(x.status === 'running' ? 'running' : x.status === 'failed' ? 'failed' : '')}</div>`).join('')}</div>`;
}

// Builds the three columns for one step of the canvas.
function nodeCtx(s, L, n, model) {
  const c = { title: n.title, icon: n.icon || 'play', color: n.color, kindLabel: '', status: statusMark(n.status), input: '', middle: '', output: '', item: null };
  const files = list => (list.length ? `<div class="flinks">${fileLinks(list)}</div>` : '');
  switch (n.kind) {
    case 'trigger': {
      const p = L.prompt;
      c.kindLabel = 'Điểm bắt đầu';
      c.input = blk('Từ', `<div>Bạn${p ? `, lúc ${fmtTime(p.ts)}` : ''}</div>`);
      c.middle = p ? blk(p.command ? 'Lệnh bạn chạy' : 'Yêu cầu bạn gửi', tbox(p.detail || p.promptText || p.text)) +
        `<div class="small faint">Yêu cầu đã gửi thì không sửa được. Muốn đổi hướng, hãy gửi yêu cầu mới trong Claude Code.</div>`
        : `<div class="small muted">Phiên này đã chạy trước khi bảng điều khiển bắt đầu ghi lại, nên không biết yêu cầu ban đầu.</div>`;
      c.output = blk('Chuyển cho', '<div>Agent chính</div>') + blk('Sau đó', kvs([['Agent được gọi', String(L.agentKeys.size || '')], ['Skill được dùng', String(L.skills.size || '')], ['File tạo/sửa', String(L.files.length || '')]]) || '<div class="small muted">Chưa có gì.</div>');
      return c;
    }
    case 'work': {
      const { steps, progress } = n.data;
      const t0 = steps.length ? steps[0].ts : 0, t1 = steps.length ? Math.max(...steps.map(x => x.endedAt || x.ts)) : 0;
      c.kindLabel = 'Agent chính';
      c.input = blk('Việc này', '<div class="small muted">Những việc nhỏ agent chính tự làm, như đọc tài liệu, tìm thông tin, ghi file, được gộp lại thành một bước.</div>') +
        blk('Lần chạy này', kvs([['Model', esc(prettyModel(s.model) || modelName(S.mainModel) || 'Mặc định')], ['Số thao tác', String(steps.length || '')], ['Thời gian', t0 ? `${fmtTime(t0)} → ${fmtTime(t1)}` : '']]));
      c.middle = mainModelHTML() + (steps.length ? blk(`Các thao tác (${steps.length})`, opsHTML(steps)) : '') +
        (progress.length ? blk('Cập nhật kế hoạch', progress.map(pc => `<div class="plan-item ${pc.kind === 'done' ? 'completed' : 'in_progress'}"><div class="box">${pc.kind === 'done' ? icon('check', 'sm') : ''}</div><div class="txt">${pc.kind === 'done' ? 'Xong' : 'Bắt đầu'}: ${esc(pc.content)}</div></div>`).join('')) : '');
      c.output = blk('File tạo/sửa', files(filesOf(steps)) || '<div class="small muted">Không tạo hay sửa file nào.</div>');
      return c;
    }
    case 'plan': {
      const plan = (s.todos && s.todos.length) ? s.todos : Object.values(s.tasks || {});
      const done = plan.filter(t => t.status === 'completed').length;
      c.kindLabel = 'Kế hoạch';
      c.input = blk('Lúc', `<div>${fmtTime(n.data.it.ts)}</div>`);
      c.middle = blk('Các việc đã lên kế hoạch', `<ol class="plan-ol">${n.data.it.change.items.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`) +
        '<div class="small faint">Kế hoạch do agent chính tự lập. Muốn đổi, hãy nhắn cho Claude Code.</div>';
      c.output = plan.length ? blk(`Tiến độ hiện tại <span class="bar"><div style="width:${Math.round(done / plan.length * 100)}%"></div></span><span>${done}/${plan.length}</span>`,
        plan.map(t => `<div class="plan-item ${esc(t.status)}"><div class="box">${t.status === 'completed' ? icon('check', 'sm') : ''}</div><div class="txt">${esc(t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content)}</div></div>`).join('')) : '';
      return c;
    }
    case 'agent': {
      const { ag, step, info } = n.data;
      const type = n.title;
      const status = ag ? ag.status : step?.status;
      const statusText = { starting: 'Đang bắt đầu', working: 'Đang làm', done: 'Xong', failed: 'Bị lỗi' }[status] || 'Không rõ';
      const result = (ag && ag.result) || (step && step.result && !/chạy nền/.test(step.result) ? step.result : '');
      c.kindLabel = 'Agent';
      c.item = { kind: 'agent', name: type };
      c.input = blk('Việc được giao', `<div><b>${esc(agentTask(ag, step) || '—')}</b></div>`) +
        blk('Lần chạy này', kvs([['Trạng thái', esc(statusText) + (ag && ag.background ? ' · chạy nền' : '')], ['Model', esc(agentModel(ag))],
          ['Thời gian', ag && ag.startedAt ? `${fmtHM(ag.startedAt)}${ag.endedAt ? ' → ' + fmtHM(ag.endedAt) : ''} · ${esc(agentDur(ag))}` : ''], ['Thao tác', info.ops ? String(info.ops) : '']])) +
        (ag && ag.model ? `<div class="small muted" style="margin:-6px 0 12px">Lần này agent chính chỉ định model ${esc(modelName(ag.model))} khi giao việc.</div>` : '') +
        blk('Nội dung giao việc đầy đủ', tbox((ag && ag.prompt) || step?.detail || ''));
      c.output = blk('Kết quả trả về', result ? tbox(result) : `<div class="small muted">${AGENT_LIVE.has(status) ? 'Agent đang làm, kết quả sẽ hiện ở đây khi xong.' : 'Không có kết quả.'}</div>`) +
        (info.skills.length ? blk('Skill đã dùng', `<div class="flinks">${info.skills.map(x => `<span class="chip skill-chip">${icon('zap', 'sm')}${esc(x)}</span>`).join('')}</div>`) : '') +
        (info.agents.length ? blk('Agent con được gọi', `<div class="flinks">${info.agents.map(a => `<span class="chip">${icon('bot', 'sm')}${esc(a.type)}</span>`).join('')}</div>`) : '') +
        (info.files.length ? blk('File tạo/sửa', files(info.files)) : '');
      c.middle = `<div class="small muted">${BUILTIN_AGENTS.includes(type) ? `“${esc(type)}” là agent có sẵn của Claude Code nên không có thiết lập riêng để chỉnh. Muốn chỉnh model hay hướng dẫn, hãy tạo một agent riêng.<div style="margin-top:10px"><button class="btn sm primary" data-newitem="agent">${icon('plus', 'sm')}Tạo agent của riêng bạn</button></div>` : `Không tìm thấy file thiết lập của agent “${esc(type)}”.`}</div>`;
      return c;
    }
    case 'skill': {
      const it = n.data.it;
      c.kindLabel = 'Skill';
      c.item = { kind: 'skill', name: it.name };
      c.input = blk('Ai dùng', `<div>${it.fromPrompt ? 'Bạn gọi bằng lệnh' : 'Agent chính'}, lúc ${fmtTime(it.ts)}</div>`) + blk('Thông tin kèm theo', tbox(it.step && !it.fromPrompt ? it.step.detail : it.step?.text || ''));
      const raw = it.step && !it.fromPrompt ? it.step.result || '' : '';
      c.output = blk('Kết quả', /^\s*\{"success":\s*true/.test(raw) ? '<div>Đã nạp skill. Agent chính làm theo hướng dẫn của skill ở các bước sau.</div>'
        : tbox(raw, 'Skill hướng dẫn agent chính cách làm; kết quả nằm ở các bước sau.'));
      c.middle = `<div class="small muted">Không tìm thấy file thiết lập của skill “${esc(it.name)}”.</div>`;
      return c;
    }
    case 'report': {
      const ag = n.data.ag;
      c.kindLabel = 'Agent chạy nền';
      c.input = blk('Từ agent', `<div><b>${esc(ag.type)}</b>${ag.description ? ` · ${esc(ag.description)}` : ''}</div>`) + `<button class="btn sm" data-goto-node="agent:${esc(ag.key)}">${icon('bot', 'sm')}Mở bước giao việc cho agent này</button>`;
      c.middle = blk('Kết quả gửi về', tbox(ag.result));
      c.output = blk('Chuyển cho', '<div>Agent chính</div>');
      return c;
    }
    case 'waiting':
      c.kindLabel = 'Chờ bạn';
      c.middle = blk('Claude Code đang chờ', tbox(n.sub)) + '<div class="small faint">Trả lời trong cửa sổ Claude Code để nó làm tiếp.</div>';
      return c;
    case 'end': {
      c.kindLabel = 'Kết thúc vòng';
      c.input = blk('Vòng này', kvs([['Bắt đầu', fmtTime(L.start)], ['Thời gian', esc(n.data.dur)], ['Agent', String(L.agentKeys.size || '')], ['Skill', esc([...L.skills].filter(Boolean).join(', '))]]));
      c.middle = blk('Trạng thái', `<div>${esc(n.title)}</div>${n.sub && !L.files.length ? `<div class="small muted">${esc(n.sub)}</div>` : ''}`);
      c.output = blk('Kết quả tạo ra · bấm để đọc', files([...L.files].sort((a, b) => base(a).localeCompare(base(b)))) || '<div class="small muted">Vòng này không tạo file nào.</div>');
      return c;
    }
    default: return c;
  }
}

// Last time an agent / skill ran, to fill the input / output columns when it is opened from the "Agent & Skill" tab.
function lastRun(it) {
  let best = null;
  const same = n => n === it.name || n === it.invokeName;
  for (const s of S.sessions.values()) {
    if (it.kind === 'agent') {
      for (const a of s.agents || []) if (same(a.type) && (!best || a.startedAt > best.ts)) best = { ts: a.startedAt, task: a.description, input: a.prompt, output: a.result, s };
    } else {
      for (const st of s.steps || []) if (st.tool === 'Skill' && st.link && same(st.link.name) && (!best || st.ts > best.ts)) best = { ts: st.ts, input: st.detail, output: st.result, s };
    }
  }
  return best;
}
function itemCtx(it) {
  const run = lastRun(it);
  const when = run ? `<div class="small muted" style="margin-bottom:10px">Lần chạy gần nhất: ${new Date(run.ts).toLocaleString('vi-VN')} · ${esc(run.s.project || '')}</div>` : '';
  return {
    title: it.name, icon: it.kind === 'agent' ? 'bot' : 'zap', color: it.kind === 'agent' ? 'var(--c-agent)' : 'var(--c-skill)',
    kindLabel: it.kind === 'agent' ? 'Agent' : 'Skill', status: '',
    input: run ? when + (run.task ? blk('Việc được giao', `<div><b>${esc(run.task)}</b></div>`) : '') + blk(it.kind === 'agent' ? 'Nội dung giao việc' : 'Thông tin kèm theo', tbox(run.input))
      : `<div class="small muted">${it.kind === 'agent' ? 'Agent' : 'Skill'} này chưa chạy lần nào trong các phiên bảng điều khiển đã ghi lại.</div>`,
    output: run ? blk('Kết quả lần gần nhất', tbox(run.output)) : '',
  };
}

function findFlowNode(id) { return S.flow ? S.flow.lay.nodes.find(n => n.id === id) : null; }

async function openFlowNode(id) {
  const n = findFlowNode(id);
  if (!n || !S.flow) return;
  const s = S.sessions.get(S.flow.sessionId);
  const ctx = nodeCtx(s, S.flow.L, n, S.flow.model);
  if (ctx.item && !S.items) { try { await loadItems(); } catch {} }
  const item = ctx.item ? findItem(ctx.item.kind, ctx.item.name) : null;
  return openNdv({ sessionId: s.id, loopKey: S.flow.loopKey, nodeId: id, ctx }, item ? item.id : null);
}

async function openNdv(n, itemId, force) {
  if (!force && anyDirty()) {
    const ok = await modal({ title: 'Bỏ các thay đổi chưa lưu?', text: 'Nếu chuyển sang bước khác bây giờ, những gì bạn vừa sửa sẽ mất.', okText: 'Bỏ thay đổi', okClass: 'danger-solid', cancelText: 'Tiếp tục sửa' });
    if (!ok) return;
  }
  let item = null;
  if (itemId) { try { item = await api(`/api/items/${itemId}`); } catch (e) { toast(e.message, 'error'); } }
  R = null;
  N = n;
  E = item ? { item, tab: 'basic', model: item.model, description: item.description, body: item.body, blocks: parseDoc(item.body) } : null;
  S.openNode = n.nodeId || null;
  const d = $('#drawer');
  d.classList.add('ndv', 'open');
  d.setAttribute('aria-hidden', 'false');
  renderNdv();
  if (S.tab === 'live') scheduleLive();
}

async function openEditor(id) {
  let it = S.items && S.items.find(i => i.id === id);
  if (!it) { try { it = await api(`/api/items/${id}`); } catch (e) { return toast(e.message, 'error'); } }
  return openNdv({ ctx: itemCtx(it) }, id);
}

function renderNdv() {
  const c = N.ctx;
  const it = E && E.item;
  const ro = it && !it.editable;
  const order = N.sessionId && S.flow && S.flow.loopKey === N.loopKey ? S.flow.lay.nodes : [];
  const pos = order.findIndex(x => x.id === N.nodeId);
  const kindWord = it ? (it.kind === 'agent' ? 'agent' : 'skill') : '';
  const middle = E ? `
      ${ro ? `<div class="callout warn" style="margin-bottom:14px">${icon('lock', 'sm')}<div style="flex:1">Mục này đến từ ${it.scope === 'plugin' ? 'plugin' : 'claude.ai'} nên chỉ xem được (sửa sẽ bị ghi đè khi cập nhật). Muốn chỉnh, hãy tạo bản sao của riêng bạn.</div><button class="btn sm primary" data-eact="copy">${icon('copy', 'sm')}Tạo bản sao</button></div>` : ''}
      ${it.managedBy ? `<div class="callout warn" style="margin-bottom:14px">${icon('alert', 'sm')}<div>Mục này do <b>${esc(it.managedBy)}</b> quản lý, có thể bị ghi đè khi ${esc(it.managedBy)} cập nhật.</div></div>` : ''}
      <div class="dtabs">
        <button data-etab="basic" class="${E.tab === 'basic' ? 'on' : ''}">Thiết lập</button>
        <button data-etab="history" class="${E.tab === 'history' ? 'on' : ''}">Lịch sử (${it.historyCount})</button>
      </div>
      <div id="etab"></div>` : c.middle;
  $('#drawer-panel').innerHTML = `
    <div class="ndv-head">
      <div class="ndv-ic" style="--c:${c.color || 'var(--muted)'}">${icon(c.icon, 'lg')}</div>
      <div style="flex:1;min-width:0">
        <div class="ndv-k">${esc(c.kindLabel)}${it ? ` · ${esc(it.group)}` : ''}</div>
        <div class="ndv-t">${esc(c.title)} ${c.status || ''}</div>
      </div>
      ${pos >= 0 && order.length > 1 ? `<div class="ndv-nav">
        <button class="btn sm" data-ndv-go="-1" ${pos <= 0 ? 'disabled' : ''} title="Bước trước">${icon('chevron', 'sm rot90')}Bước trước</button>
        <span class="small faint">${pos + 1} / ${order.length}</span>
        <button class="btn sm" data-ndv-go="1" ${pos >= order.length - 1 ? 'disabled' : ''} title="Bước sau">Bước sau${icon('chevron', 'sm rot-90')}</button></div>` : ''}
      <button class="btn ghost" data-ndv-close="1" title="Đóng (Esc)">${icon('close')}</button>
    </div>
    <div class="ndv-cols">
      <section class="ndv-col side"><div class="ndv-ch">${icon('ret', 'sm flip')}Đầu vào</div><div id="ndv-in">${c.input || '<div class="small muted">Không có.</div>'}</div></section>
      <section class="ndv-col mid"><div class="ndv-ch">${icon('cog', 'sm')}Thiết lập</div>${middle}</section>
      <section class="ndv-col side"><div class="ndv-ch">${icon('ret', 'sm')}Đầu ra</div><div id="ndv-out">${c.output || '<div class="small muted">Không có.</div>'}</div></section>
    </div>
    <div class="d-foot">
      ${E ? `<span id="dirty" class="small muted"></span><span class="spacer"></span>
        ${!ro ? `<span class="small faint">Áp dụng từ lần ${kindWord} này chạy tiếp theo</span>` : ''}
        ${ro ? '<button class="btn" data-ndv-close="1">Đóng</button>' : `<button class="btn" data-eact="revert">Huỷ thay đổi</button><button class="btn primary" data-eact="save">${icon('save', 'sm')}Lưu</button>`}`
        : '<span class="spacer"></span><button class="btn" data-ndv-close="1">Đóng</button>'}
    </div>`;
  if (E) renderEditorTab();
}

// While a step is open, keep its input / output columns current (an agent may still be working).
function refreshOpenNode() {
  if (!N || !N.sessionId || !S.flow || S.flow.sessionId !== N.sessionId || S.flow.loopKey !== N.loopKey) return;
  const sel = window.getSelection();
  if (sel && sel.toString() && $('#drawer').contains(sel.anchorNode)) return;
  const n = findFlowNode(N.nodeId);
  if (!n) return;
  const ctx = nodeCtx(S.sessions.get(N.sessionId), S.flow.L, n, S.flow.model);
  N.ctx = { ...ctx, middle: N.ctx.middle };
  for (const [id, html] of [['#ndv-in', ctx.input], ['#ndv-out', ctx.output]]) {
    const el = $(id);
    if (el && el.innerHTML !== html) { const col = el.parentElement, top = col.scrollTop; el.innerHTML = html || '<div class="small muted">Không có.</div>'; col.scrollTop = top; }
  }
}

$('#drawer').addEventListener('click', async e => {
  if (!N || R) return;
  const t = e.target;
  if (t.closest('[data-ndv-close]')) return closeEditor();
  const go = t.closest('[data-ndv-go]');
  if (go && S.flow) {
    const order = S.flow.lay.nodes;
    const next = order[order.findIndex(x => x.id === N.nodeId) + Number(go.dataset.ndvGo)];
    if (next) return openFlowNode(next.id);
  }
  const gn = t.closest('[data-goto-node]');
  if (gn) return openFlowNode(gn.dataset.gotoNode);
  const of = t.closest('[data-open-file]');
  if (of && N.sessionId) { e.preventDefault(); return openReader(N.sessionId, of.dataset.openFile); }
});
$('#drawer').addEventListener('change', async e => {
  if (e.target.id !== 'ndv-main') return;
  try {
    const { mainModel } = await api('/api/main-model', { model: e.target.value });
    S.mainModel = mainModel;
    toast('Đã đổi model của agent chính. Áp dụng cho các phiên mới.');
  } catch (err) { toast(err.message, 'error'); }
});

async function ensureSteps(id) {
  const s = S.sessions.get(id);
  if (!s || (s.stepCount || 0) <= (s.steps || []).length) return;
  try { const full = await api(`/api/sessions/${encodeURIComponent(id)}`); S.sessions.set(id, { ...s, steps: full.steps }); } catch {}
}

async function hideSession() {
  const id = S.selected;
  const ok = await modal({ title: 'Ẩn phiên này?', text: 'Phiên sẽ không còn trong danh sách. Không ảnh hưởng tới Claude Code.', okText: 'Ẩn phiên' });
  if (!ok) return;
  try {
    await api(`/api/sessions/${encodeURIComponent(id)}/hide`, {});
    S.sessions.delete(id); S.selected = null; renderLive();
  } catch (err) { toast(err.message, 'error'); }
}

async function copyItem(id) {
  try {
    const { id: newId } = await api(`/api/items/${id}/copy`, {});
    toast('Đã tạo bản sao trong nhóm “Của bạn”. Giờ bạn có thể chỉnh nó.');
    await loadItems(true);
    if (N && N.sessionId) await openNdv(N, newId, true);
    else { const it = S.items.find(i => i.id === newId); await openNdv({ ctx: it ? itemCtx(it) : N.ctx }, newId, true); }
    if (S.tab === 'team') renderTeam(); else scheduleLive();
  } catch (err) { toast(err.message, 'error'); }
}

// ================================================================== team view
const groupOrder = it => ({ user: 0, project: 1, synced: 2, plugin: 3 }[it.scope] ?? 4);
const groupCollapsed = (name, editable) => (name in S.team.groups ? S.team.groups[name] : !editable);
function activeAgentTypes() {
  const set = new Set();
  for (const s of S.sessions.values()) for (const a of s.agents || []) if (AGENT_LIVE.has(a.status)) set.add(a.type);
  return set;
}

async function renderTeam() {
  const root = $('#view-team');
  if (!S.items) {
    root.innerHTML = '<div class="empty"><span class="spinner"></span><div style="margin-top:8px">Đang tìm các agent và skill…</div></div>';
    try { await loadItems(); } catch (e) { root.innerHTML = `<div class="callout bad">${esc(e.message)}</div>`; return; }
  }
  const T = S.team;
  const q = T.q.trim().toLowerCase();
  const filtered = S.items.filter(i => (T.kind === 'all' || i.kind === T.kind) && (!q || `${i.name} ${i.description} ${i.plugin || ''}`.toLowerCase().includes(q)));
  const groups = new Map();
  for (const i of filtered.sort((a, b) => groupOrder(a) - groupOrder(b) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))) {
    if (!groups.has(i.group)) groups.set(i.group, []);
    groups.get(i.group).push(i);
  }
  const running = activeAgentTypes();
  const focused = document.activeElement?.id === 'team-q';
  const caret = focused ? document.activeElement.selectionStart : null;

  root.innerHTML = `
    <div class="page-head">
      <div style="flex:1">
        <h1 class="h1">Agent &amp; Skill</h1>
        <div class="muted">Đổi model ngay trên thẻ (lưu luôn). Bấm vào thẻ để sửa hướng dẫn. Thay đổi áp dụng từ lần chạy tiếp theo.</div>
      </div>
      <button class="btn" data-tact="reload">${icon('refresh', 'sm')}Tải lại</button>
      <button class="btn primary" data-newitem="${T.kind === 'skill' ? 'skill' : 'agent'}">${icon('plus', 'sm')}Tạo mới</button>
    </div>
    ${localStorage.getItem('hideExplain') ? '' : `<div class="callout" style="margin-bottom:16px">${icon('info', 'sm')}<div style="flex:1"><b>Agent</b> là một “nhân viên” chuyên một việc, được agent chính giao việc. <b>Skill</b> là một “quy trình mẫu” mà AI tự dùng khi gặp đúng loại việc.</div><button class="btn ghost sm" data-tact="hide-explain">Đã hiểu</button></div>`}
    <div class="toolbar">
      <div class="search">${icon('search', 'sm')}<input id="team-q" placeholder="Tìm theo tên hoặc mô tả" value="${esc(T.q)}"></div>
      <div class="seg" data-seg="kind">${[['all', 'Tất cả'], ['agent', 'Agent'], ['skill', 'Skill']].map(([v, l]) => `<button data-v="${v}" class="${T.kind === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    ${groups.size ? [...groups.entries()].map(([name, list]) => {
      const editable = list.some(i => i.editable);
      const collapsed = !q && groupCollapsed(name, editable);
      return `<div class="group ${collapsed ? 'collapsed' : ''}">
        <div class="group-head" data-toggle-group="${esc(name)}" data-editable="${editable ? 1 : 0}">
          ${icon('chevron', 'sm caret')}<span class="h3">${esc(name)}</span><span class="chip">${list.length}</span>
        </div>
        <div class="grid">${list.map(i => itemCard(i, running)).join('')}</div>
      </div>`;
    }).join('') : `<div class="card empty"><div class="title">Không tìm thấy mục nào</div><div>Thử đổi từ khoá hoặc bộ lọc.</div></div>`}`;
  if (focused) { const inp = $('#team-q'); inp.focus(); inp.setSelectionRange(caret, caret); }
}

function itemCard(i, running) {
  return `<div class="card item" data-item="${esc(i.id)}">
    <div class="item-top">
      <div class="item-ico ${i.kind}">${icon(i.kind === 'agent' ? 'bot' : 'zap')}</div>
      <div style="min-width:0"><div class="item-name" title="${esc(i.invokeName)}">${esc(i.name)}</div>
      <div class="item-kind">${i.kind === 'agent' ? 'Agent' : 'Skill'}${i.plugin ? ' · ' + esc(i.plugin) : ''}</div></div>
    </div>
    <div class="item-desc">${esc(i.description || 'Chưa có mô tả')}</div>
    <div class="item-foot">
      <span class="small muted">Model</span>${modelPicker(i, 'sm')}
      <span class="spacer"></span>
      ${i.kind === 'agent' && running.has(i.name) ? '<span class="chip accent"><span class="dot blink"></span>Đang chạy</span>' : ''}
      ${i.managedBy ? `<span class="chip warn" title="Có thể bị ${esc(i.managedBy)} ghi đè khi cập nhật">${esc(i.managedBy)} quản lý</span>` : ''}
    </div>
  </div>`;
}

let qTimer;
$('#view-team').addEventListener('input', e => {
  if (e.target.id === 'team-q') { clearTimeout(qTimer); const v = e.target.value; qTimer = setTimeout(() => { S.team.q = v; renderTeam(); }, 150); }
});
$('#view-team').addEventListener('click', async e => {
  const t = e.target;
  if (t.closest('select')) return;
  const T = S.team;
  const seg = t.closest('[data-seg] button');
  if (seg) { T[seg.parentElement.dataset.seg] = seg.dataset.v; return renderTeam(); }
  const g = t.closest('[data-toggle-group]');
  if (g) {
    const name = g.dataset.toggleGroup;
    T.groups[name] = !groupCollapsed(name, g.dataset.editable === '1');
    localStorage.setItem('groups', JSON.stringify(T.groups));
    return renderTeam();
  }
  const act = t.closest('[data-tact]')?.dataset.tact;
  if (act === 'reload') { S.items = null; return renderTeam(); }
  if (act === 'hide-explain') { localStorage.setItem('hideExplain', '1'); return renderTeam(); }
  const card = t.closest('[data-item]');
  if (card) openEditor(card.dataset.item);
});

// ================================================================== rule document (markdown <-> plain editable text)
// The rules are stored as Markdown, but people edit them as a normal document: headings, paragraphs and
// one line per rule. Only blocks that were edited are rewritten; everything else is saved byte-for-byte.
function parseDoc(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  const listRe = /^(\s*)([-*+]|\d+[.)])\s+/;
  let i = 0, blank = 0;
  const push = (b, start) => { b.blank = blank; b.src = lines.slice(start, i).join('\n'); blocks.push(b); blank = 0; };
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { blank++; i++; continue; }
    const start = i;
    let m;
    if ((m = /^\s*(```|~~~)(.*)$/.exec(l))) {
      const fence = m[1]; const body = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) body.push(lines[i++]);
      if (i < lines.length) i++;
      push({ type: 'code', lang: m[2].trim(), text: body.join('\n') }, start); continue;
    }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { i++; push({ type: 'heading', level: m[1].length, text: m[2].trim() }, start); continue; }
    if (/^\s*\|/.test(l)) { while (i < lines.length && /^\s*\|/.test(lines[i])) i++; push({ type: 'raw', kind: 'table' }, start); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { i++; push({ type: 'raw', kind: 'hr' }, start); continue; }
    if (/^\s*</.test(l)) { while (i < lines.length && lines[i].trim()) i++; push({ type: 'raw', kind: 'html' }, start); continue; }
    if (/^\s*>/.test(l)) {
      while (i < lines.length && /^\s*>/.test(lines[i])) i++;
      push({ type: 'quote', text: lines.slice(start, i).map(x => x.replace(/^\s*>\s?/, '')).join('\n') }, start); continue;
    }
    if ((m = listRe.exec(l))) {
      const items = [];
      const ordered = /\d/.test(m[2]);
      while (i < lines.length) {
        const lm = listRe.exec(lines[i]);
        if (lm) { items.push({ indent: lm[1].length, marker: lm[2], text: lines[i].slice(lm[0].length) }); i++; }
        else if (items.length && lines[i].trim() && /^\s{2,}/.test(lines[i]) && !/^\s*(```|~~~)/.test(lines[i])) { items[items.length - 1].text += '\n' + lines[i].trim(); i++; }
        else break;
      }
      push({ type: 'list', ordered, items }, start); continue;
    }
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s/.test(lines[i]) && !listRe.test(lines[i]) && !/^\s*(```|~~~|\||>)/.test(lines[i])) i++;
    push({ type: 'para', text: lines.slice(start, i).join('\n') }, start);
  }
  blocks.trail = blank; // blank lines after the last block (includes the final newline)
  return blocks;
}

function blockMd(b) {
  if (!b.dirty && b.src != null) return b.src;
  switch (b.type) {
    case 'heading': return `${'#'.repeat(b.level || 2)} ${b.text.replace(/\n+/g, ' ')}`;
    case 'para': return b.text;
    case 'quote': return b.text.split('\n').map(l => `> ${l}`).join('\n');
    case 'code': return '```' + (b.lang || '') + '\n' + b.text + '\n```';
    case 'list': {
      let n = 0;
      return b.items.map(it => {
        const ind = ' '.repeat(it.indent || 0);
        const mk = b.ordered ? `${++n}.` : (it.marker && !/\d/.test(it.marker) ? it.marker : '-');
        return `${ind}${mk} ${it.text.replace(/\n/g, '\n' + ind + '  ')}`;
      }).join('\n');
    }
    default: return b.src || '';
  }
}

function serializeDoc(blocks) {
  const live = blocks.filter(b => !(b.type === 'list' && !b.items.length));
  const body = live.map((b, k) => (k === 0 ? '\n'.repeat(b.blank || 0) : '\n' + '\n'.repeat(b.blank ?? 1)) + blockMd(b)).join('');
  return body + '\n'.repeat(blocks.trail ?? 1);
}

function mdInline(t) {
  let h = esc(t);
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1<i>$2</i>');
  h = h.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '<a data-href="$2">$1</a>');
  return h.replace(/\n/g, '<br>');
}

function domToMd(el) {
  let out = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += n.nodeValue;
    else if (n.nodeName === 'BR') out += '\n';
    else if (n.nodeName === 'B' || n.nodeName === 'STRONG') out += `**${domToMd(n)}**`;
    else if (n.nodeName === 'I' || n.nodeName === 'EM') out += `*${domToMd(n)}*`;
    else if (n.nodeName === 'CODE') out += '`' + n.textContent + '`';
    else if (n.nodeName === 'A') out += `[${n.textContent}](${n.getAttribute('data-href') || n.getAttribute('href') || ''})`;
    else if (n.nodeName === 'DIV' || n.nodeName === 'P') out += (out && !out.endsWith('\n') ? '\n' : '') + domToMd(n);
    else out += domToMd(n);
  }
  return out.replace(/ /g, ' ').replace(/\*\*\*\*/g, '');
}

function tableHTML(src) {
  const rows = src.split('\n').filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  return `<table class="doc-table">${rows.map((r, i) => `<tr>${r.map(c => (i ? `<td>${mdInline(c)}</td>` : `<th>${mdInline(c)}</th>`)).join('')}</tr>`).join('')}</table>`;
}

function docHTML(blocks, ro) {
  const ce = ro ? 'false' : 'true';
  const del = (bi, ii) => (ro ? '' : `<button type="button" class="doc-x" data-docdel="${bi}" ${ii != null ? `data-i="${ii}"` : ''} title="Xoá">${icon('x', 'sm')}</button>`);
  const html = blocks.map((b, bi) => {
    switch (b.type) {
      case 'heading': return `<div class="doc-b doc-h l${b.level}">${del(bi)}<div class="ce" contenteditable="${ce}" data-b="${bi}" data-ph="Tiêu đề mục">${mdInline(b.text)}</div></div>`;
      case 'para': return `<div class="doc-b doc-p">${del(bi)}<div class="ce" contenteditable="${ce}" data-b="${bi}" data-ph="Viết nội dung…">${mdInline(b.text)}</div></div>`;
      case 'quote': return `<div class="doc-b doc-q">${del(bi)}<div class="ce" contenteditable="${ce}" data-b="${bi}">${mdInline(b.text)}</div></div>`;
      case 'list': return `<div class="doc-b doc-l">${b.items.map((it, ii) => `
          <div class="doc-li" style="margin-left:${Math.min(6, Math.floor((it.indent || 0) / 2)) * 18}px">
            <span class="doc-bullet">${b.ordered ? `${ii + 1}.` : '•'}</span>
            <div class="ce" contenteditable="${ce}" data-b="${bi}" data-i="${ii}" data-ph="Viết quy tắc…">${mdInline(it.text)}</div>${del(bi, ii)}
          </div>`).join('')}
          ${ro ? '' : `<button type="button" class="doc-add" data-docadditem="${bi}">${icon('plus', 'sm')}Thêm quy tắc</button>`}</div>`;
      case 'code': return `<div class="doc-b doc-code">${del(bi)}<div class="doc-cap">Mẫu / đoạn mã${b.lang ? ` (${esc(b.lang)})` : ''}</div><textarea class="ce-code" data-b="${bi}" rows="${Math.min(14, b.text.split('\n').length + 1)}" ${ro ? 'readonly' : ''} spellcheck="false">${esc(b.text)}</textarea></div>`;
      default:
        if (b.kind === 'table') return `<div class="doc-b doc-raw">${tableHTML(b.src)}<div class="doc-cap">Bảng được giữ nguyên khi lưu</div></div>`;
        if (b.kind === 'hr') return '<hr class="doc-hr">';
        return `<div class="doc-b doc-raw"><pre>${esc(b.src)}</pre><div class="doc-cap">Khối này được giữ nguyên khi lưu</div></div>`;
    }
  }).join('');
  return (html || '<div class="muted small" style="padding:6px 2px">Chưa có quy tắc nào.</div>') + (ro ? '' : `
    <div class="doc-addbar">
      <button type="button" data-docnew="rules">${icon('plus', 'sm')}Nhóm quy tắc mới</button>
      <button type="button" data-docnew="para">${icon('plus', 'sm')}Đoạn văn</button>
      <button type="button" data-docnew="heading">${icon('plus', 'sm')}Tiêu đề mục</button>
    </div>`);
}

function docChanged(focus) {
  E.body = serializeDoc(E.blocks);
  const doc = $('#doc');
  if (doc) {
    doc.innerHTML = docHTML(E.blocks, !E.item.editable);
    if (focus) {
      const sel = `.ce[data-b="${focus.bi}"]${focus.ii != null ? `[data-i="${focus.ii}"]` : ':not([data-i])'}`;
      const el = doc.querySelector(sel);
      if (el) {
        el.focus();
        const r = document.createRange(); r.selectNodeContents(el); r.collapse(!focus.start);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }
  updateDirty();
}

function readCe(el) {
  const b = E.blocks[Number(el.dataset.b)];
  if (!b) return;
  const text = domToMd(el).replace(/\n+$/, '');
  if (el.dataset.i != null) b.items[Number(el.dataset.i)].text = text; else b.text = text;
  b.dirty = true;
  E.body = serializeDoc(E.blocks);
  updateDirty();
}

const caretAtStart = el => { const s = window.getSelection(); if (!s.rangeCount) return false; const r = s.getRangeAt(0).cloneRange(); r.selectNodeContents(el); r.setEnd(s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset); return r.toString().length === 0; };

$('#drawer').addEventListener('input', e => {
  if (!E) return;
  if (e.target.classList?.contains('ce')) readCe(e.target);
  else if (e.target.classList?.contains('ce-code')) { const b = E.blocks[Number(e.target.dataset.b)]; b.text = e.target.value; b.dirty = true; E.body = serializeDoc(E.blocks); updateDirty(); }
});
$('#drawer').addEventListener('paste', e => {
  if (!e.target.closest?.('.ce')) return;
  e.preventDefault();
  document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
});
$('#drawer').addEventListener('keydown', e => {
  const el = e.target.closest?.('.ce');
  if (!el || !E) return;
  const bi = Number(el.dataset.b), b = E.blocks[bi];
  if (el.dataset.i != null) {
    const ii = Number(el.dataset.i);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); readCe(el);
      b.items.splice(ii + 1, 0, { text: '', indent: b.items[ii].indent || 0, marker: b.items[ii].marker });
      b.dirty = true; return docChanged({ bi, ii: ii + 1 });
    }
    if (e.key === 'Backspace' && !el.textContent.trim() && caretAtStart(el)) {
      e.preventDefault();
      b.items.splice(ii, 1); b.dirty = true;
      if (b.items.length) return docChanged({ bi, ii: Math.max(0, ii - 1) });
      E.blocks.splice(bi, 1); return docChanged();
    }
  } else if (b && b.type === 'heading' && e.key === 'Enter') { e.preventDefault(); el.blur(); }
});
$('#drawer').addEventListener('click', e => {
  if (!E) return;
  const t = e.target;
  const d = t.closest('[data-docdel]');
  if (d) {
    const bi = Number(d.dataset.docdel), b = E.blocks[bi];
    if (d.dataset.i != null) { b.items.splice(Number(d.dataset.i), 1); b.dirty = true; if (!b.items.length) E.blocks.splice(bi, 1); }
    else E.blocks.splice(bi, 1);
    return docChanged();
  }
  const ai = t.closest('[data-docadditem]');
  if (ai) { const bi = Number(ai.dataset.docadditem), b = E.blocks[bi]; b.items.push({ text: '', indent: 0 }); b.dirty = true; return docChanged({ bi, ii: b.items.length - 1 }); }
  const nw = t.closest('[data-docnew]');
  if (nw) {
    const kind = nw.dataset.docnew;
    if (kind === 'rules') {
      E.blocks.push({ type: 'heading', level: 2, text: 'Nhóm quy tắc mới', blank: 1, dirty: true });
      E.blocks.push({ type: 'list', ordered: false, items: [{ text: '', indent: 0 }], blank: 1, dirty: true });
      return docChanged({ bi: E.blocks.length - 1, ii: 0 });
    }
    E.blocks.push(kind === 'heading' ? { type: 'heading', level: 2, text: '', blank: 1, dirty: true } : { type: 'para', text: '', blank: 1, dirty: true });
    return docChanged({ bi: E.blocks.length - 1 });
  }
});

// ================================================================== file reader
// Output files (reports, plans…) shown rendered, like a document, in the side drawer.
let R = null;
async function openReader(sessionId, filePath) {
  if (E || N) await closeEditor();
  if (E) return;
  try {
    const f = await api(`/api/sessions/${encodeURIComponent(sessionId)}/file?path=${encodeURIComponent(filePath)}`);
    R = { sessionId, ...f };
    const s = S.sessions.get(sessionId);
    const isMd = /\.(md|markdown)$/i.test(f.name);
    const text = isMd ? f.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') : f.text;
    $('#drawer-panel').innerHTML = `
      <div class="d-head">
        <div class="item-ico" style="width:38px;height:38px">${icon('file', 'lg')}</div>
        <div style="flex:1;min-width:0">
          <div class="h1" style="font-size:18px">${esc(f.name)}</div>
          <div class="small muted" style="margin-top:4px">${esc(s?.project || '')} · sửa lần cuối ${new Date(f.mtime).toLocaleString('vi-VN')}</div>
        </div>
        <button class="btn ghost sm" data-ract="copy" title="Chép nội dung">${icon('copy', 'sm')}Chép</button>
        <button class="btn ghost" data-ract="close" title="Đóng (Esc)">${icon('close')}</button>
      </div>
      <div class="d-body">${isMd ? `<div class="doc reader">${docHTML(parseDoc(text), true)}</div>` : `<pre class="reader-pre">${esc(text)}</pre>`}</div>`;
    $('#drawer').classList.remove('ndv');
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
  } catch (err) { toast(err.message, 'error'); }
}
function closeReader() {
  R = null;
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
}
$('#drawer').addEventListener('click', async e => {
  if (!R) return;
  const a = e.target.closest('[data-ract]')?.dataset.ract;
  if (e.target === $('#drawer') || a === 'close') return closeReader();
  if (a === 'copy') { try { await navigator.clipboard.writeText(R.text); toast('Đã chép nội dung.'); } catch { toast('Không chép được, hãy bôi đen rồi chép.', 'error'); } }
  const link = e.target.closest('.doc a[data-href]');
  if (link) { const href = link.dataset.href; if (/^https?:\/\//.test(href)) window.open(href, '_blank', 'noopener'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && R && $('#modal').hidden) closeReader(); });

// ================================================================== editor drawer
// Model, "when to use" and the instructions, edited as a normal document. No Markdown, no tool lists.
let E = null;

const anyDirty = () => E && (E.model !== E.item.model || E.description !== E.item.description || E.body !== E.item.body);

async function closeEditor(force) {
  if (!E && !N) return;
  if (!force && anyDirty()) {
    const ok = await modal({ title: 'Bỏ các thay đổi chưa lưu?', text: 'Nếu đóng bây giờ, những gì bạn vừa sửa sẽ mất.', okText: 'Bỏ thay đổi', okClass: 'danger-solid', cancelText: 'Tiếp tục sửa' });
    if (!ok) return;
  }
  E = null; N = null; S.openNode = null;
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  if (S.tab === 'live') scheduleLive();
}

function renderEditorTab() {
  const box = $('#etab');
  const it = E.item;
  const ro = !it.editable;
  if (E.tab === 'basic') {
    const models = MODELS.filter(m => !m.agentOnly || it.kind === 'agent');
    if (E.model && !models.some(m => m.v === E.model)) models.push({ v: E.model, n: E.model, d: 'Giá trị đang có trong file' });
    box.innerHTML = `
      <fieldset ${ro ? 'disabled' : ''} style="border:0;padding:0;margin:0">
      <div class="field">
        <div class="flabel">Model</div>
        <div class="help">Model mạnh hơn làm tốt hơn, nhưng chậm và tốn chi phí hơn.</div>
        <div class="models">${models.map(m => `<button type="button" class="model ${E.model === m.v ? 'on' : ''}" data-model="${esc(m.v)}"><div class="n">${esc(m.n)}</div><div class="d">${esc(m.d)}</div></button>`).join('')}</div>
      </div>
      <div class="field">
        <label for="e-desc">Khi nào dùng ${it.kind === 'agent' ? 'agent' : 'skill'} này?</label>
        <div class="help">AI đọc mô tả này để quyết định khi nào ${it.kind === 'agent' ? 'giao việc cho agent' : 'dùng skill'}. Viết rõ loại việc phù hợp.</div>
        <textarea id="e-desc" rows="3">${esc(E.description)}</textarea>
      </div>
      <div class="field">
        <div class="flabel">Hướng dẫn</div>
        <div class="help">“Bản mô tả công việc” mà ${it.kind === 'agent' ? 'agent' : 'AI'} đọc mỗi lần làm việc. ${ro ? '' : '<b>Bấm vào chữ để sửa trực tiếp.</b> Ở một quy tắc: Enter để thêm quy tắc mới, xoá hết chữ rồi bấm Xoá lùi để bỏ quy tắc.'}</div>
        ${ro ? '' : `<div class="quickrule"><input type="text" class="input" id="e-quick" placeholder="Thêm nhanh một quy tắc, ví dụ: Luôn trả lời bằng tiếng Việt"><button type="button" class="btn" data-eact="quick">${icon('plus', 'sm')}Thêm</button></div>`}
        <div id="doc" class="doc">${docHTML(E.blocks, ro)}</div>
      </div>
      </fieldset>`;
  } else {
    box.innerHTML = '<div class="muted">Đang tải lịch sử…</div>';
    api(`/api/items/${it.id}/history`).then(({ history }) => {
      if (E?.tab !== 'history') return;
      box.innerHTML = history.length ? `<div class="help muted small" style="margin-bottom:10px">Mỗi dòng là bản <b>trước khi</b> sửa. Bấm “Khôi phục” để quay lại bản đó.</div>` + history.map(h => `
        <div class="hist"><div style="flex:1"><div><b>${new Date(h.ts).toLocaleString('vi-VN')}</b></div><div class="small muted">${esc(h.note || '')}</div></div>
        <button class="btn sm" data-view="${h.ts}">${icon('eye', 'sm')}Xem</button>
        ${it.editable ? `<button class="btn sm" data-restore="${h.ts}">${icon('history', 'sm')}Khôi phục</button>` : ''}</div>`).join('')
        : `<div class="empty"><div class="ico">${icon('history', 'lg')}</div><div class="title">Chưa có lịch sử</div><div>Mỗi lần bạn lưu, bản cũ sẽ được giữ ở đây.</div></div>`;
    }).catch(e => { box.innerHTML = `<div class="callout bad">${esc(e.message)}</div>`; });
  }
  updateDirty();
}

function updateDirty() {
  const el = $('#dirty');
  if (!el || !E) return;
  el.innerHTML = anyDirty() ? '<span class="chip warn">Có thay đổi chưa lưu</span>' : (E.item.editable ? 'Chưa có thay đổi' : '');
}

// Shows a saved version as a readable document instead of raw Markdown.
function versionHTML(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  const body = m ? m[2] : raw;
  const model = m && (/^model:\s*(.+)$/m.exec(m[1]) || [])[1];
  return `<div class="doc" style="max-height:55vh">${model ? `<div class="small muted" style="margin-bottom:8px">Model: <b>${esc(modelName(model.trim().replace(/^["']|["']$/g, '')))}</b></div>` : ''}${docHTML(parseDoc(body), true)}</div>`;
}

$('#drawer').addEventListener('click', async e => {
  if (e.target === $('#drawer')) return closeEditor();
  if (!E) return;
  const t = e.target;
  const tab = t.closest('[data-etab]');
  if (tab) { E.tab = tab.dataset.etab; $$('[data-etab]').forEach(b => b.classList.toggle('on', b === tab)); return renderEditorTab(); }
  const mb = t.closest('[data-model]');
  if (mb && !mb.disabled) { E.model = mb.dataset.model; $$('[data-model]').forEach(b => b.classList.toggle('on', b === mb)); return updateDirty(); }
  const view = t.closest('[data-view]');
  if (view) {
    const { raw } = await api(`/api/items/${E.item.id}/version?ts=${view.dataset.view}`);
    return modal({ title: `Bản lúc ${new Date(Number(view.dataset.view)).toLocaleString('vi-VN')}`, html: versionHTML(raw), okText: 'Đóng', cancelText: '' });
  }
  const rs = t.closest('[data-restore]');
  if (rs) {
    const ok = await modal({ title: 'Khôi phục bản này?', text: 'Nội dung hiện tại sẽ được thay bằng bản đã chọn. Bản hiện tại vẫn được giữ trong lịch sử.', okText: 'Khôi phục' });
    if (!ok) return;
    try { await api(`/api/items/${E.item.id}/restore`, { ts: rs.dataset.restore }); toast('Đã khôi phục.'); await loadItems(true); return openNdv(N, E.item.id, true); } catch (err) { return toast(err.message, 'error'); }
  }
  const act = t.closest('[data-eact]')?.dataset.eact;
  if (act === 'close') return closeEditor();
  if (act === 'revert') return openNdv(N, E.item.id, true);
  if (act === 'quick') {
    const inp = $('#e-quick');
    const rule = inp.value.trim();
    if (!rule) return inp.focus();
    let hi = E.blocks.findIndex(x => x.type === 'heading' && x.text.trim() === 'Quy tắc bổ sung');
    if (hi < 0) { E.blocks.push({ type: 'heading', level: 2, text: 'Quy tắc bổ sung', blank: 1, dirty: true }); hi = E.blocks.length - 1; }
    const li = hi + 1;
    if (!E.blocks[li] || E.blocks[li].type !== 'list') E.blocks.splice(li, 0, { type: 'list', ordered: false, items: [], blank: 1, dirty: true });
    E.blocks[li].items.push({ text: rule, indent: 0 });
    E.blocks[li].dirty = true;
    docChanged({ bi: li, ii: E.blocks[li].items.length - 1 });
    inp.value = '';
    toast('Đã thêm quy tắc. Nhớ bấm “Lưu”.');
    return updateDirty();
  }
  if (act === 'copy') return copyItem(E.item.id);
  if (act === 'save') return saveEditor();
});
$('#drawer').addEventListener('input', e => {
  if (!E) return;
  if (e.target.id === 'e-desc') { E.description = e.target.value; updateDirty(); }
});
$('#drawer').addEventListener('keydown', e => {
  if (e.target.id === 'e-quick' && e.key === 'Enter') { e.preventDefault(); $('[data-eact="quick"]').click(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveEditor(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (E || N) && !R && $('#modal').hidden) closeEditor(); });

async function saveEditor() {
  if (!E || !E.item.editable) return;
  if (!anyDirty()) return toast('Chưa có gì thay đổi.');
  const changes = { model: E.model, description: E.description, body: E.body };
  try {
    const out = await api(`/api/items/${E.item.id}`, { changes, mtime: E.item.mtime });
    toast(out.changed ? 'Đã lưu. Áp dụng từ lần chạy tiếp theo.' : 'Không có gì thay đổi.');
    const tab = E.tab;
    E = { item: out.item, tab, model: out.item.model, description: out.item.description, body: out.item.body, blocks: parseDoc(out.item.body) };
    renderNdv();
    await loadItems(true);
    if (S.tab === 'team') renderTeam(); else scheduleLive();
  } catch (err) { toast(err.message, 'error'); }
}

// ================================================================== settings
function renderSettings() {
  const root = $('#view-settings');
  const c = S.config;
  const h = S.hooks;
  root.innerHTML = `<div class="settings">
    <h1 class="h1">Cài đặt</h1>
    <div class="card">
      <div class="h3">Kết nối với Claude Code</div>
      ${h.connected ? `
        <div class="callout ok" style="margin:12px 0">${icon('check', 'sm')}<div><b>Đã kết nối.</b> Mỗi lần bạn giao việc cho Claude Code, các bước sẽ tự hiện trong tab “Hoạt động”. Bảng điều khiển chỉ xem, không can thiệp vào việc AI đang làm.</div></div>
        <button class="btn danger" data-cact="uninstall">Ngắt kết nối</button>` : `
        <p class="muted" style="margin:6px 0 14px">Claude Code sẽ báo từng bước làm việc về bảng điều khiển. Bảng điều khiển thêm vài dòng vào file cài đặt của Claude Code và tự sao lưu bản cũ. Khi bảng điều khiển tắt, Claude Code vẫn chạy bình thường.</p>
        ${h.error ? `<div class="callout bad" style="margin-bottom:12px">${esc(h.error)}</div>` : ''}
        <button class="btn primary lg" data-cact="install">${icon('plug', 'sm')}Kết nối với Claude Code</button>`}
    </div>
    ${alertsCardHTML()}
    ${autostartCardHTML()}
    <div class="card">
      <div class="h3">Model của agent chính</div>
      <div class="muted small" style="margin-bottom:12px">Model Claude Code dùng khi bạn mở phiên mới. Agent đặt “Giống agent chính” cũng dùng model này.</div>
      <select class="select" id="main-model">${[['', 'Mặc định của Claude Code'], ['opus', 'Opus · thông minh nhất'], ['sonnet', 'Sonnet · cân bằng'], ['haiku', 'Haiku · nhanh, tiết kiệm'], ['fable', 'Fable'], ['opusplan', 'Opus khi lập kế hoạch, Sonnet khi làm']]
        .map(([v, l]) => `<option value="${v}" ${S.mainModel === v ? 'selected' : ''}>${l}</option>`).join('')}
        ${S.mainModel && !['opus', 'sonnet', 'haiku', 'fable', 'opusplan'].includes(S.mainModel) ? `<option selected value="${esc(S.mainModel)}">${esc(S.mainModel)}</option>` : ''}</select>
    </div>
    <div class="card">
      <div class="h3">Thư mục dự án</div>
      <div class="muted small" style="margin-bottom:12px">Bảng điều khiển tự tìm agent và skill trong các dự án bạn đã mở Claude Code. Muốn thêm dự án khác thì ${S.autostart.supported ? 'bấm “Chọn thư mục…”' : 'dán đường dẫn thư mục vào đây'}.</div>
      ${(c.extraProjects || []).map((p, i) => `<div class="list-line"><span style="flex:1">${esc(p)}</span><button class="btn ghost sm" data-rmproj="${i}">Xoá</button></div>`).join('')}
      ${S.autostart.supported ? `<button class="btn" data-cact="pickproj">${icon('folder', 'sm')}Chọn thư mục…</button>
      <details class="alt"><summary>Hoặc dán đường dẫn thư mục</summary>${projInput()}</details>` : projInput()}
    </div>
  </div>`;
}
const projInput = () => `<div class="row"><input type="text" id="proj" class="input" style="flex:1" placeholder="/Users/ban/du-an-cua-toi"><button class="btn" data-cact="addproj">${icon('plus', 'sm')}Thêm</button></div>`;

function alertsCardHTML() {
  const p = prefs();
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const state = perm === 'granted'
    ? `<div class="callout ok" style="margin:10px 0">${icon('check', 'sm')}<div>Thông báo đã bật. Khi bạn đang ở cửa sổ khác, máy sẽ hiện thông báo ở góc màn hình.</div></div>`
    : perm === 'denied'
      ? `<div class="callout warn" style="margin:10px 0">${icon('alert', 'sm')}<div>Trình duyệt đang chặn thông báo của trang này. Bấm biểu tượng ổ khoá (hoặc biểu tượng cài đặt) cạnh địa chỉ <b>127.0.0.1:4319</b> trên thanh địa chỉ, chọn <b>Thông báo: Cho phép</b>, rồi tải lại trang. Trong lúc đó vẫn có tiếng chuông và tiêu đề tab đổi thành 🔔.</div></div>`
      : perm === 'unsupported' ? '<div class="small muted" style="margin:10px 0">Trình duyệt này không hỗ trợ thông báo. Vẫn có tiếng chuông và tiêu đề tab đổi thành 🔔.</div>'
        : `<div style="margin:10px 0"><button class="btn primary" data-cact="notify-on">🔔 Bật thông báo</button></div>`;
  const opt = (k, label) => `<label class="toggle"><input type="checkbox" data-pref="${k}" ${p[k] ? 'checked' : ''}><span>${label}</span></label>`;
  return `<div class="card">
      <div class="h3">Báo cho bạn</div>
      <div class="muted small">Bạn thường ở cửa sổ Claude Code chứ không nhìn trang này, nên trang sẽ báo khi có việc cần bạn. Tiêu đề tab cũng đổi thành 🔔 khi Claude đang chờ.</div>
      ${state}
      <div class="opt-list">
        ${opt('wait', 'Khi Claude <b>đang chờ bạn</b> trả lời hoặc cho phép')}
        ${opt('done', 'Khi Claude <b>làm xong</b> việc bạn giao')}
        ${opt('sound', 'Phát tiếng chuông')}
      </div>
      <button class="btn sm" data-cact="notify-test">Thử báo</button>
    </div>`;
}

function autostartCardHTML() {
  const a = S.autostart;
  if (!a.supported) return '';
  const body = a.enabled && a.background
    ? `<div class="callout ok" style="margin:10px 0">${icon('check', 'sm')}<div><b>Đang chạy nền.</b> Bảng điều khiển tự mở mỗi khi bạn bật máy, không cần cửa sổ Terminal. Muốn xem thì bấm đúp <b>start.command</b> hoặc mở <b>127.0.0.1:4319</b>.</div></div>
       <div class="row"><button class="btn" data-cact="autostart-off">Tắt tự mở khi bật máy</button><button class="btn danger" data-cact="shutdown">Tắt bảng điều khiển ngay</button></div>`
    : a.enabled
      ? `<div class="callout ok" style="margin:10px 0">${icon('check', 'sm')}<div>Đã bật. Từ lần bật máy sau, bảng điều khiển sẽ tự chạy nền.</div></div>
         <button class="btn" data-cact="autostart-off">Tắt tự mở khi bật máy</button>`
      : `<p class="muted small" style="margin:6px 0 14px">Hiện bạn phải bấm đúp <b>start.command</b> và giữ cửa sổ Terminal mở. Bật tuỳ chọn này thì bảng điều khiển chạy nền và tự mở khi bật máy, không còn cửa sổ Terminal nào cả. Tắt lại bất cứ lúc nào.</p>
         <button class="btn primary" data-cact="autostart-on">Bật tự mở khi bật máy</button>`;
  return `<div class="card"><div class="h3">Tự mở khi bật máy</div>${body}</div>`;
}

$('#view-settings').addEventListener('click', async e => {
  const t = e.target;
  try {
    const rm = t.closest('[data-rmproj]');
    if (rm) { const list = (S.config.extraProjects || []).filter((_, i) => i !== Number(rm.dataset.rmproj)); const { config } = await api('/api/config', { extraProjects: list }); S.config = config; S.items = null; return renderSettings(); }
    const act = t.closest('[data-cact]')?.dataset.cact;
    if (act === 'install' || act === 'uninstall') return hooksAction(act);
    if (act === 'notify-on') { const r = await askNotifyPermission(); renderSettings(); renderConn(); if (r === 'granted') toast('Đã bật thông báo.'); return; }
    if (act === 'notify-test') {
      wakeAudio();
      if (prefs().sound) setTimeout(() => chime('wait'), 50);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('🔔 Claude đang chờ bạn', { body: 'Đây là thông báo thử. Bạn sẽ thấy thế này khi Claude cần bạn.' });
      else toast('Chưa bật thông báo của trình duyệt, nên chỉ có tiếng chuông.');
      return;
    }
    if (act === 'pickproj') {
      t.closest('button').disabled = true;
      toast('Đang mở cửa sổ chọn thư mục…');
      try {
        const r = await api('/api/pick-folder', {});
        if (r.cancelled || !r.path) return;
        if ((S.config.extraProjects || []).includes(r.path)) return toast('Thư mục này đã có trong danh sách.');
        const { config } = await api('/api/config', { extraProjects: [...(S.config.extraProjects || []), r.path] });
        S.config = config; S.items = null; S.projects = [...new Set([...S.projects, r.path])];
        toast(`Đã thêm dự án “${base(r.path)}”.`);
      } finally { renderSettings(); }
      return;
    }
    if (act === 'autostart-on') {
      const r = await api('/api/autostart', { enabled: true });
      S.autostart = r;
      if (r.handOver) {
        toast('Đã bật. Bảng điều khiển đang chuyển sang chạy nền, trang sẽ tự kết nối lại sau vài giây. Giờ bạn có thể đóng cửa sổ Terminal.');
      } else toast('Đã bật tự mở khi bật máy.');
      return renderSettings();
    }
    if (act === 'autostart-off') {
      const ok = await modal({ title: 'Tắt tự mở khi bật máy?', text: 'Từ lần bật máy sau, bạn cần bấm đúp start.command để mở bảng điều khiển. Lần này nó vẫn chạy tới khi bạn tắt máy.', okText: 'Tắt tự mở' });
      if (!ok) return;
      S.autostart = await api('/api/autostart', { enabled: false });
      toast('Đã tắt tự mở khi bật máy.');
      return renderSettings();
    }
    if (act === 'shutdown') {
      const ok = await modal({ title: 'Tắt bảng điều khiển?', text: 'Claude Code vẫn chạy bình thường. Muốn mở lại thì bấm đúp start.command. Lần bật máy sau nó cũng tự mở lại.', okText: 'Tắt', okClass: 'danger-solid' });
      if (!ok) return;
      await api('/api/shutdown', {});
      toast('Đã tắt bảng điều khiển.');
      return;
    }
    if (act === 'addproj') {
      const v = $('#proj').value.trim();
      if (!v) return;
      const { config } = await api('/api/config', { extraProjects: [...(S.config.extraProjects || []), v] });
      if (!config.extraProjects.includes(v)) return toast('Không tìm thấy thư mục này trên máy.', 'error');
      S.config = config; S.items = null; renderSettings(); toast('Đã thêm dự án.');
    }
  } catch (err) { toast(err.message, 'error'); }
});
$('#view-settings').addEventListener('change', async e => {
  if (e.target.dataset.pref) { setPref(e.target.dataset.pref, e.target.checked); return; }
  try {
    if (e.target.id === 'main-model') { const { mainModel } = await api('/api/main-model', { model: e.target.value }); S.mainModel = mainModel; toast('Đã đổi model cho các phiên mới.'); }
  } catch (err) { toast(err.message, 'error'); }
});

async function hooksAction(act) {
  if (act === 'uninstall') {
    const ok = await modal({ title: 'Ngắt kết nối với Claude Code?', text: 'Bảng điều khiển sẽ không còn thấy các bước mới. Có thể kết nối lại bất cứ lúc nào.', okText: 'Ngắt kết nối', okClass: 'danger-solid' });
    if (!ok) return;
  }
  if (act === 'install') askNotifyPermission().then(() => { renderConn(); if (S.tab === 'settings') renderSettings(); });
  try {
    S.hooks = await api(`/api/hooks/${act}`, {});
    toast(act === 'install' ? 'Đã kết nối. Mở một cửa sổ Claude Code mới và giao việc để xem các bước.' : 'Đã ngắt kết nối.');
    renderAll();
  } catch (err) { toast(err.message, 'error'); }
}

// ================================================================== create a new agent / skill (no file to write by hand)
const TEMPLATES = [
  { k: 'blank', n: 'Trống', name: '', desc: '', body: '## Nhiệm vụ\nMô tả việc cần làm ở đây.\n\n## Quy tắc\n- Luôn trả lời bằng tiếng Việt\n' },
  { k: 'translate', n: 'Dịch thuật', name: 'Dịch thuật', desc: 'Dùng khi cần dịch văn bản, tài liệu hoặc tin nhắn giữa tiếng Việt và tiếng Anh, giữ đúng giọng văn và thuật ngữ.',
    body: '## Nhiệm vụ\nDịch nội dung được giao sang ngôn ngữ đích, tự nhiên như người bản xứ viết.\n\n## Quy tắc\n- Giữ nguyên tên riêng, tên sản phẩm và thuật ngữ chuyên ngành\n- Giữ nguyên định dạng: tiêu đề, gạch đầu dòng, bảng\n- Nếu một câu có thể hiểu theo nhiều nghĩa, ghi chú ngắn ở cuối bản dịch\n- Không thêm hoặc bớt ý so với bản gốc\n' },
  { k: 'email', n: 'Viết email', name: 'Viết email', desc: 'Dùng khi cần soạn hoặc sửa email công việc: gửi khách hàng, đối tác, sếp hoặc đồng nghiệp.',
    body: '## Nhiệm vụ\nSoạn email rõ ràng, lịch sự, đúng mục đích người dùng đưa ra.\n\n## Quy tắc\n- Dòng tiêu đề ngắn, nói rõ việc chính\n- Câu đầu tiên nói ngay mục đích email\n- Mỗi đoạn tối đa 3 câu\n- Kết thúc bằng việc cần người nhận làm và hạn chót (nếu có)\n- Đưa ra 2 phiên bản: trang trọng và thân thiện\n' },
  { k: 'summary', n: 'Tóm tắt tài liệu', name: 'Tóm tắt tài liệu', desc: 'Dùng khi cần tóm tắt tài liệu dài, báo cáo, biên bản họp hoặc bài viết thành vài ý chính.',
    body: '## Nhiệm vụ\nĐọc tài liệu được giao và tóm tắt thành các ý chính dễ đọc.\n\n## Quy tắc\n- Mở đầu bằng 1 câu nói tài liệu này về việc gì\n- Tối đa 5 ý chính, mỗi ý một dòng\n- Liệt kê riêng các con số, mốc thời gian và việc cần làm\n- Không suy diễn những gì tài liệu không nói\n' },
  { k: 'proofread', n: 'Soát lỗi văn bản', name: 'Soát lỗi văn bản', desc: 'Dùng khi cần kiểm tra chính tả, ngữ pháp và cách diễn đạt của một văn bản trước khi gửi đi.',
    body: '## Nhiệm vụ\nTìm và sửa lỗi chính tả, ngữ pháp, dấu câu và câu khó hiểu.\n\n## Quy tắc\n- Chỉ sửa chỗ sai, không viết lại cả bài\n- Liệt kê từng chỗ đã sửa: bản cũ → bản mới, kèm lý do ngắn\n- Giữ nguyên giọng văn của người viết\n' },
  { k: 'report', n: 'Báo cáo tuần', name: 'Báo cáo tuần', desc: 'Dùng khi cần viết báo cáo công việc hằng tuần từ ghi chú, danh sách việc hoặc tin nhắn.',
    body: '## Nhiệm vụ\nGom thông tin người dùng đưa ra thành báo cáo tuần gọn gàng.\n\n## Cấu trúc báo cáo\n- Đã xong tuần này\n- Đang làm và tiến độ\n- Vướng mắc, cần hỗ trợ\n- Kế hoạch tuần tới\n\n## Quy tắc\n- Mỗi mục tối đa 5 dòng\n- Ghi rõ con số khi có\n' },
];
// Must match slugify() in lib/items.js: this is the name Claude Code uses to call it.
const slugify = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');

function newItemDialog(kind = 'agent') {
  const F = { kind, tpl: 'blank', name: '', description: '', project: '' };
  const m = $('#modal');
  const kindHelp = k => (k === 'agent'
    ? '<b>Agent</b> là một “nhân viên” chuyên một việc. Agent chính sẽ giao việc cho nó khi gặp đúng loại việc.'
    : '<b>Skill</b> là một “quy trình mẫu”. AI tự làm theo quy trình này khi gặp đúng loại việc.');
  const draw = () => {
    const slug = slugify(F.name);
    m.innerHTML = `<div class="modal-box wide" role="dialog">
      <h3>Tạo mới</h3>
      <div class="field" style="margin-top:12px">
        <div class="seg" data-nf-kind>${[['agent', 'Agent'], ['skill', 'Skill']].map(([v, l]) => `<button type="button" data-v="${v}" class="${F.kind === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="help" style="margin-top:8px">${kindHelp(F.kind)}</div>
      </div>
      <div class="field">
        <div class="flabel">Bắt đầu từ mẫu</div>
        <div class="help">Chọn mẫu gần nhất với việc bạn cần, sau đó sửa lại cho hợp.</div>
        <div class="tpls">${TEMPLATES.map(t => `<button type="button" class="tpl ${F.tpl === t.k ? 'on' : ''}" data-tpl="${t.k}">${esc(t.n)}</button>`).join('')}</div>
      </div>
      <div class="field">
        <label for="nf-name">Tên</label>
        <input type="text" id="nf-name" class="input" placeholder="Ví dụ: Dịch hợp đồng" value="${esc(F.name)}">
        <div class="slug" id="nf-slug">${slug ? `Tên Claude Code dùng để gọi: <code>${esc(slug)}</code>` : 'Viết bằng tiếng Việt có dấu cũng được.'}</div>
      </div>
      <div class="field">
        <label for="nf-desc">Khi nào dùng?</label>
        <div class="help">AI đọc câu này để quyết định lúc nào ${F.kind === 'agent' ? 'giao việc cho agent' : 'dùng skill'}. Viết rõ loại việc, ví dụ: “Dùng khi cần dịch hợp đồng tiếng Anh”.</div>
        <textarea id="nf-desc" rows="3">${esc(F.description)}</textarea>
      </div>
      <div class="field">
        <label for="nf-where">Dùng ở đâu?</label>
        <select id="nf-where" class="select" style="width:100%">
          <option value="">Mọi dự án (chỉ trên máy của bạn)</option>
          ${S.projects.map(d => `<option value="${esc(d)}" ${F.project === d ? 'selected' : ''}>Chỉ dự án “${esc(base(d))}”</option>`).join('')}
        </select>
      </div>
      <div class="form-err" id="nf-err" hidden></div>
      <div class="modal-actions">
        <button class="btn" data-a="cancel">Huỷ</button>
        <button class="btn primary" data-a="ok">${icon('plus', 'sm')}Tạo và mở để chỉnh</button>
      </div></div>`;
  };
  const read = () => { F.name = $('#nf-name').value; F.description = $('#nf-desc').value; F.project = $('#nf-where').value; };
  const close = () => { m.hidden = true; m.innerHTML = ''; m.onclick = m.oninput = null; document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  draw();
  m.hidden = false;
  document.addEventListener('keydown', onKey, true);
  setTimeout(() => $('#nf-name')?.focus(), 0);
  m.oninput = e => {
    if (e.target.id !== 'nf-name') return;
    const slug = slugify(e.target.value);
    $('#nf-slug').innerHTML = slug ? `Tên Claude Code dùng để gọi: <code>${esc(slug)}</code>` : 'Viết bằng tiếng Việt có dấu cũng được.';
  };
  m.onclick = async e => {
    const t = e.target;
    if (t === m || t.closest('[data-a="cancel"]')) return close();
    const k = t.closest('[data-nf-kind] button');
    if (k) { read(); F.kind = k.dataset.v; return draw(); }
    const tp = t.closest('[data-tpl]');
    if (tp) {
      read();
      const old = TEMPLATES.find(x => x.k === F.tpl), nt = TEMPLATES.find(x => x.k === tp.dataset.tpl);
      if (!F.name.trim() || F.name === old.name) F.name = nt.name; // only fill what you haven't typed yourself
      if (!F.description.trim() || F.description === old.desc) F.description = nt.desc;
      F.tpl = nt.k;
      return draw();
    }
    if (!t.closest('[data-a="ok"]')) return;
    read();
    const err = $('#nf-err'), btn = t.closest('button');
    btn.disabled = true;
    try {
      const tpl = TEMPLATES.find(x => x.k === F.tpl);
      const { id } = await api('/api/items/new', { kind: F.kind, name: F.name, description: F.description, project: F.project, body: tpl.body });
      close();
      await loadItems(true);
      if (S.tab === 'team') renderTeam();
      toast(`Đã tạo ${F.kind === 'agent' ? 'agent' : 'skill'}. Sửa hướng dẫn cho hợp rồi bấm “Lưu”. Mở phiên Claude Code mới để dùng.`);
      openEditor(id);
    } catch (ex) { err.hidden = false; err.textContent = ex.message; btn.disabled = false; }
  };
}
document.addEventListener('click', e => { const b = e.target.closest('[data-newitem]'); if (b) { e.preventDefault(); newItemDialog(b.dataset.newitem); } });

// ================================================================== wiring
$$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('#conn').addEventListener('click', () => setTab('settings'));
$('#notif-ask').addEventListener('click', async () => {
  const r = await askNotifyPermission();
  if (r === 'denied') localStorage.setItem('notifAskDismissed', '1');
  renderConn();
  if (S.tab === 'settings') renderSettings();
  if (r === 'granted') toast('Đã bật thông báo. Bạn sẽ được báo khi Claude chờ bạn hoặc làm xong.');
});
document.addEventListener('click', e => { if (e.target.closest('[data-global="install"]')) hooksAction('install'); });
// Keep durations ticking while something runs; otherwise refresh the "x minutes ago" labels now and then.
setInterval(() => { if (S.tab === 'live' && [...S.sessions.values()].some(s => effStatus(s) === 'working')) scheduleLive(); }, 5000);
setInterval(() => { if (S.tab === 'live') scheduleLive(); }, 60000);
setInterval(updateTitle, 30000); // a session that went quiet turns stale

renderAll();
connect();
