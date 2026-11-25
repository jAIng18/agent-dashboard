'use strict';
// Agent Dashboard: live view of Claude Code agents, approvals, and a friendly editor for agents & skills.
// Zero dependencies. Listens on 127.0.0.1 only.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { describeTool, short, RISKY, NEVER_ASK } = require('./lib/describe');
const items = require('./lib/items');
const claudeSettings = require('./lib/claude-settings');

const PORT = Number(process.env.AGENT_DASHBOARD_PORT || 4319);
const HOST = '127.0.0.1';
const DATA = path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(DATA, 'config.json');
const EVENTS_FILE = path.join(DATA, 'events.jsonl');
const MAX_SESSIONS = 60;
const MAX_STEPS = 1500;

fs.mkdirSync(DATA, { recursive: true });
items.init(DATA);

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
let config = { approvalMode: 'watch', approvalTimeoutSec: 600, extraProjects: [], hidden: [], ...readJson(CONFIG_FILE, {}) };
const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

// ---------------------------------------------------------------- live state
const sessions = new Map();
const approvals = new Map(); // id -> { meta, finish }
const clients = new Set();
let seq = 0;
const newId = () => Date.now().toString(36) + (seq++).toString(36);

function trunc(v, n) {
  if (v == null) return v;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function summarizeResponse(r) {
  if (r == null) return '';
  if (typeof r === 'string') return r;
  if (typeof r.stdout === 'string') return r.stdout + (r.stderr ? `\n${r.stderr}` : '');
  if (typeof r.content === 'string') return r.content;
  if (Array.isArray(r.content)) return r.content.map(c => c.text || '').join('\n');
  if (r.file && typeof r.file.content === 'string') return `(Đã đọc ${r.file.numLines || r.file.content.split('\n').length} dòng)`;
  if (typeof r.result === 'string') return r.result;
  return JSON.stringify(r);
}

// Keeps the event log small: long text fields are cut before being written to disk.
function slim(p) {
  const out = { ...p };
  if ('tool_response' in out) out.tool_response = trunc(summarizeResponse(out.tool_response), 1500);
  if (out.tool_input && typeof out.tool_input === 'object') {
    out.tool_input = Object.fromEntries(Object.entries(out.tool_input).map(([k, v]) =>
      [k, typeof v === 'string' ? trunc(v, 4000) : v]));
  }
  if (typeof out.prompt === 'string') out.prompt = trunc(out.prompt, 4000);
  delete out.transcript_path; delete out.agent_transcript_path;
  return out;
}

function getSession(p) {
  const id = p.session_id || 'unknown';
  let s = sessions.get(id);
  if (!s) {
    s = {
      id, cwd: p.cwd || '', project: p.cwd ? path.basename(p.cwd) : 'Không rõ thư mục', title: '',
      status: 'idle', startedAt: p._ts, updatedAt: p._ts, steps: [], agents: [], todos: [], tasks: {},
      stopRequested: false, messages: [], allowTools: [],
    };
    sessions.set(id, s);
    if (sessions.size > MAX_SESSIONS) {
      const oldest = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
      sessions.delete(oldest.id);
    }
  }
  if (p.cwd && !s.cwd) { s.cwd = p.cwd; s.project = path.basename(p.cwd); }
  s.updatedAt = p._ts;
  return s;
}

const meta = s => ({ ...s, steps: undefined, messages: s.messages.length, stepCount: s.steps.length });

function send(obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const c of clients) c.write(line);
}
const pushSession = s => { if (!replaying) send({ type: 'session', session: meta(s) }); };
const pushStep = (s, step) => { if (!replaying) send({ type: 'step', sessionId: s.id, step }); };
const pushApprovals = () => send({ type: 'approvals', approvals: [...approvals.values()].map(a => a.meta) });

function addStep(s, step) {
  step.id = step.id || newId();
  step.ts = step.ts || Date.now();
  s.steps.push(step);
  if (s.steps.length > MAX_STEPS) s.steps.splice(0, s.steps.length - MAX_STEPS);
  pushStep(s, step);
  return step;
}
const findStep = (s, toolUseId) => toolUseId && [...s.steps].reverse().find(x => x.toolUseId === toolUseId);

