'use strict';
// Agent Dashboard: shows, step by step, what each loop of Claude Code is doing and which agents / skills it uses,
// and lets you change an agent's or skill's model and instructions without opening any Markdown file.
// It only watches: it never blocks or changes what Claude Code does. Zero dependencies. Listens on 127.0.0.1 only.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { describeTool, short } = require('./lib/describe');
const items = require('./lib/items');
const claudeSettings = require('./lib/claude-settings');

const PORT = Number(process.env.AGENT_DASHBOARD_PORT || 4319);
const HOST = '127.0.0.1';
const DATA = path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(DATA, 'config.json');
const EVENTS_FILE = path.join(DATA, 'events.jsonl');
const MAX_SESSIONS = 60;
const MAX_STEPS = 3000;

fs.mkdirSync(DATA, { recursive: true });
items.init(DATA);

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
let config = { extraProjects: [], hidden: [], ...readJson(CONFIG_FILE, {}) };
const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

// ---------------------------------------------------------------- live state
const sessions = new Map();
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

// Agent results carry the model that really ran and the agent's id; keep them even after the text is cut.
function agentFacts(p) {
  const r = p.tool_response;
  const fromObj = r && typeof r === 'object' ? r : {};
  const str = typeof r === 'string' ? r : '';
  return {
    model: p._resolvedModel || fromObj.resolvedModel || (/"resolvedModel":"([^"]+)"/.exec(str) || [])[1] || '',
    agentId: p._agentId || fromObj.agentId || (/"agentId":"([^"]+)"/.exec(str) || [])[1] || '',
    background: fromObj.isAsync === true || /async_launched|"isAsync":true/.test(str),
  };
}

// Keeps the event log small: long text fields are cut before being written to disk.
function slim(p) {
  const out = { ...p };
  if (out.tool_name === 'Agent' || out.tool_name === 'Task') {
    const f = agentFacts(p);
    if (f.model) out._resolvedModel = f.model;
    if (f.agentId) out._agentId = f.agentId;
  }
  if ('tool_response' in out) out.tool_response = trunc(summarizeResponse(out.tool_response), 3000);
  if (out.tool_input && typeof out.tool_input === 'object') {
    out.tool_input = Object.fromEntries(Object.entries(out.tool_input).map(([k, v]) =>
      [k, typeof v === 'string' ? trunc(v, 4000) : v]));
  }
  if (typeof out.prompt === 'string') out.prompt = trunc(out.prompt, 6000);
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
    };
    sessions.set(id, s);
    if (sessions.size > MAX_SESSIONS) {
      const oldest = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
      sessions.delete(oldest.id);
    }
  }
  if (p.cwd && !s.cwd) { s.cwd = p.cwd; s.project = path.basename(p.cwd); }
  if (typeof p.model === 'string' && p.model && !p.agent_id) s.model = p.model; // SessionStart reports the main model
  s.updatedAt = p._ts;
  return s;
}

const meta = s => ({ ...s, steps: undefined, stepCount: s.steps.length });

function send(obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const c of clients) c.write(line);
}
const pushSession = s => { if (!replaying) send({ type: 'session', session: meta(s) }); };
const pushStep = (s, step) => { if (!replaying) send({ type: 'step', sessionId: s.id, step }); };

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
  if (ag && ag.status === 'done' && p.hook_event_name !== 'SubagentStop') ag.status = 'working'; // still sending events, so not done
  if (!ag) {
    ag = s.agents.find(a => !a.id && a.status === 'starting' && (!p.agent_type || a.type === p.agent_type));
    if (ag) { ag.id = p.agent_id; ag.status = 'working'; }
    else { ag = { key: newId(), id: p.agent_id, type: p.agent_type || 'agent', status: 'working', startedAt: p._ts }; s.agents.push(ag); }
  }
  return ag.key;
}

// What changed in the plan (TodoWrite): which jobs started or finished. These become steps people can read.
function planChanges(oldList, newList) {
  if (!oldList.length && newList.length) return [{ kind: 'plan', items: newList.map(t => t.content) }];
  const out = [];
  for (const t of newList) {
    const was = oldList.find(o => o.content === t.content);
    if ((!was || was.status !== t.status) && (t.status === 'in_progress' || t.status === 'completed')) {
      out.push({ kind: t.status === 'in_progress' ? 'start' : 'done', content: t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content });
    }
  }
  return out;
}

