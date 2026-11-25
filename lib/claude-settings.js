'use strict';
// Connects / disconnects the dashboard hooks in ~/.claude/settings.json and reads / sets the main model.
const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK_SCRIPT = path.resolve(__dirname, '..', 'hook.js');
const MARK = 'agent-dashboard/hook.js';

// PreToolUse waits while you decide, so it gets a long timeout. Everything else is fire-and-forget.
const EVENTS = {
  SessionStart: { timeout: 5 },
  UserPromptSubmit: { timeout: 5 },
  PreToolUse: { timeout: 620, matcher: '*' },
  PostToolUse: { timeout: 5, matcher: '*' },
  PostToolUseFailure: { timeout: 5, matcher: '*' },
  Notification: { timeout: 5 },
  SubagentStart: { timeout: 5 },
  SubagentStop: { timeout: 5 },
  Stop: { timeout: 5 },
  SessionEnd: { timeout: 5 },
};

function read() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw new Error('Không đọc được file cài đặt của Claude Code (settings.json bị lỗi định dạng).');
  }
}

function write(settings, reason) {
  if (fs.existsSync(SETTINGS)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(SETTINGS, `${SETTINGS}.bak-agent-dashboard-${stamp}`);
    pruneBackups();
  }
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
  return reason;
}

function pruneBackups() {
  const dir = path.dirname(SETTINGS);
  const backups = fs.readdirSync(dir).filter(f => f.startsWith('settings.json.bak-agent-dashboard-')).sort();
  for (const f of backups.slice(0, Math.max(0, backups.length - 5))) fs.unlinkSync(path.join(dir, f));
}

const isOurs = h => typeof h?.command === 'string' && h.command.includes(MARK);

function stripOurs(settings) {
  const hooks = settings.hooks || {};
  for (const ev of Object.keys(hooks)) {
    if (!Array.isArray(hooks[ev])) continue;
    hooks[ev] = hooks[ev]
      .map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !isOurs(h)) }))
      .filter(g => g.hooks.length);
    if (!hooks[ev].length) delete hooks[ev];
  }
  if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;
  return settings;
}

function status() {
  let s;
  try { s = read(); } catch (e) { return { connected: false, error: e.message, events: [] }; }
  const events = Object.keys(EVENTS).filter(ev =>
    (s.hooks?.[ev] || []).some(g => (g.hooks || []).some(isOurs)));
  return { connected: events.length === Object.keys(EVENTS).length, partial: events.length > 0, events };
}

function install() {
  const s = stripOurs(read());
  s.hooks = s.hooks || {};
  const command = `"${process.execPath}" "${HOOK_SCRIPT}"`;
  for (const [ev, opt] of Object.entries(EVENTS)) {
    const group = { hooks: [{ type: 'command', command, timeout: opt.timeout }] };
    if (opt.matcher) group.matcher = opt.matcher;
    s.hooks[ev] = [...(s.hooks[ev] || []), group];
  }
  write(s);
  return status();
}

function uninstall() {
  write(stripOurs(read()));
  return status();
}

function getModel() { try { return read().model || ''; } catch { return ''; } }
function setModel(model) {
  const s = read();
  if (model) s.model = model; else delete s.model;
  write(s);
  return getModel();
}

module.exports = { status, install, uninstall, getModel, setModel, SETTINGS };