function laneOf(s, p) {
  if (!p.agent_id) return null;
  let ag = s.agents.find(a => a.id === p.agent_id);
  if (!ag) {
    ag = s.agents.find(a => !a.id && a.status === 'starting' && (!p.agent_type || a.type === p.agent_type));
    if (ag) { ag.id = p.agent_id; ag.status = 'working'; }
    else { ag = { key: newId(), id: p.agent_id, type: p.agent_type || 'agent', status: 'working', startedAt: p._ts }; s.agents.push(ag); }
  }
  return ag.key;
}

function laneName(s, key) {
  const a = key && s.agents.find(x => x.key === key);
  return a ? a.type : 'Agent chính';
}

function processEvent(p) {
  const s = getSession(p);
  const ev = p.hook_event_name;
  const input = p.tool_input || {};
  switch (ev) {
    case 'SessionStart': {
      const label = { startup: 'Bắt đầu phiên làm việc', resume: 'Tiếp tục phiên cũ', clear: 'Bắt đầu lại từ đầu', compact: 'Thu gọn trí nhớ hội thoại' }[p.source];
      addStep(s, { kind: 'system', mark: p.source === 'compact' ? 'note' : 'session-start', icon: p.source === 'compact' ? '🗜️' : '🚀', text: label || 'Bắt đầu phiên làm việc', ts: p._ts });
      if (p.source !== 'compact') s.status = 'idle';
      break;
    }
    case 'UserPromptSubmit':
      if (/^\s*<[a-z][\w-]*[\s>]/i.test(p.prompt || '')) { // system wrappers (task results, agent hand-backs…), not something you typed
        const done = /<status>(\w+)<\/status>/.exec(p.prompt || '');
        const summary = /<summary>([\s\S]*?)<\/summary>/.exec(p.prompt || '');
        const isAgentMsg = /^\s*<agent-message/i.test(p.prompt || '');
        const text = isAgentMsg ? 'Agent phụ gửi kết quả về'
          : `Tác vụ chạy nền ${done && done[1] === 'completed' ? 'đã xong' : done && done[1] === 'failed' ? 'bị lỗi' : 'báo tin'}${summary ? ': ' + short(summary[1], 100) : ''}`;
        addStep(s, { kind: 'system', mark: 'note', icon: '🔔', text, detail: trunc(p.prompt, 4000), ts: p._ts });
        s.status = 'working';
        break;
      }
      if (!s.title) s.title = short(p.prompt, 90);
      s.stopRequested = false;
      s.status = 'working';
      addStep(s, { kind: 'prompt', icon: '💬', promptText: short(p.prompt, 400), text: `Bạn yêu cầu: ${short(p.prompt, 160)}`, detail: trunc(p.prompt, 4000), ts: p._ts });
      break;
    case 'PreToolUse': {
      const lane = laneOf(s, p);
      const d = describeTool(p.tool_name, input);
      addStep(s, { kind: 'tool', tool: p.tool_name, lane, status: 'running', toolUseId: p.tool_use_id, ...d, detail: trunc(d.detail, 4000), ts: p._ts });
      if (!['stopped', 'approval'].includes(s.status)) s.status = 'working';
      if (p.tool_name === 'Agent' || p.tool_name === 'Task') {
        s.agents.push({ key: newId(), id: null, type: input.subagent_type || 'general-purpose', description: input.description || '', model: input.model || '', status: 'starting', toolUseId: p.tool_use_id, startedAt: p._ts });
      }
      if (p.tool_name === 'TodoWrite' && Array.isArray(input.todos)) {
        s.todos = input.todos.map(t => ({ content: t.content || t.activeForm || '', activeForm: t.activeForm, status: t.status }));
      }
      if (p.tool_name === 'TaskUpdate' && input.taskId && s.tasks[input.taskId]) {
        if (input.status) s.tasks[input.taskId].status = input.status;
        if (input.subject) s.tasks[input.taskId].content = input.subject;
        if (input.status === 'deleted') delete s.tasks[input.taskId];
      }
      break;
    }
    case 'PostToolUse':
    case 'PostToolUseFailure': {
      const failed = ev === 'PostToolUseFailure';
      const step = findStep(s, p.tool_use_id);
      const result = trunc(failed ? (p.error || summarizeResponse(p.tool_response)) : summarizeResponse(p.tool_response), 1500);
      if (step) {
        step.status = failed ? 'failed' : 'done';
        step.result = result;
        step.endedAt = p._ts;
        pushStep(s, step);
      }
      const ag = s.agents.find(a => a.toolUseId && a.toolUseId === p.tool_use_id);
      // Background agents return right away ("async launched"); they finish later on SubagentStop.
      const launchedInBackground = /async|background|launched/i.test(typeof p.tool_response === 'string' ? p.tool_response : JSON.stringify(p.tool_response || ''));
      if (ag && (failed || !launchedInBackground)) { ag.status = failed ? 'failed' : 'done'; ag.endedAt = p._ts; }
      if (ag && step && launchedInBackground && !failed) { step.text = step.text.replace('Giao việc cho agent', 'Đã giao việc (chạy nền) cho agent'); step.result = 'Agent đang làm ở chế độ chạy nền.'; pushStep(s, step); }
      if (p.tool_name === 'TaskCreate' && !failed) {
        const r = p.tool_response;
        const id = r?.task?.id || (/#(\d+)/.exec(typeof r === 'string' ? r : JSON.stringify(r || '')) || [])[1];
        if (id) s.tasks[id] = { content: input.subject || '', status: 'pending' };
      }
      break;
    }
    case 'SubagentStart': {
      const key = laneOf(s, p);
      const ag = s.agents.find(a => a.key === key);
      addStep(s, { kind: 'agent', mark: 'subagent-start', icon: '👥', lane: key, text: `Agent “${ag.type}” bắt đầu làm việc${ag.description ? ': ' + ag.description : ''}`, link: { type: 'agent', name: ag.type }, ts: p._ts });
      break;
    }
    case 'SubagentStop': {
      const ag = s.agents.find(a => a.id === p.agent_id) || [...s.agents].reverse().find(a => a.status === 'working');
      if (ag) {
        ag.status = 'done'; ag.endedAt = p._ts;
        addStep(s, { kind: 'agent', mark: 'subagent-end', icon: '✅', lane: ag.key, text: `Agent “${ag.type}” đã xong việc${ag.description ? ': ' + ag.description : ''}`, ts: p._ts });
      }
      break;
    }
    case 'Notification': {
      const msg = p.message || '';
      if (/waiting for your input/i.test(msg)) { if (s.status === 'working') s.status = 'done'; break; }
      s.status = /permission|approval/i.test(msg) ? 'needs-permission' : 'waiting';
      const text = /permission/i.test(msg) ? 'Đang chờ bạn cho phép trong cửa sổ Claude Code' : short(msg, 140);
      addStep(s, { kind: 'system', mark: 'note', icon: '🔔', text, detail: msg, ts: p._ts });
      break;
    }
    case 'Stop':
      for (const st of s.steps) if (st.status === 'running' && !st.lane) { st.status = 'skipped'; pushStep(s, st); }
      if (s.status !== 'stopped') s.status = 'done';
      addStep(s, { kind: 'system', mark: 'turn-end', icon: '🏁', text: 'Xong lượt này · đang chờ bạn giao việc tiếp', ts: p._ts });
      break;
    case 'SessionEnd':
      s.status = 'ended';
      addStep(s, { kind: 'system', mark: 'session-end', icon: '🚪', text: 'Phiên làm việc đã đóng', ts: p._ts });
      break;
    default: break;
  }
  return s;
}

function needsApproval(s, tool) {
  if (!clients.size) return false; // nobody is looking at the dashboard: don't make the agent wait
  if (NEVER_ASK.has(tool) || s.allowTools.includes(tool)) return false;
  if (config.approvalMode === 'all') return true;
  if (config.approvalMode === 'risky') return RISKY.has(tool);
  return false;
}

function waitApproval(s, step, res) {
  return new Promise(resolve => {
    const id = newId();
    const timeoutMs = Math.max(30, Number(config.approvalTimeoutSec) || 600) * 1000;
    const a = {
      id, stepId: step.id, sessionId: s.id, project: s.project, title: s.title, tool: step.tool, icon: step.icon,
      text: step.text, detail: step.detail, who: laneName(s, step.lane), createdAt: Date.now(), expiresAt: Date.now() + timeoutMs,
    };
    step.status = 'awaiting';
    s.status = 'approval';
    const timer = setTimeout(() => finish(null), timeoutMs);
    function finish(decision, note) {
      if (!approvals.has(id)) return;
      clearTimeout(timer);
      approvals.delete(id);
      s.status = [...approvals.values()].some(x => x.meta.sessionId === s.id) ? 'approval' : 'working';
      if (decision === 'allow') {
        step.status = 'running';
        resolve({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: 'Đã được duyệt trên Bảng điều khiển Agent' } });
      } else if (decision === 'deny') {
        step.status = 'denied';
        step.result = note ? `Bạn đã từ chối. Lý do: ${note}` : 'Bạn đã từ chối bước này.';
        resolve({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: note ? `Người dùng từ chối bước này. Lý do: ${note}` : 'Người dùng đã từ chối bước này trên bảng điều khiển. Hãy chọn cách khác hoặc hỏi lại người dùng.' } });
      } else {
        step.status = 'running';
        resolve({}); // timed out or Claude stopped waiting: fall back to Claude Code's normal behaviour
      }
      pushStep(s, step); pushSession(s); pushApprovals();
    }
    approvals.set(id, { meta: a, finish });
    res.on('close', () => finish(null));
    pushStep(s, step); pushSession(s); pushApprovals();
  });
}