function processEvent(p) {
  const s = getSession(p);
  const ev = p.hook_event_name;
  const input = p.tool_input || {};
  switch (ev) {
    case 'SessionStart': {
      if (p.source !== 'compact') s.status = 'idle';
      break;
    }
    case 'UserPromptSubmit': {
      const prompt = p.prompt || '';
      const cmd = /<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/.exec(prompt);
      if (cmd) { // you typed a slash command, e.g. /write-prd
        const args = (/<command-args>([\s\S]*?)<\/command-args>/.exec(prompt) || [])[1] || '';
        const text = `/${cmd[1]}${args.trim() ? ' ' + args.trim() : ''}`;
        if (!s.title) s.title = short(text, 90);
        s.status = 'working';
        addStep(s, { kind: 'prompt', promptText: short(text, 600), text, command: cmd[1], ts: p._ts });
        break;
      }
      if (/^\s*<[a-z][\w-]*[\s>]/i.test(prompt)) { // system wrappers (background results, agent hand-backs…), not something you typed
        const status = (/<status>(\w+)<\/status>/.exec(prompt) || [])[1];
        const summary = (/<summary>([\s\S]*?)<\/summary>/.exec(prompt) || [])[1];
        const result = (/<result>([\s\S]*?)<\/result>/.exec(prompt) || [])[1];
        const toolUse = (/<tool-use-id>([^<]+)<\/tool-use-id>/.exec(prompt) || [])[1];
        const from = (/^\s*<agent-message from="([^"]+)"/.exec(prompt) || [])[1];
        const ag = (toolUse && s.agents.find(a => a.toolUseId === toolUse)) || (from && s.agents.find(a => a.id === from));
        if (ag) { // a background agent reporting back
          const report = from && (/The report follows:\n([\s\S]*?)(?:<\/agent-message>\s*)?$/.exec(prompt) || [])[1];
          ag.status = status === 'failed' ? 'failed' : 'done';
          ag.endedAt = ag.endedAt || p._ts;
          const text = report ? report.replace(/^ {2}/gm, '').trim() : result || summary;
          if (text) ag.result = trunc(text, 3000);
          addStep(s, { kind: 'system', mark: 'agent-report', agentKey: ag.key, text: `Agent “${ag.description || ag.type}” gửi kết quả về`, ts: p._ts });
        }
        s.status = 'working';
        break;
      }
      if (!s.title) s.title = short(prompt, 90);
      s.status = 'working';
      addStep(s, { kind: 'prompt', promptText: short(prompt, 600), text: short(prompt, 160), detail: trunc(prompt, 4000), ts: p._ts });
      break;
    }
    case 'PreToolUse': {
      const lane = laneOf(s, p);
      const d = describeTool(p.tool_name, input);
      const step = { kind: 'tool', tool: p.tool_name, lane, status: 'running', toolUseId: p.tool_use_id, ...d, detail: trunc(d.detail, 4000), ts: p._ts };
      if (p.tool_name === 'TodoWrite' && Array.isArray(input.todos)) {
        const next = input.todos.map(t => ({ content: t.content || t.activeForm || '', activeForm: t.activeForm, status: t.status }));
        if (!lane) { step.plan = planChanges(s.todos, next); s.todos = next; }
      }
      if (p.tool_name === 'TaskCreate' && !lane) step.plan = [{ kind: 'add', content: input.subject || '' }];
      if (p.tool_name === 'TaskUpdate' && input.taskId && s.tasks[input.taskId] && !lane) {
        const t = s.tasks[input.taskId];
        if (input.subject) t.content = input.subject;
        if (input.status === 'in_progress' || input.status === 'completed') step.plan = [{ kind: input.status === 'in_progress' ? 'start' : 'done', content: t.content }];
        if (input.status) t.status = input.status;
        if (input.status === 'deleted') delete s.tasks[input.taskId];
      }
      addStep(s, step);
      s.status = 'working';
      if (p.tool_name === 'Agent' || p.tool_name === 'Task') {
        s.agents.push({
          key: newId(), id: null, type: input.subagent_type || 'general-purpose', description: input.description || '',
          prompt: trunc(input.prompt || '', 4000), model: input.model || '', status: 'starting', toolUseId: p.tool_use_id,
          parentKey: lane, startedAt: p._ts,
        });
      }
      break;
    }
    case 'PostToolUse':
    case 'PostToolUseFailure': {
      const failed = ev === 'PostToolUseFailure';
      const step = findStep(s, p.tool_use_id);
      const result = trunc(failed ? (p.error || summarizeResponse(p.tool_response)) : summarizeResponse(p.tool_response), 3000);
      if (step) {
        step.status = failed ? 'failed' : 'done';
        step.result = result;
        step.endedAt = p._ts;
        pushStep(s, step);
      }
      const ag = s.agents.find(a => a.toolUseId && a.toolUseId === p.tool_use_id);
      if (ag) {
        const f = agentFacts(p);
        if (f.model) ag.resolvedModel = f.model;
        if (f.agentId && !ag.id) ag.id = f.agentId;
        if (failed) { ag.status = 'failed'; ag.endedAt = p._ts; ag.result = result; }
        else if (f.background) ag.background = true; // finishes later, on SubagentStop / task notification
        else { ag.status = 'done'; ag.endedAt = p._ts; ag.result = result; }
      }
      if (p.tool_name === 'TaskCreate' && !failed) {
        const r = p.tool_response;
        const id = r?.task?.id || (/#(\d+)/.exec(typeof r === 'string' ? r : JSON.stringify(r || '')) || [])[1];
        if (id) s.tasks[id] = { content: input.subject || '', status: 'pending' };
      }
      break;
    }
    case 'SubagentStart': {
      const key = laneOf(s, p);
      addStep(s, { kind: 'agent', mark: 'subagent-start', lane: key, ts: p._ts });
      break;
    }
    case 'SubagentStop': {
      // Match strictly by id: other internal agents also fire SubagentStop and must not close the wrong lane.
      const ag = p.agent_id ? s.agents.find(a => a.id === p.agent_id) : null;
      if (ag) {
        if (ag.status !== 'failed') ag.status = 'done';
        ag.endedAt = p._ts;
        addStep(s, { kind: 'agent', mark: 'subagent-end', lane: ag.key, ts: p._ts });
      }
      break;
    }
    case 'Notification': {
      const msg = p.message || '';
      if (/waiting for your input/i.test(msg)) { if (s.status === 'working') s.status = 'done'; break; }
      s.status = 'waiting';
      addStep(s, { kind: 'system', mark: 'waiting', text: /permission/i.test(msg) ? 'Đang chờ bạn cho phép trong cửa sổ Claude Code' : short(msg, 140), ts: p._ts });
      break;
    }
    case 'Stop':
      for (const st of s.steps) if (st.status === 'running' && !st.lane) { st.status = 'skipped'; pushStep(s, st); }
      s.status = 'done';
      addStep(s, { kind: 'system', mark: 'turn-end', ts: p._ts });
      break;
    case 'SessionEnd':
      s.status = 'ended';
      break;
    default: break;
  }
  return s;
}

