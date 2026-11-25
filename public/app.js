'use strict';
/* Bảng điều khiển Agent — giao diện (không dùng thư viện ngoài) */

// ================================================================== helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const base = p => (p ? String(p).split('/').filter(Boolean).pop() : '');

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

function modal({ title, text = '', input = null, okText = 'Đồng ý', okClass = 'primary', cancelText = 'Huỷ', html = '' }) {
  return new Promise(resolve => {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-box" role="dialog">
      <h3>${esc(title)}</h3>
      ${text ? `<div class="muted">${esc(text)}</div>` : ''}
      ${html}
      ${input ? `<textarea id="modal-input" placeholder="${esc(input.placeholder || '')}">${esc(input.value || '')}</textarea>` : '<div style="height:16px"></div>'}
      <div class="modal-actions">
        ${cancelText ? `<button class="btn" data-a="cancel">${esc(cancelText)}</button>` : ''}
        <button class="btn ${okClass}" data-a="ok">${esc(okText)}</button>
      </div></div>`;
    m.hidden = false;
    const ta = $('#modal-input', m);
    if (ta) ta.focus();
    const done = v => { m.hidden = true; m.innerHTML = ''; document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', onKey, true);
    m.onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'ok') done(input ? ta.value : true);
      else if (a === 'cancel' || e.target === m) done(null);
    };
  });
}

const pad = n => String(n).padStart(2, '0');
const fmtTime = ts => { if (!ts) return ''; const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const fmtHM = ts => { if (!ts) return ''; const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function timeAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 30) return 'vừa xong';
  if (s < 3600) return `${Math.round(s / 60) || 1} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

// ================================================================== icons
const ICONS = {
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/>',
  filePlus: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1.5M15 13v1.5"/>',
  zap: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  list: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 17h.01"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  ret: '<path d="M20 5v6a4 4 0 0 1-4 4H5"/><path d="M9 11l-4 4 4 4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  wrench: '<path d="M15 4a5 5 0 0 0-4.6 6.9L4 17.3V20h2.7l6.4-6.4A5 5 0 0 0 20 9l-3 1-2-2 1-3z"/>',
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
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.7-2.3L3.5 15.5a1.5 1.5 0 0 1 2.3-2L8 15.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.wrench}</svg>`;

function toolIcon(tool) {
  if (!tool) return 'wrench';
  if (tool === 'Read') return 'file';
  if (tool === 'Write') return 'filePlus';
  if (['Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) return 'edit';
  if (['Bash', 'BashOutput', 'KillShell', 'Monitor', 'TaskStop'].includes(tool)) return 'terminal';
  if (['Grep', 'Glob', 'LS', 'ToolSearch'].includes(tool)) return 'search';
  if (tool.startsWith('Web')) return 'globe';
  if (['Agent', 'Task', 'SendMessage', 'Workflow'].includes(tool)) return 'bot';
  if (tool === 'SubagentHandback') return 'ret';
  if (tool === 'Skill') return 'zap';
  if (/^(TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet|EnterPlanMode)$/.test(tool)) return 'list';
  if (tool === 'AskUserQuestion' || tool === 'ExitPlanMode') return 'help';
  if (tool.startsWith('mcp__')) return 'plug';
  return 'wrench';
}
const catOf = st => (st.tool === 'Skill' ? 'skill' : st.category || 'other');
const CAT_VAR = c => `var(--c-${c})`;

// ================================================================== constants
const MODELS = [
  { v: '', n: 'Mặc định', d: 'Để Claude Code tự chọn' },
  { v: 'inherit', n: 'Giống cửa sổ chính', d: 'Cùng model với phiên chính', agentOnly: true },
  { v: 'opus', n: 'Opus', d: 'Thông minh nhất, chậm và tốn hơn' },
  { v: 'sonnet', n: 'Sonnet', d: 'Cân bằng tốc độ và chất lượng' },
  { v: 'haiku', n: 'Haiku', d: 'Nhanh nhất, tiết kiệm nhất' },
  { v: 'fable', n: 'Fable', d: 'Dòng model Fable của Anthropic' },
];
const modelName = v => (MODELS.find(m => m.v === v) || { n: v }).n;
const TOOLS = [
  ['Read', 'Đọc file'], ['Grep', 'Tìm trong mã'], ['Glob', 'Tìm file'], ['Edit', 'Sửa file'],
  ['Write', 'Tạo file mới'], ['Bash', 'Chạy lệnh'], ['WebSearch', 'Tìm trên web'], ['WebFetch', 'Đọc trang web'],
  ['Agent', 'Giao việc cho agent khác'], ['TodoWrite', 'Lập kế hoạch'], ['NotebookEdit', 'Sửa notebook'],
];
const STATUS = {
  working: ['accent', 'Đang chạy', true],
  approval: ['warn', 'Chờ bạn duyệt', true],
  'needs-permission': ['warn', 'Chờ bạn trong Terminal', true],
  waiting: ['warn', 'Đang chờ bạn'],
  done: ['ok', 'Xong lượt'],
  stopped: ['bad', 'Đã dừng'],
  ended: ['muted', 'Đã đóng'],
  idle: ['muted', 'Sẵn sàng'],
  stale: ['muted', 'Không hoạt động'],
  unknown: ['muted', 'Không rõ'],
};
const ACTIVE = new Set(['working', 'approval', 'needs-permission', 'waiting']);
const effStatus = s => (s.status === 'working' && Date.now() - s.updatedAt > 20 * 60e3 ? 'stale' : s.status || 'idle');
function statusTag(st) {
  const [c, label, live] = STATUS[st] || STATUS.unknown;
  return `<span class="st ${c}"><span class="dot ${live ? 'blink' : ''}"></span>${esc(label)}</span>`;
}
const LANE_COLORS = ['#4f46e5', '#0891b2', '#db2777', '#ea580c', '#059669', '#7c3aed', '#ca8a04', '#0284c7'];
const laneColor = (s, key) => LANE_COLORS[Math.max(0, (s.agents || []).findIndex(a => a.key === key)) % LANE_COLORS.length];
const BUILTIN_AGENTS = ['general-purpose', 'Explore', 'Plan', 'statusline-setup', 'claude-code-guide', 'claude', 'fork', 'web-fetch', 'output-style-setup'];
const STEP_STATUS = { running: 'Đang chạy', awaiting: 'Chờ bạn duyệt', done: 'Xong', failed: 'Bị lỗi', denied: 'Không thực hiện', skipped: 'Không thực hiện (bị chặn hoặc huỷ)', unknown: 'Không rõ' };

// ================================================================== state
const S = {
  tab: location.hash.slice(1) || 'live',
  sessions: new Map(),
  approvals: [],
  seenApprovals: new Set(),
  config: {}, hooks: {}, mainModel: '',
  items: null,
  selected: null,
  selNode: null,
  turnOpen: {},
  live: false,
  lastRendered: { session: null, nodes: 0 },
  team: { q: '', kind: 'all', src: 'all', selectMode: false, sel: new Set(), groups: JSON.parse(localStorage.getItem('groups') || '{}') },
};
if (!['live', 'team', 'settings'].includes(S.tab)) S.tab = 'live';

// ================================================================== realtime
async function loadState() {
  try {
    const st = await api('/api/state');
    S.sessions = new Map(st.sessions.map(s => [s.id, s]));
    S.approvals = st.approvals; S.config = st.config; S.hooks = st.hooks; S.mainModel = st.mainModel;
    st.approvals.forEach(a => S.seenApprovals.add(a.id));
    renderAll();
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
      S.sessions.set(m.session.id, { ...m.session, steps: old?.steps || [] });
      scheduleLive();
    } else if (m.type === 'step') {
      let s = S.sessions.get(m.sessionId);
      if (!s) { s = { id: m.sessionId, steps: [], agents: [], todos: [], tasks: {}, updatedAt: Date.now(), status: 'working', project: '' }; S.sessions.set(s.id, s); }
      const i = s.steps.findIndex(x => x.id === m.step.id);
      if (i >= 0) s.steps[i] = m.step; else s.steps.push(m.step);
      scheduleLive();
    } else if (m.type === 'approvals') {
      S.approvals = m.approvals;
      notifyNewApprovals();
      renderApprovals();
      scheduleLive();
    } else if (m.type === 'config') { S.config = m.config; if (S.tab === 'settings') renderSettings(); }
    else if (m.type === 'hooks') { S.hooks = m.hooks; renderConn(); if (S.tab === 'settings') renderSettings(); scheduleLive(); }
    else if (m.type === 'hidden') { S.sessions.delete(m.sessionId); scheduleLive(); }
  };
}

let liveRaf = null;
function scheduleLive() {
  if (liveRaf) return;
  liveRaf = requestAnimationFrame(() => {
    liveRaf = null;
    const sel = window.getSelection();
    if (sel && sel.toString() && $('#view-live').contains(sel.anchorNode)) { setTimeout(scheduleLive, 800); return; }
    renderBadge();
    if (S.tab === 'live') renderLive();
  });
}

function notifyNewApprovals() {
  for (const a of S.approvals) {
    if (S.seenApprovals.has(a.id)) continue;
    S.seenApprovals.add(a.id);
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      const n = new Notification('Agent đang chờ bạn duyệt', { body: `${a.who}: ${a.text}`, tag: a.id });
      n.onclick = () => { window.focus(); n.close(); };
    }
  }
}

// ================================================================== shell
function setTab(t) { S.tab = t; history.replaceState(null, '', '#' + t); renderAll(); }
function renderAll() {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === S.tab));
  $('#view-live').hidden = S.tab !== 'live';
  $('#view-team').hidden = S.tab !== 'team';
  $('#view-settings').hidden = S.tab !== 'settings';
  renderConn(); renderApprovals(); renderBadge();
  if (S.tab === 'live') renderLive();
  if (S.tab === 'team') renderTeam();
  if (S.tab === 'settings') renderSettings();
}
function renderConn() {
  const b = $('#conn');
  if (!S.live) { b.className = 'conn warn'; b.innerHTML = '<span class="dot"></span>Mất kết nối với bảng điều khiển'; return; }
  if (S.hooks.connected) { b.className = 'conn ok'; b.innerHTML = '<span class="dot"></span>Đã kết nối Claude Code'; }
  else { b.className = 'conn warn'; b.innerHTML = '<span class="dot"></span>Chưa kết nối Claude Code'; }
}
function renderBadge() {
  const n = S.approvals.length;
  const badge = $('#badge-live');
  badge.hidden = !n; badge.textContent = n;
  document.title = n ? `(${n}) Chờ bạn duyệt · Bảng điều khiển Agent` : 'Bảng điều khiển Agent';
}

// ================================================================== approvals
function renderApprovals() {
  const box = $('#approvals');
  const list = S.approvals;
  box.hidden = !list.length;
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = list.map(a => `
    <div class="approval">
      <div class="ico">${icon(toolIcon(a.tool))}</div>
      <div style="min-width:0">
        <div class="what">${esc(a.who)} muốn: ${esc(a.text)}</div>
        <div class="where">${esc(a.project)}${a.title ? ' · ' + esc(a.title) : ''}</div>
        ${a.detail ? `<pre>${esc(a.detail)}</pre>` : ''}
      </div>
      <div class="side">
        <div class="row">
          <button class="btn ok" data-decide="allow" data-aid="${esc(a.id)}">${icon('check', 'sm')}Cho phép</button>
          <button class="btn danger" data-decide="deny" data-aid="${esc(a.id)}">${icon('x', 'sm')}Từ chối</button>
        </div>
        <button class="btn ghost sm" data-decide="always" data-aid="${esc(a.id)}">Luôn cho phép ${esc(a.tool)} trong phiên này</button>
        <div class="countdown" data-exp="${a.expiresAt}"></div>
      </div>
    </div>`).join('');
  tickCountdown();
}
function tickCountdown() {
  $$('.countdown[data-exp]').forEach(el => {
    const left = Math.max(0, Math.round((Number(el.dataset.exp) - Date.now()) / 1000));
    el.textContent = `Tự chuyển về Terminal sau ${Math.floor(left / 60)}:${pad(left % 60)}`;
  });
}
setInterval(tickCountdown, 1000);

async function decide(id, act) {
  let note;
  if (act === 'deny') {
    note = await modal({ title: 'Từ chối bước này?', text: 'Ghi lý do để agent hiểu và làm cách khác (không bắt buộc).', input: { placeholder: 'Ví dụ: Đừng xoá file, hãy tạo file mới' }, okText: 'Từ chối', okClass: 'danger-solid' });
    if (note === null) return;
  }
  try {
    await api(`/api/approvals/${id}`, { decision: act, note });
    toast(act === 'deny' ? 'Đã từ chối. Agent sẽ tìm cách khác.' : 'Đã cho phép.');
  } catch (err) { toast(err.message, 'error'); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-decide]');
  if (b) { e.stopPropagation(); decide(b.dataset.aid, b.dataset.decide); }
}, true);

// ================================================================== flow model
// Turns a session's step list into "turns" (one per request). Each turn is a grid of nodes:
// column 0 = main agent, columns 1.. = sub-agents (a column is reused once its agent is done).
function buildTurns(s) {
  const agents = new Map((s.agents || []).map(a => [a.key, a]));
  const turns = [];
  const forkOf = new Map();
  let T = null;
  const add = n => { n.id = `${n.type}-${n.steps[0].id}`; n.row = T.row++; T.nodes.push(n); T.cols = Math.max(T.cols, n.col + 1); return n; };
  const edge = (a, b, kind, lane) => T.edges.push({ from: a.id, to: b.id, kind, lane });
  const chain = (lane, n) => { const prev = T.last.get(lane); if (prev) edge(prev, n, 'seq', lane); T.last.set(lane, n); };
  const colFor = lane => {
    if (T.laneCol.has(lane)) return T.laneCol.get(lane);
    let c = 1; while (T.colOwner[c]) c++;
    T.colOwner[c] = lane; T.laneCol.set(lane, c); T.agents.add(lane);
    return c;
  };
  const newTurn = prompt => {
    T = { key: prompt ? prompt.id : `t${turns.length}`, prompt, nodes: [], edges: [], row: 1, cols: 1, laneCol: new Map(), colOwner: [], last: new Map(), steps: 0, agents: new Set(), ts: prompt?.ts };
    turns.push(T);
    if (prompt) T.last.set(null, add({ type: 'prompt', lane: null, col: 0, steps: [prompt] }));
  };
  for (const st of s.steps || []) {
    if (st.kind === 'prompt') { newTurn(st); continue; }
    if (st.mark === 'session-start' || (st.kind === 'system' && st.text === 'Agent phụ gửi kết quả về')) continue;
    if (!T) newTurn(null);
    if (!T.ts) T.ts = st.ts;
    const lane = st.lane || null;
    if (st.mark === 'subagent-start' && lane) {
      const fresh = !T.laneCol.has(lane);
      const ag = agents.get(lane);
      const n = add({ type: 'lane-start', lane, col: colFor(lane), steps: [st], agent: ag });
      if (fresh) {
        const f = ag?.toolUseId && forkOf.get(ag.toolUseId);
        const src = f && T.nodes.includes(f) ? f : T.last.get(null);
        if (src) edge(src, n, 'fork', lane);
        T.last.set(lane, n);
      } else chain(lane, n);
      continue;
    }
    if (st.mark === 'subagent-end' && lane) {
      if (!T.laneCol.has(lane)) continue;
      const ag = agents.get(lane);
      const end = add({ type: 'lane-end', lane, col: T.laneCol.get(lane), steps: [st], agent: ag });
      chain(lane, end);
      T.colOwner[T.laneCol.get(lane)] = null; T.laneCol.delete(lane); T.last.delete(lane);
      const ret = add({ type: 'return', lane: null, col: 0, steps: [st], agent: ag, retLane: lane });
      edge(end, ret, 'return', lane);
      chain(null, ret);
      continue;
    }
    const col = lane ? colFor(lane) : 0;
    if (st.kind === 'tool') T.steps++;
    const groupable = st.kind === 'tool' && st.category === 'read' && !st.link;
    const prev = T.last.get(lane);
    if (groupable && prev && prev.group) { prev.steps.push(st); continue; }
    let type = 'step';
    if (st.mark === 'turn-end') type = 'end';
    else if (st.mark === 'stopped') type = 'end-bad';
    else if (st.kind === 'system' || st.kind === 'agent') type = 'note';
    const n = add({ type, lane, col, steps: [st], group: groupable, agent: lane ? agents.get(lane) : null });
    if (st.tool === 'Agent' || st.tool === 'Task') forkOf.set(st.toolUseId, n);
    chain(lane, n);
  }
  return turns;
}

function nodeStatus(n) {
  if (!n) return '';
  const sts = n.steps.map(x => x.status).filter(Boolean);
  for (const k of ['awaiting', 'running', 'failed', 'denied']) if (sts.includes(k)) return k;
  return sts[0] || '';
}

function nodeView(n, s) {
  const st = n.steps[0];
  const lc = n.lane ? laneColor(s, n.lane) : n.retLane ? laneColor(s, n.retLane) : null;
  const agName = n.agent ? (n.agent.description || n.agent.type) : '';
  switch (n.type) {
    case 'prompt': return { cls: 'prompt', ic: 'user', title: st.promptText || st.text.replace(/^Bạn yêu cầu:\s*/, ''), sub: `Bạn yêu cầu · ${fmtTime(st.ts)}` };
    case 'lane-start': return { cls: 'lane-start', ic: 'bot', lane: lc, title: agName || 'Agent phụ', sub: `Agent phụ · ${n.agent?.type || ''}${n.agent?.model ? ' · ' + modelName(n.agent.model) : ''}` };
    case 'lane-end': return { cls: 'pill lane-end', ic: 'check', lane: lc, title: 'Xong việc' };
    case 'return': return { cls: 'pill ret', ic: 'ret', lane: lc, title: `Nhận kết quả từ ${agName}` };
    case 'end': return { cls: 'pill end-ok', ic: 'flag', title: 'Xong lượt này' };
    case 'end-bad': return { cls: 'pill end-bad', ic: 'stop', title: 'Đã dừng' };
    case 'note': return { cls: 'pill note', ic: st.mark === 'message' ? 'msg' : /Tác vụ chạy nền/.test(st.text) ? 'bell' : 'info', title: st.text };
    default: break;
  }
  if (n.steps.length > 1) {
    const r = n.steps.filter(x => x.tool === 'Read').length;
    const q = n.steps.length - r;
    const parts = [];
    if (r) parts.push(`Đọc ${r} file`);
    if (q) parts.push(`${r ? 'tìm' : 'Tìm'} ${q} lần`);
    const names = n.steps.filter(x => x.tool === 'Read').map(x => base(x.detail)).filter(Boolean);
    return { cls: '', ic: r ? 'file' : 'search', cat: 'read', lane: lc, title: parts.join(', '), sub: names.length ? names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '') : `${n.steps.length} bước` };
  }
  let title = st.text;
  let sub = `<code>${esc(st.tool || '')}</code> · ${fmtTime(st.ts)}`;
  if (st.tool === 'Agent' || st.tool === 'Task') {
    const m = /”:\s*(.*)$/.exec(st.text);
    title = `Giao việc: ${m ? m[1] : st.link?.name}`;
    sub = `cho agent ${esc(st.link?.name || '')} · ${fmtTime(st.ts)}`;
  }
  return { cls: '', ic: toolIcon(st.tool), cat: catOf(st), lane: lc, title, sub, rawSub: true };
}

function statusMark(status) {
  if (status === 'running') return '<span class="spinner"></span>';
  if (status === 'awaiting') return `<span style="color:var(--warn)">${icon('hand', 'sm')}</span>`;
  if (status === 'done') return `<span class="ok-i">${icon('check', 'sm')}</span>`;
  if (status === 'failed' || status === 'denied') return `<span class="bad-i">${icon('x', 'sm')}</span>`;
  return '';
}

function nodeHTML(n, s) {
  const v = nodeView(n, s);
  const status = nodeStatus(n);
  const sel = S.selNode === n.id ? ' sel' : '';
  const style = `grid-row:${n.row + 1};grid-column:${n.col + 1};${v.cat ? `--cat:${CAT_VAR(v.cat)};` : ''}${v.lane ? `--lane:${v.lane};` : ''}`;
  const approval = status === 'awaiting' ? S.approvals.find(a => n.steps.some(x => x.id === a.stepId)) : null;
  if (v.cls.startsWith('pill')) {
    return `<div class="fnode ${v.cls}${sel}" data-node="${esc(n.id)}" style="${style}" title="${esc(v.title)}">
      <div class="ic">${icon(v.ic, 'sm')}</div><div class="tt">${esc(v.title)}</div></div>`;
  }
  const strip = n.lane && n.type !== 'lane-start' ? '<span class="lane-strip"></span>' : '';
  return `<div class="fnode ${v.cls} st-${esc(status || 'none')}${sel}" data-node="${esc(n.id)}" style="${style}">
    ${strip}
    <div class="ic">${icon(v.ic)}</div>
    <div style="min-width:0"><div class="tt" title="${esc(v.title)}">${esc(v.title)}</div>${v.sub ? `<div class="sb">${v.rawSub ? v.sub : esc(v.sub)}</div>` : ''}</div>
    ${n.type === 'prompt' ? '' : `<div class="stt">${statusMark(status)}</div>`}
    ${approval ? `<div class="approve"><button class="btn ok sm" data-decide="allow" data-aid="${esc(approval.id)}">Cho phép</button><button class="btn danger sm" data-decide="deny" data-aid="${esc(approval.id)}">Từ chối</button></div>` : ''}
  </div>`;
}

function turnOpen(T, idx, total) {
  if (T.key in S.turnOpen) return S.turnOpen[T.key];
  return idx >= total - 2;
}

function turnHTML(s, T, idx, total) {
  const open = turnOpen(T, idx, total);
  const prompt = T.prompt ? (T.prompt.promptText || T.prompt.text.replace(/^Bạn yêu cầu:\s*/, '')) : '';
  const head = `<div class="turn-head" data-turn="${esc(T.key)}">${icon('chevron', 'sm caret')}
    <span class="label">Vòng ${idx + 1}</span>
    <span class="turn-sum">${fmtHM(T.ts)} · ${T.steps} bước${T.agents.size ? ` · ${T.agents.size} agent phụ` : ''}${!open && prompt ? ` · “${esc(prompt.slice(0, 80))}${prompt.length > 80 ? '…' : ''}”` : ''}</span>
    <span class="line"></span></div>`;
  if (!open) return `<div class="turn collapsed">${head}</div>`;
  const cols = T.cols;
  const heads = `<div class="lanehead" style="grid-row:1;grid-column:1">Agent chính</div>` +
    (cols > 1 ? `<div class="lanehead" style="grid-row:1;grid-column:2 / span ${cols - 1}">Agent phụ</div>` : '');
  return `<div class="turn">${head}
    <div class="flow" data-flow="${esc(T.key)}" style="grid-template-columns:repeat(${cols}, 230px)">
      ${heads}${T.nodes.map(n => nodeHTML(n, s)).join('')}<svg class="edges"></svg>
    </div></div>`;
}

const SPINE = 23; // x offset of the icon centre inside every node: connector lines run through it
function drawEdges(s, turns) {
  for (const T of turns) {
    const flow = document.querySelector(`[data-flow="${CSS.escape(T.key)}"]`);
    if (!flow) continue;
    const svg = flow.querySelector('svg.edges');
    const W = flow.scrollWidth, H = flow.scrollHeight;
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const fr = flow.getBoundingClientRect();
    const boxes = new Map();
    for (const el of flow.querySelectorAll('[data-node]')) {
      const r = el.getBoundingClientRect();
      boxes.set(el.dataset.node, { l: r.left - fr.left, r: r.right - fr.left, t: r.top - fr.top, b: r.bottom - fr.top, cy: (r.top + r.bottom) / 2 - fr.top });
    }
    const byId = new Map(T.nodes.map(n => [n.id, n]));
    const R = 10;
    let out = '';
    for (const e of T.edges) {
      const a = boxes.get(e.from), b = boxes.get(e.to);
      if (!a || !b) continue;
      const na = byId.get(e.from), nb = byId.get(e.to);
      const color = e.lane ? laneColor(s, e.lane) : 'var(--line-2)';
      const live = ['running', 'awaiting'].includes(nodeStatus(nb)) || (nb.type === 'lane-start' && ['working', 'starting'].includes(nb.agent?.status));
      let arrow;
      if (e.kind === 'seq') {
        const x = a.l + SPINE;
        const dash = nb.row - na.row > 1;
        out += `<path class="edge ${dash ? 'dash' : ''} ${live ? 'live' : ''}" d="M${x} ${a.b} V${b.t - 1}" stroke="${color}"/>`;
        arrow = `M${x - 3.5} ${b.t - 6} L${x} ${b.t - 1} L${x + 3.5} ${b.t - 6}`;
      } else if (e.kind === 'fork') {
        const x1 = a.r, y1 = a.cy, x2 = b.l + SPINE, y2 = b.t - 1;
        out += `<path class="edge ${live ? 'live' : ''}" d="M${x1} ${y1} H${x2 - R} Q${x2} ${y1} ${x2} ${y1 + R} V${y2}" stroke="${color}"/>`;
        arrow = `M${x2 - 3.5} ${y2 - 5} L${x2} ${y2} L${x2 + 3.5} ${y2 - 5}`;
      } else {
        const x1 = a.l + SPINE, y1 = a.b, x2 = b.r + 1, y2 = b.cy;
        out += `<path class="edge dash" d="M${x1} ${y1} V${y2 - R} Q${x1} ${y2} ${x1 - R} ${y2} H${x2}" stroke="${color}"/>`;
        arrow = `M${x2 + 5} ${y2 - 3.5} L${x2} ${y2} L${x2 + 5} ${y2 + 3.5}`;
      }
      out += `<path class="edge" d="${arrow}" stroke="${color}"/>`;
    }
    svg.innerHTML = out;
  }
}

// ================================================================== live view
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
    <div style="max-width:480px;margin:0 auto 18px">Bấm một lần. Sau đó mỗi khi bạn giao việc cho Claude Code, từng bước của agent sẽ hiện ở đây dưới dạng sơ đồ, và bạn có thể duyệt hoặc dừng agent từ đây.</div>
    <button class="btn primary lg" data-global="install">${icon('plug', 'sm')}Kết nối ngay</button>
    <div class="small faint" style="margin-top:14px">File cài đặt cũ được tự sao lưu. Có thể ngắt kết nối trong tab Cài đặt.</div>
  </div></div>`;
}

function renderLive() {
  const root = $('#view-live');
  const list = sortedSessions();
  if (!S.hooks.connected && !list.length) { root.innerHTML = onboardingHTML(); delete root.dataset.ready; return; }
  if (!root.dataset.ready) {
    root.innerHTML = `<div class="live">
      <aside class="pane pane-left" id="sess"></aside>
      <section class="pane-center"><div id="banner"></div><div id="shead" class="shead"></div><div id="nowbar"></div><div class="canvas" id="canvas"></div></section>
      <aside class="pane pane-right" id="insp"></aside></div>`;
    root.dataset.ready = '1';
  }
  if (!S.selected || !S.sessions.has(S.selected)) { S.selected = list[0]?.id || null; S.selNode = null; }

  $('#banner').innerHTML = S.hooks.connected ? '' : `<div class="callout warn" style="border-radius:0">${icon('alert', 'sm')}<div style="flex:1">Chưa kết nối với Claude Code nên sẽ không thấy bước mới.</div><button class="btn sm primary" data-global="install">Kết nối ngay</button></div>`;

  $('#sess').innerHTML = `<div class="pane-title"><span class="label">Phiên làm việc</span><span class="small faint">${list.length}</span></div>` +
    (list.map(s => `<div class="session ${s.id === S.selected ? 'active' : ''}" data-session="${esc(s.id)}">
      <div class="top">${statusTag(effStatus(s))}<span class="spacer"></span><span>${timeAgo(s.updatedAt)}</span></div>
      <div class="title">${esc(s.title || 'Phiên mới')}</div>
      <div class="foot">${esc(s.project || '')} · ${s.stepCount ?? s.steps.length} bước${(s.agents || []).length ? ` · ${s.agents.length} agent phụ` : ''}</div>
    </div>`).join('') || `<div class="empty small">Chưa có phiên nào.<br>Mở Claude Code và giao việc.</div>`);

  const s = S.sessions.get(S.selected);
  const shead = $('#shead'), nowbar = $('#nowbar'), canvas = $('#canvas');
  if (!s) {
    shead.hidden = true; nowbar.hidden = true;
    canvas.innerHTML = `<div class="empty"><div class="ico">${icon('play', 'lg')}</div><div class="title">Chưa có agent nào chạy</div><div>Mở Claude Code và giao việc, sơ đồ sẽ hiện ở đây ngay.</div></div>`;
    $('#insp').innerHTML = '';
    return;
  }
  shead.hidden = false;
  renderSessionHead(s);
  const turns = buildTurns(s);
  const nodeCount = turns.reduce((a, t) => a + t.nodes.length, 0);
  const prevTop = canvas.scrollTop, prevLeft = canvas.scrollLeft;
  const atBottom = canvas.scrollTop + canvas.clientHeight >= canvas.scrollHeight - 80;
  const switched = S.lastRendered.session !== s.id;
  canvas.innerHTML = turns.length ? turns.map((T, i) => turnHTML(s, T, i, turns.length)).join('')
    : `<div class="empty"><div class="title">Phiên này chưa có bước nào</div></div>`;
  drawEdges(s, turns);
  canvas.scrollLeft = prevLeft;
  canvas.scrollTop = switched || (atBottom && nodeCount !== S.lastRendered.nodes) ? canvas.scrollHeight : prevTop;
  S.lastRendered = { session: s.id, nodes: nodeCount };
  renderInspector(s, turns);
}

function currentStep(s) {
  const steps = s.steps || [];
  for (let i = steps.length - 1; i >= 0; i--) if (steps[i].status === 'awaiting') return steps[i];
  for (let i = steps.length - 1; i >= 0; i--) if (steps[i].status === 'running') return steps[i];
  return null;
}
const laneName = (s, key) => { const a = (s.agents || []).find(x => x.key === key); return a ? (a.description || a.type) : 'Agent chính'; };

function renderSessionHead(s) {
  const st = effStatus(s);
  const active = ACTIVE.has(st) || s.stopRequested;
  $('#shead').innerHTML = `
    <div style="flex:1;min-width:0">
      <div class="t">${esc(s.title || 'Phiên mới')}</div>
      <div class="m">${statusTag(st)}<span class="row" style="gap:4px">${icon('folder', 'sm')}${esc(s.project || '')}</span><span>bắt đầu ${fmtHM(s.startedAt)}</span>
      ${(s.allowTools || []).length ? `<span>luôn cho phép: ${esc(s.allowTools.join(', '))} <a href="#" data-sact="reset-trust">bỏ</a></span>` : ''}</div>
    </div>
    ${s.stopRequested ? `<button class="btn" data-sact="cancel-stop">Huỷ dừng</button>` : `<button class="btn danger" data-sact="stop" ${active ? '' : 'disabled'}>${icon('stop', 'sm')}Dừng</button>`}
    <button class="btn" data-sact="message">${icon('msg', 'sm')}Nhắn cho agent</button>
    <button class="btn ghost" data-sact="hide" title="Ẩn phiên này">${icon('trash', 'sm')}</button>`;

  const cur = currentStep(s);
  const nb = $('#nowbar');
  let cls = '', html = '';
  if (s.stopRequested) { cls = 'bad'; html = `${icon('stop', 'sm')}<span><b>Đang dừng</b> · agent sẽ dừng ở bước kế tiếp</span>`; }
  else if (st === 'approval') { cls = 'warn'; html = `${icon('hand', 'sm')}<span><b>Chờ bạn duyệt:</b> ${esc(cur?.text || '')}</span>`; }
  else if (st === 'needs-permission' || st === 'waiting') { cls = 'warn'; html = `${icon('bell', 'sm')}<span><b>Đang chờ bạn</b> trả lời trong cửa sổ Claude Code</span>`; }
  else if (st === 'working') html = `<span class="spinner"></span><span><b>Đang làm:</b> ${esc(cur?.text || 'đang suy nghĩ…')}${cur?.lane ? ` <span class="faint">(${esc(laneName(s, cur.lane))})</span>` : ''}</span>`;
  else if (st === 'done') { cls = 'ok'; html = `${icon('check', 'sm')}<span><b>Xong lượt này.</b> Giao việc tiếp trong Claude Code hoặc bấm “Nhắn cho agent”.</span>`; }
  else if (st === 'stopped') { cls = 'bad'; html = `${icon('stop', 'sm')}<span><b>Đã dừng</b> theo yêu cầu của bạn.</span>`; }
  nb.className = `nowbar ${cls}`;
  nb.hidden = !html;
  nb.innerHTML = html;
}

function findNode(turns, id) { for (const T of turns) for (const n of T.nodes) if (n.id === id) return n; return null; }

function renderInspector(s, turns) {
  const box = $('#insp');
  const n = S.selNode && findNode(turns, S.selNode);
  if (n) { box.innerHTML = nodeInspector(s, n); return; }
  S.selNode = null;
  const plan = (s.todos && s.todos.length) ? s.todos : Object.values(s.tasks || {});
  const done = plan.filter(t => t.status === 'completed').length;
  const agents = s.agents || [];
  box.innerHTML = `<div class="insp">
    <div class="insp-sec"><div class="small muted">Bấm vào một ô trong sơ đồ để xem chi tiết bước đó.</div></div>
    ${plan.length ? `<div class="insp-sec"><div class="label">Kế hoạch <span class="bar"><div style="width:${Math.round(done / plan.length * 100)}%"></div></span><span>${done}/${plan.length}</span></div>
      ${plan.map(t => `<div class="plan-item ${esc(t.status)}"><div class="box">${t.status === 'completed' ? icon('check', 'sm') : ''}</div><div class="txt">${esc(t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content)}</div></div>`).join('')}</div>` : ''}
    <div class="insp-sec"><div class="label">Đội hình</div>
      <div class="member" data-open-settings="1" title="Đổi model trong tab Cài đặt"><span class="sw" style="background:var(--ink)"></span><span class="nm">Agent chính</span><span class="small faint">${esc(modelName(S.mainModel) || 'Mặc định')}</span></div>
      ${agents.map(a => {
        const custom = !BUILTIN_AGENTS.includes(a.type);
        return `<div class="member" ${custom ? `data-open-item="agent" data-name="${esc(a.type)}"` : ''} title="${custom ? 'Bấm để chỉnh agent này' : 'Agent có sẵn của Claude Code'}">
          <span class="sw" style="background:${laneColor(s, a.key)}"></span>
          <span class="nm">${esc(a.description || a.type)} <span class="faint small">${esc(a.type)}${a.model ? ' · ' + esc(modelName(a.model)) : ''}</span></span>
          ${a.status === 'working' || a.status === 'starting' ? '<span class="spinner"></span>' : a.status === 'failed' ? `<span style="color:var(--bad)">${icon('x', 'sm')}</span>` : `<span style="color:var(--ok)">${icon('check', 'sm')}</span>`}
          ${custom ? `<span class="faint">${icon('gear', 'sm')}</span>` : ''}</div>`;
      }).join('')}
    </div>
    <div class="insp-sec"><div class="label">Chú thích</div>
      <div class="legend">
        ${[['read', 'file', 'Đọc / tìm'], ['edit', 'edit', 'Sửa file'], ['command', 'terminal', 'Chạy lệnh'], ['web', 'globe', 'Web'], ['agent', 'bot', 'Giao việc agent'], ['skill', 'zap', 'Dùng skill'], ['plan', 'list', 'Kế hoạch'], ['other', 'plug', 'Công cụ khác']]
          .map(([c, ic, l]) => `<span><i style="--cat:${CAT_VAR(c)}">${icon(ic, 'sm')}</i>${l}</span>`).join('')}
      </div>
      <div class="small muted" style="margin-top:10px">Nét đứt: agent chính đang chờ agent phụ. Nét chạy: bước đang thực hiện.</div>
    </div>
  </div>`;
}

function nodeInspector(s, n) {
  const v = nodeView(n, s);
  const st = n.steps[0];
  const status = nodeStatus(n);
  const who = n.lane ? `Agent phụ: ${laneName(s, n.lane)}` : n.type === 'prompt' ? 'Bạn' : 'Agent chính';
  const approval = status === 'awaiting' ? S.approvals.find(a => n.steps.some(x => x.id === a.stepId)) : null;
  const link = st.link && !(st.link.type === 'agent' && BUILTIN_AGENTS.includes(st.link.name)) ? st.link
    : n.type === 'lane-start' && n.agent && !BUILTIN_AGENTS.includes(n.agent.type) ? { type: 'agent', name: n.agent.type } : null;
  const one = n.steps.length === 1;
  return `<div class="insp">
    <div class="insp-sec">
      <div class="row" style="margin-bottom:10px;justify-content:space-between"><span class="label" style="margin:0">Chi tiết bước</span><button class="btn ghost sm" data-unselect="1">${icon('close', 'sm')}</button></div>
      <h4>${esc(n.type === 'prompt' ? 'Yêu cầu của bạn' : v.title)}</h4>
      <div class="kv" style="margin-top:10px">
        <span class="k">Ai làm</span><span>${esc(who)}</span>
        ${st.tool ? `<span class="k">Công cụ</span><span><code>${esc(st.tool)}</code></span>` : ''}
        <span class="k">Lúc</span><span>${fmtTime(st.ts)}${n.steps.length > 1 ? ' → ' + fmtTime(n.steps[n.steps.length - 1].ts) : ''}</span>
        ${status ? `<span class="k">Trạng thái</span><span>${esc(STEP_STATUS[status] || status)}</span>` : ''}
        ${n.type === 'lane-start' && n.agent?.model ? `<span class="k">Model</span><span>${esc(modelName(n.agent.model))}</span>` : ''}
      </div>
      ${approval ? `<div class="row" style="margin-top:12px"><button class="btn ok" data-decide="allow" data-aid="${esc(approval.id)}">${icon('check', 'sm')}Cho phép</button><button class="btn danger" data-decide="deny" data-aid="${esc(approval.id)}">${icon('x', 'sm')}Từ chối</button></div>` : ''}
      ${link ? `<div style="margin-top:12px"><button class="btn" data-open-item="${esc(link.type)}" data-name="${esc(link.name)}">${icon('gear', 'sm')}Chỉnh ${link.type === 'agent' ? 'agent' : 'skill'} “${esc(link.name)}”</button></div>` : ''}
    </div>
    ${one && st.detail ? `<div class="insp-sec"><div class="label">${n.type === 'prompt' ? 'Nội dung' : 'Đầu vào'}</div><pre>${esc(st.detail)}</pre></div>` : ''}
    ${one && st.result ? `<div class="insp-sec"><div class="label">Kết quả</div><pre>${esc(st.result)}</pre></div>` : ''}
    ${!one ? `<div class="insp-sec"><div class="label">Gồm ${n.steps.length} bước</div>
      ${n.steps.map(x => `<details class="substep"><summary>${icon(toolIcon(x.tool), 'sm')}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.text)}</span>${statusMark(x.status)}</summary>${x.detail || x.result ? `<pre>${esc([x.detail, x.result].filter(Boolean).join('\n\n— Kết quả —\n'))}</pre>` : ''}</details>`).join('')}
    </div>` : ''}
  </div>`;
}

$('#view-live').addEventListener('click', async e => {
  const t = e.target;
  const sessEl = t.closest('[data-session]');
  if (sessEl) { S.selected = sessEl.dataset.session; S.selNode = null; await ensureSteps(S.selected); return renderLive(); }
  const openItem = t.closest('[data-open-item]');
  if (openItem) { e.stopPropagation(); return openItemByName(openItem.dataset.openItem, openItem.dataset.name); }
  if (t.closest('[data-open-settings]')) return setTab('settings');
  if (t.closest('[data-unselect]')) { S.selNode = null; return renderLive(); }
  const sact = t.closest('[data-sact]');
  if (sact) { e.preventDefault(); return sessionAction(sact.dataset.sact); }
  const th = t.closest('[data-turn]');
  if (th) {
    const turns = buildTurns(S.sessions.get(S.selected));
    const idx = turns.findIndex(x => x.key === th.dataset.turn);
    S.turnOpen[th.dataset.turn] = !turnOpen(turns[idx], idx, turns.length);
    return renderLive();
  }
  const node = t.closest('[data-node]');
  if (node) { S.selNode = S.selNode === node.dataset.node ? null : node.dataset.node; return renderLive(); }
});

async function ensureSteps(id) {
  const s = S.sessions.get(id);
  if (!s || (s.stepCount || 0) <= (s.steps || []).length) return;
  try { const full = await api(`/api/sessions/${encodeURIComponent(id)}`); S.sessions.set(id, { ...s, steps: full.steps }); } catch {}
}

async function sessionAction(act) {
  const id = S.selected;
  try {
    if (act === 'stop') {
      const ok = await modal({ title: 'Dừng agent?', text: 'Agent sẽ dừng ở bước kế tiếp (bước đang chạy dở được làm cho xong). Sau đó bạn có thể giao việc tiếp trong Claude Code.', okText: 'Dừng agent', okClass: 'danger-solid' });
      if (!ok) return;
      await api(`/api/sessions/${encodeURIComponent(id)}/stop`, {});
      toast('Đã gửi yêu cầu dừng.');
    } else if (act === 'message') {
      const text = await modal({ title: 'Nhắn cho agent', text: 'Agent đọc lời nhắn ở bước kế tiếp (hoặc ngay khi vừa xong lượt) và làm theo.', input: { placeholder: 'Ví dụ: Viết ngắn gọn hơn, trả lời bằng tiếng Việt' }, okText: 'Gửi' });
      if (!text || !text.trim()) return;
      await api(`/api/sessions/${encodeURIComponent(id)}/message`, { text });
      toast('Đã gửi. Agent sẽ đọc ở bước kế tiếp.');
    } else if (act === 'hide') {
      const ok = await modal({ title: 'Ẩn phiên này?', text: 'Phiên sẽ không còn trong danh sách. Không ảnh hưởng tới Claude Code.', okText: 'Ẩn phiên' });
      if (!ok) return;
      await api(`/api/sessions/${encodeURIComponent(id)}/hide`, {});
      S.sessions.delete(id); S.selected = null; renderLive();
    } else {
      await api(`/api/sessions/${encodeURIComponent(id)}/${act}`, {});
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ================================================================== team view
async function loadItems(force) {
  if (S.items && !force) return S.items;
  S.items = (await api('/api/items')).items;
  return S.items;
}
const groupOrder = it => ({ user: 0, project: 1, synced: 2, plugin: 3 }[it.scope] ?? 4);
const groupCollapsed = (name, editable) => (name in S.team.groups ? S.team.groups[name] : !editable);
function activeAgentTypes() {
  const set = new Set();
  for (const s of S.sessions.values()) for (const a of s.agents || []) if (a.status === 'working' || a.status === 'starting') set.add(a.type);
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
  const filtered = S.items.filter(i =>
    (T.kind === 'all' || i.kind === T.kind) &&
    (T.src === 'all' || (T.src === 'edit' ? i.editable : !i.editable)) &&
    (!q || `${i.name} ${i.description} ${i.plugin || ''}`.toLowerCase().includes(q)));
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
        <div class="muted">Bấm vào một thẻ để chỉnh. Thay đổi lưu thẳng vào file và áp dụng từ lần chạy tiếp theo.</div>
      </div>
      <button class="btn ${T.selectMode ? 'primary' : ''}" data-tact="select">${T.selectMode ? 'Xong' : 'Đổi model hàng loạt'}</button>
      <button class="btn" data-tact="reload">${icon('refresh', 'sm')}Tải lại</button>
    </div>
    ${localStorage.getItem('hideExplain') ? '' : `<div class="callout" style="margin-bottom:16px">${icon('info', 'sm')}<div style="flex:1"><b>Agent</b> là một “nhân viên” chuyên một việc, được agent chính giao việc. <b>Skill</b> là một “quy trình mẫu” mà agent tự dùng khi gặp đúng loại việc.</div><button class="btn ghost sm" data-tact="hide-explain">Đã hiểu</button></div>`}
    <div class="toolbar">
      <div class="search">${icon('search', 'sm')}<input id="team-q" placeholder="Tìm theo tên hoặc mô tả" value="${esc(T.q)}"></div>
      <div class="seg" data-seg="kind">${[['all', 'Tất cả'], ['agent', 'Agent'], ['skill', 'Skill']].map(([v, l]) => `<button data-v="${v}" class="${T.kind === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="seg" data-seg="src">${[['all', 'Mọi nguồn'], ['edit', 'Sửa được'], ['ro', 'Chỉ xem']].map(([v, l]) => `<button data-v="${v}" class="${T.src === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    ${groups.size ? [...groups.entries()].map(([name, list]) => {
      const editable = list.some(i => i.editable);
      const collapsed = !q && groupCollapsed(name, editable);
      return `<div class="group ${collapsed ? 'collapsed' : ''}">
        <div class="group-head" data-toggle-group="${esc(name)}" data-editable="${editable ? 1 : 0}">
          ${icon('chevron', 'sm caret')}<span class="h3">${esc(name)}</span><span class="chip">${list.length}</span>
          ${T.selectMode && editable ? `<button class="btn sm ghost" data-select-group="${esc(name)}">Chọn cả nhóm</button>` : ''}
        </div>
        <div class="grid">${list.map(i => itemCard(i, running)).join('')}</div>
      </div>`;
    }).join('') : `<div class="card empty"><div class="title">Không tìm thấy mục nào</div><div>Thử đổi từ khoá hoặc bộ lọc.</div></div>`}
    ${T.selectMode ? `<div class="bulkbar">
      <b>Đã chọn ${T.sel.size}</b><span style="opacity:.7">đổi model thành</span>
      <select id="bulk-model">${MODELS.map(m => `<option value="${m.v}">${esc(m.n)}: ${esc(m.d)}</option>`).join('')}</select>
      <button class="btn sm" data-tact="bulk-apply" ${T.sel.size ? '' : 'disabled'}>Áp dụng</button>
      <button class="btn sm ghost" style="color:inherit" data-tact="bulk-clear">Bỏ chọn</button>
    </div>` : ''}`;
  if (focused) { const inp = $('#team-q'); inp.focus(); inp.setSelectionRange(caret, caret); }
}

function itemCard(i, running) {
  const T = S.team;
  const sel = T.sel.has(i.id);
  return `<div class="card item ${sel ? 'sel' : ''}" data-item="${esc(i.id)}">
    ${T.selectMode && i.editable ? `<div class="check">${sel ? icon('check', 'sm') : ''}</div>` : ''}
    <div class="item-top">
      <div class="item-ico ${i.kind}">${icon(i.kind === 'agent' ? 'bot' : 'zap')}</div>
      <div style="min-width:0;padding-right:24px"><div class="item-name" title="${esc(i.invokeName)}">${esc(i.name)}</div>
      <div class="item-kind">${i.kind === 'agent' ? 'Agent' : 'Skill'}${i.plugin ? ' · ' + esc(i.plugin) : ''}</div></div>
    </div>
    <div class="item-desc">${esc(i.description || 'Chưa có mô tả')}</div>
    <div class="item-foot">
      <span class="chip ${i.model ? 'accent' : ''}">Model: ${esc(modelName(i.model))}</span>
      ${i.kind === 'agent' && running.has(i.name) ? '<span class="chip accent"><span class="dot blink"></span>Đang chạy</span>' : ''}
      ${!i.editable ? `<span class="chip">${icon('lock', 'sm')}Chỉ xem</span>` : ''}
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
  const T = S.team;
  const seg = t.closest('[data-seg] button');
  if (seg) { T[seg.parentElement.dataset.seg] = seg.dataset.v; return renderTeam(); }
  const sg = t.closest('[data-select-group]');
  if (sg) {
    e.stopPropagation();
    const ids = S.items.filter(i => i.group === sg.dataset.selectGroup && i.editable).map(i => i.id);
    const all = ids.every(id => T.sel.has(id));
    ids.forEach(id => (all ? T.sel.delete(id) : T.sel.add(id)));
    return renderTeam();
  }
  const g = t.closest('[data-toggle-group]');
  if (g) {
    const name = g.dataset.toggleGroup;
    T.groups[name] = !groupCollapsed(name, g.dataset.editable === '1');
    localStorage.setItem('groups', JSON.stringify(T.groups));
    return renderTeam();
  }
  const act = t.closest('[data-tact]')?.dataset.tact;
  if (act === 'select') { T.selectMode = !T.selectMode; if (!T.selectMode) T.sel.clear(); return renderTeam(); }
  if (act === 'reload') { S.items = null; return renderTeam(); }
  if (act === 'hide-explain') { localStorage.setItem('hideExplain', '1'); return renderTeam(); }
  if (act === 'bulk-clear') { T.sel.clear(); return renderTeam(); }
  if (act === 'bulk-apply') {
    const model = $('#bulk-model').value;
    const ok = await modal({ title: `Đổi model cho ${T.sel.size} mục?`, text: `Các mục đã chọn sẽ dùng model “${modelName(model)}” từ lần chạy tiếp theo. Bản cũ được giữ trong Lịch sử của từng mục.`, okText: 'Đổi model' });
    if (!ok) return;
    try {
      const { results } = await api('/api/items/bulk-model', { ids: [...T.sel], model });
      const bad = results.filter(r => !r.ok).length;
      toast(bad ? `Đã đổi ${results.length - bad} mục, ${bad} mục không đổi được.` : `Đã đổi model cho ${results.length} mục.`, bad ? 'error' : '');
      T.sel.clear(); T.selectMode = false;
      await loadItems(true); renderTeam();
    } catch (err) { toast(err.message, 'error'); }
    return;
  }
  const card = t.closest('[data-item]');
  if (card) {
    const it = S.items.find(i => i.id === card.dataset.item);
    if (T.selectMode && it?.editable) { T.sel.has(it.id) ? T.sel.delete(it.id) : T.sel.add(it.id); return renderTeam(); }
    openEditor(card.dataset.item);
  }
});

async function openItemByName(kind, name) {
  if (!name) return;
  if (kind === 'agent' && BUILTIN_AGENTS.includes(name)) return toast(`“${name}” là agent có sẵn của Claude Code nên không có file để chỉnh.`);
  try { await loadItems(true); } catch (e) { return toast(e.message, 'error'); }
  const [plug, short] = name.includes(':') ? name.split(':') : [null, name];
  const matches = S.items.filter(i => i.kind === kind && (i.invokeName === name || (i.name === short && (!plug || i.plugin === plug))));
  const it = matches.find(i => i.editable) || matches[0];
  if (!it) return toast(`Không tìm thấy file của ${kind} “${name}”. Có thể đây là mục có sẵn của Claude Code.`);
  openEditor(it.id);
}

// ================================================================== editor drawer
let E = null;

async function openEditor(id) {
  try {
    const item = await api(`/api/items/${id}`);
    E = { item, tab: 'basic', rawDirty: false, model: item.model, description: item.description, body: item.body, tools: item.allToolsAllowed ? null : [...item.tools], raw: item.raw };
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    renderEditor();
  } catch (e) { toast(e.message, 'error'); }
}
const basicDirty = () => E && (E.model !== E.item.model || E.description !== E.item.description || E.body !== E.item.body ||
  JSON.stringify(E.tools) !== JSON.stringify(E.item.allToolsAllowed ? null : E.item.tools));
const anyDirty = () => E && (basicDirty() || E.rawDirty);

async function closeEditor(force) {
  if (!E) return;
  if (!force && anyDirty()) {
    const ok = await modal({ title: 'Bỏ các thay đổi chưa lưu?', text: 'Nếu đóng bây giờ, những gì bạn vừa sửa sẽ mất.', okText: 'Bỏ thay đổi', okClass: 'danger-solid', cancelText: 'Tiếp tục sửa' });
    if (!ok) return;
  }
  E = null;
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
}

function renderEditor() {
  const it = E.item;
  const ro = !it.editable;
  const kindWord = it.kind === 'agent' ? 'agent' : 'skill';
  $('#drawer-panel').innerHTML = `
    <div class="d-head">
      <div class="item-ico ${it.kind}" style="width:38px;height:38px">${icon(it.kind === 'agent' ? 'bot' : 'zap', 'lg')}</div>
      <div style="flex:1;min-width:0">
        <div class="h1" style="font-size:18px">${esc(it.name)}</div>
        <div class="row small" style="flex-wrap:wrap;gap:6px;margin-top:4px"><span class="chip">${it.kind === 'agent' ? 'Agent' : 'Skill'}</span><span class="chip">${esc(it.group)}</span></div>
        <div class="small faint mono" style="margin-top:6px;word-break:break-all">${esc(it.path)}</div>
      </div>
      <button class="btn ghost" data-eact="close" title="Đóng (Esc)">${icon('close')}</button>
    </div>
    <div class="d-body">
      ${ro ? `<div class="callout warn" style="margin-bottom:14px">${icon('lock', 'sm')}<div style="flex:1">Mục này đến từ ${it.scope === 'plugin' ? 'plugin' : 'claude.ai'} nên chỉ xem được (sửa sẽ bị ghi đè khi cập nhật). Muốn chỉnh, hãy tạo bản sao của riêng bạn.</div><button class="btn sm primary" data-eact="copy">${icon('copy', 'sm')}Tạo bản sao</button></div>` : ''}
      ${it.managedBy ? `<div class="callout warn" style="margin-bottom:14px">${icon('alert', 'sm')}<div>Mục này do <b>${esc(it.managedBy)}</b> quản lý, có thể bị ghi đè khi ${esc(it.managedBy)} cập nhật.</div></div>` : ''}
      ${!ro ? `<div class="callout" style="margin-bottom:14px">${icon('info', 'sm')}<div>Thay đổi áp dụng từ <b>lần chạy tiếp theo</b> của ${kindWord} này. Mỗi lần lưu, bản cũ được giữ trong tab Lịch sử.</div></div>` : ''}
      <div class="dtabs">
        <button data-etab="basic" class="${E.tab === 'basic' ? 'on' : ''}">Cơ bản</button>
        <button data-etab="raw" class="${E.tab === 'raw' ? 'on' : ''}">File gốc</button>
        <button data-etab="history" class="${E.tab === 'history' ? 'on' : ''}">Lịch sử (${it.historyCount})</button>
      </div>
      <div id="etab"></div>
    </div>
    <div class="d-foot">
      <span id="dirty" class="small muted"></span><span class="spacer"></span>
      ${ro ? '<button class="btn" data-eact="close">Đóng</button>' : `<button class="btn" data-eact="revert">Huỷ thay đổi</button><button class="btn primary" data-eact="save">${icon('save', 'sm')}Lưu</button>`}
    </div>`;
  renderEditorTab();
}

function renderEditorTab() {
  const box = $('#etab');
  const it = E.item;
  const ro = !it.editable;
  if (E.tab === 'basic') {
    const blocked = E.rawDirty;
    const models = MODELS.filter(m => !m.agentOnly || it.kind === 'agent');
    if (E.model && !models.some(m => m.v === E.model)) models.push({ v: E.model, n: E.model, d: 'Giá trị đang có trong file' });
    const extraTools = (E.tools || []).filter(t => !TOOLS.some(([k]) => k === t));
    box.innerHTML = `
      ${blocked ? '<div class="callout warn" style="margin-bottom:14px">Bạn đang sửa ở tab “File gốc”. Hãy lưu hoặc huỷ thay đổi đó trước.</div>' : ''}
      <fieldset ${blocked || ro ? 'disabled' : ''} style="border:0;padding:0;margin:0">
      <div class="field">
        <div class="flabel">Model</div>
        <div class="help">Model mạnh hơn làm tốt hơn, nhưng chậm và tốn chi phí hơn.</div>
        <div class="models">${models.map(m => `<button type="button" class="model ${E.model === m.v ? 'on' : ''}" data-model="${esc(m.v)}"><div class="n">${esc(m.n)}</div><div class="d">${esc(m.d)}</div></button>`).join('')}</div>
      </div>
      <div class="field">
        <label for="e-desc">Khi nào dùng ${it.kind === 'agent' ? 'agent' : 'skill'} này?</label>
        <div class="help">Claude đọc mô tả này để quyết định khi nào ${it.kind === 'agent' ? 'giao việc cho agent' : 'dùng skill'}. Viết rõ loại việc phù hợp.</div>
        <textarea id="e-desc" rows="4">${esc(E.description)}</textarea>
      </div>
      ${it.kind === 'agent' ? `<div class="field">
        <div class="flabel">Công cụ được phép dùng</div>
        <div class="help">Giới hạn công cụ giúp agent an toàn hơn, ví dụ agent chỉ đọc thì không cần “Sửa file” hay “Chạy lệnh”.</div>
        <label class="toggle" style="margin-bottom:10px"><input type="checkbox" id="e-alltools" ${E.tools == null ? 'checked' : ''}> Cho phép dùng tất cả công cụ (giống agent chính)</label>
        ${E.tools == null ? '' : `<div class="tools">${TOOLS.map(([k, l]) => `<label class="tool"><input type="checkbox" data-tool="${k}" ${E.tools.includes(k) ? 'checked' : ''}> ${esc(l)} <small>${k}</small></label>`).join('')}
          ${extraTools.map(k => `<label class="tool"><input type="checkbox" data-tool="${esc(k)}" checked> <small>${esc(k)}</small></label>`).join('')}</div>`}
      </div>` : ''}
      <div class="field">
        <label for="e-body">Quy tắc &amp; hướng dẫn</label>
        <div class="help">“Bản mô tả công việc” mà ${it.kind === 'agent' ? 'agent' : 'Claude'} đọc mỗi lần làm việc. Viết bằng lời bình thường là được.</div>
        <textarea id="e-body" class="rules">${esc(E.body)}</textarea>
        ${ro ? '' : `<div class="quickrule"><input type="text" class="input" id="e-quick" placeholder="Thêm nhanh một quy tắc, ví dụ: Luôn trả lời bằng tiếng Việt"><button type="button" class="btn" data-eact="quick">${icon('plus', 'sm')}Thêm</button></div>`}
      </div>
      </fieldset>`;
  } else if (E.tab === 'raw') {
    const blocked = basicDirty();
    box.innerHTML = `
      <div class="callout" style="margin-bottom:12px">${icon('info', 'sm')}<div>Toàn bộ nội dung file. Phần giữa hai dòng <code>---</code> ở đầu là phần cấu hình.</div></div>
      ${blocked ? '<div class="callout warn" style="margin-bottom:12px">Bạn có thay đổi chưa lưu ở tab “Cơ bản”. Hãy lưu trước khi sửa file gốc.</div>' : ''}
      <div class="field"><textarea id="e-raw" class="raw" ${ro || blocked ? 'readonly' : ''} spellcheck="false">${esc(E.raw)}</textarea></div>`;
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

$('#drawer').addEventListener('click', async e => {
  if (e.target === $('#drawer')) return closeEditor();
  const t = e.target;
  const tab = t.closest('[data-etab]');
  if (tab) { E.tab = tab.dataset.etab; $$('[data-etab]').forEach(b => b.classList.toggle('on', b === tab)); return renderEditorTab(); }
  const mb = t.closest('[data-model]');
  if (mb && !mb.disabled) { E.model = mb.dataset.model; $$('[data-model]').forEach(b => b.classList.toggle('on', b === mb)); return updateDirty(); }
  const view = t.closest('[data-view]');
  if (view) {
    const { raw } = await api(`/api/items/${E.item.id}/version?ts=${view.dataset.view}`);
    return modal({ title: `Bản lúc ${new Date(Number(view.dataset.view)).toLocaleString('vi-VN')}`, html: `<pre style="max-height:50vh;overflow:auto;background:var(--panel-2);padding:12px;border-radius:8px;white-space:pre-wrap">${esc(raw)}</pre>`, okText: 'Đóng', cancelText: '' });
  }
  const rs = t.closest('[data-restore]');
  if (rs) {
    const ok = await modal({ title: 'Khôi phục bản này?', text: 'Nội dung hiện tại sẽ được thay bằng bản đã chọn. Bản hiện tại vẫn được giữ trong lịch sử.', okText: 'Khôi phục' });
    if (!ok) return;
    try { await api(`/api/items/${E.item.id}/restore`, { ts: rs.dataset.restore }); toast('Đã khôi phục.'); S.items = null; return openEditor(E.item.id); } catch (err) { return toast(err.message, 'error'); }
  }
  const act = t.closest('[data-eact]')?.dataset.eact;
  if (act === 'close') return closeEditor();
  if (act === 'revert') { const id = E.item.id; E = null; return openEditor(id); }
  if (act === 'quick') {
    const inp = $('#e-quick');
    const rule = inp.value.trim();
    if (!rule) return inp.focus();
    const heading = '## Quy tắc bổ sung';
    let body = E.body.replace(/\s+$/, '');
    if (!body.includes(heading)) body += `\n\n${heading}\n`;
    E.body = `${body}\n- ${rule}\n`;
    $('#e-body').value = E.body;
    $('#e-body').scrollTop = $('#e-body').scrollHeight;
    inp.value = '';
    toast('Đã thêm quy tắc. Nhớ bấm “Lưu”.');
    return updateDirty();
  }
  if (act === 'copy') {
    try { const { id } = await api(`/api/items/${E.item.id}/copy`, {}); toast('Đã tạo bản sao trong nhóm “Của bạn”.'); S.items = null; E = null; await openEditor(id); if (S.tab === 'team') renderTeam(); }
    catch (err) { toast(err.message, 'error'); }
    return;
  }
  if (act === 'save') return saveEditor();
});
$('#drawer').addEventListener('input', e => {
  if (!E) return;
  const t = e.target;
  if (t.id === 'e-desc') E.description = t.value;
  else if (t.id === 'e-body') E.body = t.value;
  else if (t.id === 'e-raw') { E.raw = t.value; E.rawDirty = E.raw !== E.item.raw; }
  updateDirty();
});
$('#drawer').addEventListener('change', e => {
  if (!E) return;
  const t = e.target;
  if (t.id === 'e-alltools') { E.tools = t.checked ? null : (E.item.tools.length ? [...E.item.tools] : ['Read', 'Grep', 'Glob']); return renderEditorTab(); }
  if (t.dataset.tool) {
    const k = t.dataset.tool;
    E.tools = t.checked ? [...new Set([...E.tools, k])] : E.tools.filter(x => x !== k);
    updateDirty();
  }
});
$('#drawer').addEventListener('keydown', e => {
  if (e.target.id === 'e-quick' && e.key === 'Enter') { e.preventDefault(); $('[data-eact="quick"]').click(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveEditor(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && E && $('#modal').hidden) closeEditor(); });

async function saveEditor() {
  if (!E || !E.item.editable) return;
  if (!anyDirty()) return toast('Chưa có gì thay đổi.');
  if (E.tools && !E.tools.length && E.item.kind === 'agent') return toast('Hãy chọn ít nhất một công cụ, hoặc bật “Cho phép tất cả”.', 'error');
  const changes = E.rawDirty ? { raw: E.raw } : { model: E.model, description: E.description, body: E.body, ...(E.item.kind === 'agent' ? { tools: E.tools } : {}) };
  try {
    const out = await api(`/api/items/${E.item.id}`, { changes, mtime: E.item.mtime });
    toast(out.changed ? 'Đã lưu. Áp dụng từ lần chạy tiếp theo.' : 'Không có gì thay đổi.');
    const tab = E.tab;
    E = { item: out.item, tab, rawDirty: false, model: out.item.model, description: out.item.description, body: out.item.body, tools: out.item.allToolsAllowed ? null : [...out.item.tools], raw: out.item.raw };
    renderEditor();
    await loadItems(true);
    if (S.tab === 'team') renderTeam();
  } catch (err) { toast(err.message, 'error'); }
}

// ================================================================== settings
function renderSettings() {
  const root = $('#view-settings');
  const c = S.config;
  const h = S.hooks;
  const mode = c.approvalMode || 'watch';
  const notif = 'Notification' in window ? Notification.permission : 'unsupported';
  root.innerHTML = `<div class="settings">
    <h1 class="h1">Cài đặt</h1>
    <div class="card">
      <div class="h3">Kết nối với Claude Code</div>
      ${h.connected ? `
        <div class="callout ok" style="margin:12px 0">${icon('check', 'sm')}<div><b>Đã kết nối.</b> Các phiên Claude Code sẽ tự hiện trong tab “Hoạt động”.</div></div>
        <button class="btn danger" data-cact="uninstall">Ngắt kết nối</button>` : `
        <p class="muted" style="margin:6px 0 14px">Claude Code sẽ gửi từng bước làm việc về bảng điều khiển. Bảng điều khiển thêm vài dòng vào file cài đặt của Claude Code và tự sao lưu bản cũ. Khi bảng điều khiển tắt, Claude Code vẫn chạy bình thường.</p>
        ${h.error ? `<div class="callout bad" style="margin-bottom:12px">${esc(h.error)}</div>` : ''}
        <button class="btn primary lg" data-cact="install">${icon('plug', 'sm')}Kết nối với Claude Code</button>`}
    </div>
    <div class="card">
      <div class="h3">Khi nào agent cần bạn duyệt?</div>
      <div class="muted small">Chỉ hỏi khi trang này đang mở. Nếu bạn không trả lời kịp, Claude Code hỏi lại trong Terminal như bình thường.</div>
      <div class="opts">
        ${[['watch', 'Chỉ theo dõi', 'Agent tự làm như bình thường, bạn chỉ xem các bước.'],
          ['risky', 'Hỏi tôi trước khi sửa file hoặc chạy lệnh', 'Đọc và tìm kiếm thì tự làm. Sửa, tạo file hay chạy lệnh thì chờ bạn bấm “Cho phép”.'],
          ['all', 'Hỏi tôi trước mọi bước', 'Mọi công cụ agent định dùng đều chờ bạn duyệt. Chặt chẽ nhất nhưng phải bấm nhiều.']]
          .map(([v, n, d]) => `<button class="opt ${mode === v ? 'on' : ''}" data-mode="${v}"><span class="radio"></span><div><div class="n">${n}</div><div class="d">${d}</div></div></button>`).join('')}
      </div>
      <div class="row" style="margin-top:14px"><span>Chờ bạn trả lời tối đa</span>
        <select class="select" id="timeout" style="min-width:120px">${[[60, '1 phút'], [180, '3 phút'], [300, '5 phút'], [600, '10 phút']].map(([v, l]) => `<option value="${v}" ${Number(c.approvalTimeoutSec) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="card">
      <div class="h3">Model của cửa sổ chính</div>
      <div class="muted small" style="margin-bottom:12px">Model Claude Code dùng khi bạn mở phiên mới. Agent đặt “Giống cửa sổ chính” cũng dùng model này.</div>
      <select class="select" id="main-model">${[['', 'Mặc định của Claude Code'], ['opus', 'Opus · thông minh nhất'], ['sonnet', 'Sonnet · cân bằng'], ['haiku', 'Haiku · nhanh, tiết kiệm'], ['fable', 'Fable'], ['opusplan', 'Opus khi lập kế hoạch, Sonnet khi làm']]
        .map(([v, l]) => `<option value="${v}" ${S.mainModel === v ? 'selected' : ''}>${l}</option>`).join('')}
        ${S.mainModel && !['opus', 'sonnet', 'haiku', 'fable', 'opusplan'].includes(S.mainModel) ? `<option selected value="${esc(S.mainModel)}">${esc(S.mainModel)}</option>` : ''}</select>
    </div>
    <div class="card">
      <div class="h3">Thông báo</div>
      <div class="muted small" style="margin-bottom:12px">Hiện thông báo trên máy khi agent cần bạn duyệt, kể cả khi bạn đang ở cửa sổ khác.</div>
      ${notif === 'granted' ? '<span class="chip ok">Đã bật thông báo</span>' : notif === 'denied' ? '<span class="chip bad">Trình duyệt đang chặn thông báo cho trang này</span>' : notif === 'unsupported' ? '<span class="chip">Trình duyệt không hỗ trợ</span>' : '<button class="btn" data-cact="notif">Bật thông báo</button>'}
    </div>
    <div class="card">
      <div class="h3">Thư mục dự án</div>
      <div class="muted small" style="margin-bottom:12px">Bảng điều khiển tự tìm agent và skill trong các dự án bạn đã mở Claude Code. Muốn thêm dự án khác thì dán đường dẫn thư mục vào đây.</div>
      ${(c.extraProjects || []).map((p, i) => `<div class="list-line"><span style="flex:1">${esc(p)}</span><button class="btn ghost sm" data-rmproj="${i}">Xoá</button></div>`).join('')}
      <div class="row"><input type="text" id="proj" class="input" style="flex:1" placeholder="/Users/ban/du-an-cua-toi"><button class="btn" data-cact="addproj">${icon('plus', 'sm')}Thêm</button></div>
    </div>
  </div>`;
}

$('#view-settings').addEventListener('click', async e => {
  const t = e.target;
  try {
    const m = t.closest('[data-mode]');
    if (m) { await api('/api/config', { approvalMode: m.dataset.mode }); S.config.approvalMode = m.dataset.mode; renderSettings(); return toast('Đã lưu chế độ duyệt.'); }
    const rm = t.closest('[data-rmproj]');
    if (rm) { const list = (S.config.extraProjects || []).filter((_, i) => i !== Number(rm.dataset.rmproj)); const { config } = await api('/api/config', { extraProjects: list }); S.config = config; S.items = null; return renderSettings(); }
    const act = t.closest('[data-cact]')?.dataset.cact;
    if (act === 'install' || act === 'uninstall') return hooksAction(act);
    if (act === 'notif') { await Notification.requestPermission(); return renderSettings(); }
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
  try {
    if (e.target.id === 'main-model') { const { mainModel } = await api('/api/main-model', { model: e.target.value }); S.mainModel = mainModel; toast('Đã đổi model cho các phiên mới.'); }
    if (e.target.id === 'timeout') { const { config } = await api('/api/config', { approvalTimeoutSec: Number(e.target.value) }); S.config = config; toast('Đã lưu.'); }
  } catch (err) { toast(err.message, 'error'); }
});

async function hooksAction(act) {
  if (act === 'uninstall') {
    const ok = await modal({ title: 'Ngắt kết nối với Claude Code?', text: 'Bảng điều khiển sẽ không còn thấy các bước mới, không duyệt hay dừng agent được nữa. Có thể kết nối lại bất cứ lúc nào.', okText: 'Ngắt kết nối', okClass: 'danger-solid' });
    if (!ok) return;
  }
  try {
    S.hooks = await api(`/api/hooks/${act}`, {});
    toast(act === 'install' ? 'Đã kết nối. Giao việc cho Claude Code để xem sơ đồ.' : 'Đã ngắt kết nối.');
    renderAll();
  } catch (err) { toast(err.message, 'error'); }
}

// ================================================================== wiring
$$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('#conn').addEventListener('click', () => setTab('settings'));
document.addEventListener('click', e => { if (e.target.closest('[data-global="install"]')) hooksAction('install'); });
window.addEventListener('resize', () => { if (S.tab === 'live') scheduleLive(); });
setInterval(() => { if (S.tab === 'live') scheduleLive(); }, 30000);

renderAll();
connect();