function takeMessages(s) {
  const text = s.messages.map(m => `- ${m}`).join('\n');
  s.messages = [];
  addStep(s, { kind: 'system', mark: 'message', icon: '📨', text: 'Agent đã nhận lời nhắn của bạn' });
  return `Người dùng vừa gửi lời nhắn qua Bảng điều khiển Agent. Hãy đọc và làm theo:\n${text}`;
}

async function handleHook(p, res) {
  p._ts = Date.now();
  fs.appendFile(EVENTS_FILE, JSON.stringify(slim(p)) + '\n', () => {});
  const s = processEvent(p);
  const ev = p.hook_event_name;
  const step = ev === 'PreToolUse' ? findStep(s, p.tool_use_id) || s.steps[s.steps.length - 1] : null;
  let out = {};

  if (s.stopRequested && ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'SubagentStart'].includes(ev)) {
    s.stopRequested = false;
    s.status = 'stopped';
    if (step) { step.status = 'denied'; step.result = 'Không làm vì bạn đã bấm Dừng.'; pushStep(s, step); }
    addStep(s, { kind: 'system', mark: 'stopped', icon: '⏹️', text: 'Đã dừng theo yêu cầu của bạn' });
    out = { continue: false, stopReason: 'Đã dừng từ Bảng điều khiển Agent' };
    if (ev === 'PreToolUse') out.hookSpecificOutput = { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Người dùng đã bấm Dừng trên bảng điều khiển.' };
  } else if (ev === 'Stop' && s.stopRequested) {
    s.stopRequested = false;
    s.status = 'stopped';
  } else if (s.messages.length && (ev === 'PostToolUse' || ev === 'UserPromptSubmit')) {
    out = { hookSpecificOutput: { hookEventName: ev, additionalContext: takeMessages(s) } };
  } else if (s.messages.length && ev === 'Stop' && !p.stop_hook_active) {
    s.status = 'working';
    const last = s.steps[s.steps.length - 1];
    if (last && last.mark === 'turn-end') { last.text = 'Agent định dừng nhưng làm tiếp theo lời nhắn của bạn'; last.icon = '↪️'; last.mark = 'note'; pushStep(s, last); }
    out = { decision: 'block', reason: takeMessages(s) };
  } else if (ev === 'PreToolUse' && step && needsApproval(s, p.tool_name)) {
    pushSession(s);
    out = await waitApproval(s, step, res);
  }
  pushSession(s);
  return out;
}