function handleHook(p) {
  p._ts = Date.now();
  fs.appendFile(EVENTS_FILE, JSON.stringify(slim(p)) + '\n', () => {});
  const s = processEvent(p);
  pushSession(s);
  return {}; // never changes what Claude Code does
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
    for (const st of s.steps) if (st.status === 'running') st.status = 'unknown';
    for (const a of s.agents) if (a.status === 'working' || a.status === 'starting') a.status = 'unknown';
    if (['working', 'waiting'].includes(s.status)) s.status = 'unknown';
  }
}

// ---------------------------------------------------------------- http
function projectDirs() {
  return [...new Set([...[...sessions.values()].map(s => s.cwd).filter(Boolean), ...config.extraProjects])];
}

function stateSnapshot() {
  const list = [...sessions.values()].filter(s => !config.hidden.includes(s.id))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(s => ({ ...meta(s), steps: s.steps.slice(-800) }));
  return { sessions: list, config, hooks: claudeSettings.status(), mainModel: claudeSettings.getModel() };
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
const MODEL_VALUES = ['', 'inherit', 'opus', 'sonnet', 'haiku', 'fable'];

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;
  // Guard against other websites in your browser talking to this local server.
  if (!allowedHosts.has(req.headers.host)) { res.writeHead(403); return res.end(); }
  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);
  if (req.method !== 'GET' && !req.headers['x-agent-dashboard']) return json(res, 403, { error: 'forbidden' });

  const m = (re) => re.exec(pathname);
  let r;

  if (req.method === 'POST' && pathname === '/api/hook') return json(res, 200, handleHook(await readBody(req)));
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
  if (req.method === 'GET' && (r = m(/^\/api\/sessions\/([^/]+)\/file$/))) {
    // Reads an output file, but only one this session itself wrote or edited (never any file on the machine).
    const s = sessions.get(decodeURIComponent(r[1]));
    const want = url.searchParams.get('path') || '';
    if (!s) return json(res, 404, { error: 'Không tìm thấy phiên.' });
    const written = s.steps.some(x => ['Write', 'Edit', 'MultiEdit'].includes(x.tool) && String(x.detail || '').split('\n')[0] === want);
    if (!written || !path.isAbsolute(want)) return json(res, 403, { error: 'Chỉ mở được file mà phiên này đã tạo hoặc sửa.' });
    if (!/\.(md|markdown|txt|csv|json|html?)$/i.test(want)) return json(res, 415, { error: 'Chỉ xem được file văn bản (.md, .txt, .csv, .json).' });
    let st;
    try { st = fs.statSync(want); } catch { return json(res, 404, { error: 'File này không còn trên máy (có thể đã bị xoá hoặc đổi tên).' }); }
    if (st.size > 2 * 1024 * 1024) return json(res, 413, { error: 'File quá lớn để xem ở đây.' });
    return json(res, 200, { path: want, name: path.basename(want), text: fs.readFileSync(want, 'utf8'), mtime: st.mtimeMs });
  }
  if (req.method === 'POST' && (r = m(/^\/api\/sessions\/([^/]+)\/hide$/))) {
    const id = decodeURIComponent(r[1]);
    if (!config.hidden.includes(id)) config.hidden.push(id);
    config.hidden = config.hidden.slice(-500);
    saveConfig();
    send({ type: 'hidden', sessionId: id });
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/items') return json(res, 200, { items: items.scan(projectDirs()) });
  if ((r = m(/^\/api\/items\/([0-9a-f]{12})(?:\/(history|restore|copy|version|model))?$/))) {
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
    if (req.method === 'POST' && sub === 'model') { // one-click model change, used from the activity view and the cards
      const body = await readBody(req);
      const model = String(body.model || '');
      if (!MODEL_VALUES.includes(model)) return json(res, 400, { error: 'Model không hợp lệ.' });
      const out = items.save(id, { model });
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