// ---------------------------------------------------------------- replay history on start
let replaying = false;
function replay() {
  if (!fs.existsSync(EVENTS_FILE)) return;
  let text = fs.readFileSync(EVENTS_FILE, 'utf8');
  if (text.length > 30 * 1024 * 1024) { // keep the log from growing forever
    text = text.slice(text.length - 15 * 1024 * 1024);
    text = text.slice(text.indexOf('\n') + 1);
    fs.writeFileSync(EVENTS_FILE, text);
  }
  replaying = true;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { processEvent(JSON.parse(line)); } catch {}
  }
  replaying = false;
  for (const s of sessions.values()) {
    for (const st of s.steps) if (st.status === 'running' || st.status === 'awaiting') st.status = 'unknown';
    if (['working', 'approval'].includes(s.status)) s.status = 'unknown';
  }
}

// ---------------------------------------------------------------- http
function projectDirs() {
  return [...new Set([...[...sessions.values()].map(s => s.cwd).filter(Boolean), ...config.extraProjects])];
}

function stateSnapshot() {
  const list = [...sessions.values()].filter(s => !config.hidden.includes(s.id))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(s => ({ ...meta(s), steps: s.steps.slice(-400) }));
  return {
    sessions: list, approvals: [...approvals.values()].map(a => a.meta),
    config, hooks: claudeSettings.status(), mainModel: claudeSettings.getModel(),
  };
}

function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new items.UserError('Dữ liệu gửi lên không hợp lệ.')); }
    });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  if (res.writableEnded) return;
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

const allowedHosts = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;
  // Guard against other websites in your browser talking to this local server.
  if (!allowedHosts.has(req.headers.host)) { res.writeHead(403); return res.end(); }
  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);
  if (req.method !== 'GET' && !req.headers['x-agent-dashboard']) return json(res, 403, { error: 'forbidden' });

  const m = (re) => re.exec(pathname);
  let r;

  if (req.method === 'POST' && pathname === '/api/hook') {
    const p = await readBody(req);
    return json(res, 200, await handleHook(p, res));
  }
  if (req.method === 'GET' && pathname === '/api/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'hello' })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/state') return json(res, 200, stateSnapshot());

  if (req.method === 'GET' && (r = m(/^\/api\/sessions\/([^/]+)$/))) {
    const s = sessions.get(decodeURIComponent(r[1]));
    return s ? json(res, 200, { ...meta(s), steps: s.steps }) : json(res, 404, { error: 'Không tìm thấy phiên.' });
  }
  if (req.method === 'POST' && (r = m(/^\/api\/approvals\/([^/]+)$/))) {
    const body = await readBody(req);
    const a = approvals.get(r[1]);
    if (!a) return json(res, 404, { error: 'Yêu cầu này đã hết hạn hoặc đã được xử lý.' });
    if (body.decision === 'always') {
      const s = sessions.get(a.meta.sessionId);
      if (s && !s.allowTools.includes(a.meta.tool)) s.allowTools.push(a.meta.tool);
      a.finish('allow');
    } else a.finish(body.decision === 'allow' ? 'allow' : 'deny', short(body.note || '', 500));
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && (r = m(/^\/api\/sessions\/([^/]+)\/(stop|cancel-stop|message|hide|reset-trust)$/))) {
    const s = sessions.get(decodeURIComponent(r[1]));
    if (!s) return json(res, 404, { error: 'Không tìm thấy phiên.' });
    const action = r[2];
    if (action === 'stop') {
      s.stopRequested = true;
      for (const a of [...approvals.values()]) if (a.meta.sessionId === s.id) a.finish('deny', 'Người dùng đã bấm Dừng.');
      addStep(s, { kind: 'system', mark: 'note', icon: '✋', text: 'Bạn đã bấm Dừng · agent sẽ dừng ở bước kế tiếp' });
    } else if (action === 'cancel-stop') {
      s.stopRequested = false;
      addStep(s, { kind: 'system', mark: 'note', icon: '↩️', text: 'Đã huỷ yêu cầu dừng' });
    } else if (action === 'message') {
      const body = await readBody(req);
      const text = String(body.text || '').trim();
      if (!text) return json(res, 400, { error: 'Lời nhắn đang trống.' });
      s.messages.push(short(text, 2000));
      addStep(s, { kind: 'system', mark: 'message', icon: '✉️', text: `Bạn nhắn: ${short(text, 140)} · agent sẽ đọc ở bước kế tiếp`, detail: text });
    } else if (action === 'hide') {
      if (!config.hidden.includes(s.id)) config.hidden.push(s.id);
      config.hidden = config.hidden.slice(-500);
      saveConfig();
      send({ type: 'hidden', sessionId: s.id });
      return json(res, 200, { ok: true });
    } else if (action === 'reset-trust') {
      s.allowTools = [];
    }
    pushSession(s);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/items') return json(res, 200, { items: items.scan(projectDirs()) });
  if (req.method === 'POST' && pathname === '/api/items/bulk-model') {
    const body = await readBody(req);
    items.scan(projectDirs());
    return json(res, 200, { results: items.setModelMany(body.ids || [], body.model || '') });
  }
  if ((r = m(/^\/api\/items\/([0-9a-f]{12})(?:\/(history|restore|copy|version))?$/))) {
    const [, id, sub] = r;
    if (!items.get(id)) items.scan(projectDirs());
    if (req.method === 'GET' && !sub) { const it = items.get(id); return it ? json(res, 200, it) : json(res, 404, { error: 'Không tìm thấy mục này.' }); }
    if (req.method === 'GET' && sub === 'history') return json(res, 200, { history: items.history(id) });
    if (req.method === 'GET' && sub === 'version') {
      const text = items.historyVersion(id, url.searchParams.get('ts'));
      return text == null ? json(res, 404, { error: 'Không tìm thấy bản lưu.' }) : json(res, 200, { raw: text });
    }
    if (req.method === 'POST' && !sub) {
      const body = await readBody(req);
      const out = items.save(id, body.changes || {}, body.mtime);
      return json(res, 200, { ...out, item: items.get(id) });
    }
    if (req.method === 'POST' && sub === 'restore') {
      const body = await readBody(req);
      items.restore(id, body.ts);
      return json(res, 200, { item: items.get(id) });
    }
    if (req.method === 'POST' && sub === 'copy') {
      const newId = items.copyToUser(id);
      items.scan(projectDirs());
      return json(res, 200, { id: newId });
    }
  }

  if (pathname === '/api/config') {
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (['watch', 'risky', 'all'].includes(body.approvalMode)) config.approvalMode = body.approvalMode;
      if (Number(body.approvalTimeoutSec) >= 30) config.approvalTimeoutSec = Math.min(600, Number(body.approvalTimeoutSec));
      if (Array.isArray(body.extraProjects)) config.extraProjects = body.extraProjects.map(String).filter(d => fs.existsSync(d));
      saveConfig();
      send({ type: 'config', config });
    }
    return json(res, 200, { config });
  }
  if (req.method === 'POST' && pathname === '/api/hooks/install') { const st = claudeSettings.install(); send({ type: 'hooks', hooks: st }); return json(res, 200, st); }
  if (req.method === 'POST' && pathname === '/api/hooks/uninstall') { const st = claudeSettings.uninstall(); send({ type: 'hooks', hooks: st }); return json(res, 200, st); }
  if (req.method === 'POST' && pathname === '/api/main-model') {
    const body = await readBody(req);
    const allowed = ['', 'opus', 'sonnet', 'haiku', 'fable', 'opusplan'];
    if (!allowed.includes(body.model || '')) return json(res, 400, { error: 'Model không hợp lệ.' });
    return json(res, 200, { mainModel: claudeSettings.setModel(body.model || '') });
  }
  return json(res, 404, { error: 'Không có đường dẫn này.' });
}

replay();
const server = http.createServer((req, res) => {
  route(req, res).catch(err => {
    const status = err instanceof items.UserError ? err.status : 500;
    if (status === 500) console.error(err);
    json(res, status, { error: status === 500 ? `Có lỗi xảy ra: ${err.message}` : err.message });
  });
});
server.requestTimeout = 0; // approval requests may wait several minutes
server.headersTimeout = 60000;
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Bảng điều khiển đã chạy sẵn tại http://${HOST}:${PORT}`);
    process.exit(0);
  }
  throw err;
});
server.listen(PORT, HOST, () => {
  console.log(`✅ Bảng điều khiển Agent đang chạy: http://${HOST}:${PORT}`);
  console.log('   Giữ cửa sổ này mở. Đóng cửa sổ = tắt bảng điều khiển (Claude Code vẫn chạy bình thường).');
});
