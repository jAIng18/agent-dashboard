'use strict';
// Finds agents and skills on disk, and reads / saves / restores them.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fm = require('./frontmatter');

const HOME = os.homedir();
const CLAUDE = path.join(HOME, '.claude');
let HISTORY = null; // set by init()
let index = new Map(); // id -> item meta (only files found by the last scan can be opened or saved)

function init(dataDir) {
  HISTORY = path.join(dataDir, 'history');
  fs.mkdirSync(HISTORY, { recursive: true });
}

const idFor = p => crypto.createHash('sha1').update(p).digest('hex').slice(0, 12);

function dirents(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}
function listMd(dir) {
  return dirents(dir).filter(e => e.isFile() && e.name.endsWith('.md')).map(e => path.join(dir, e.name));
}
function listSkills(dir, exclude = []) {
  return dirents(dir)
    .filter(e => (e.isDirectory() || e.isSymbolicLink()) && !exclude.includes(e.name) && !e.name.startsWith('.'))
    .map(e => path.join(dir, e.name, 'SKILL.md'))
    .filter(f => fs.existsSync(f));
}

function asList(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map(String);
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

function readMeta(file, kind) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const p = fm.parse(text);
  const d = p.data;
  const fallback = kind === 'skill' ? path.basename(path.dirname(file)) : path.basename(file, '.md');
  return {
    name: typeof d.name === 'string' && d.name ? d.name : fallback,
    description: typeof d.description === 'string' ? d.description : '',
    model: typeof d.model === 'string' ? d.model : '',
    tools: kind === 'agent' ? asList(d.tools) : asList(d['allowed-tools']),
    hasToolsKey: kind === 'agent' ? 'tools' in d : 'allowed-tools' in d,
    managedBy: /^\s+source:\s*1devtool\s*$/m.test(fm.split(text).fm) ? '1DevTool' : null,
    text, parsed: p,
  };
}

function scan(projectDirs = []) {
  const items = [];
  const seen = new Set();
  const add = (file, kind, scope, group, editable, extra = {}) => {
    const real = path.resolve(file);
    if (seen.has(real)) return;
    const m = readMeta(real, kind);
    if (!m) return;
    seen.add(real);
    const invokeName = extra.plugin ? `${extra.plugin}:${m.name}` : m.name;
    items.push({
      id: idFor(real), kind, scope, group, editable, path: real,
      name: m.name, invokeName, description: m.description, model: m.model, tools: m.tools,
      plugin: extra.plugin || null, managedBy: m.managedBy,
    });
  };

  for (const f of listMd(path.join(CLAUDE, 'agents'))) add(f, 'agent', 'user', 'Của bạn · dùng cho mọi dự án', true);
  for (const f of listSkills(path.join(CLAUDE, 'skills'), ['synced'])) add(f, 'skill', 'user', 'Của bạn · dùng cho mọi dự án', true);

  for (const dir of [...new Set(projectDirs)]) {
    if (!dir || path.resolve(dir) === HOME) continue;
    const base = path.join(dir, '.claude');
    const group = `Dự án · ${path.basename(dir)}`;
    for (const f of listMd(path.join(base, 'agents'))) add(f, 'agent', 'project', group, true, { project: dir });
    for (const f of listSkills(path.join(base, 'skills'))) add(f, 'skill', 'project', group, true, { project: dir });
  }

  const syncedNames = new Set();
  for (const b of dirents(path.join(CLAUDE, 'skills', 'synced')).filter(e => e.isDirectory())) {
    for (const f of listSkills(path.join(CLAUDE, 'skills', 'synced', b.name))) {
      const name = path.basename(path.dirname(f));
      if (syncedNames.has(name)) continue;
      syncedNames.add(name);
      add(f, 'skill', 'synced', 'Đồng bộ từ claude.ai · chỉ xem', false);
    }
  }

  let installed = {};
  try { installed = JSON.parse(fs.readFileSync(path.join(CLAUDE, 'plugins', 'installed_plugins.json'), 'utf8')).plugins || {}; } catch {}
  for (const [key, versions] of Object.entries(installed)) {
    const v = Array.isArray(versions) ? versions[versions.length - 1] : null;
    if (!v || !v.installPath) continue;
    const plugin = key.split('@')[0];
    const group = `Plugin · ${plugin} · chỉ xem`;
    for (const f of listMd(path.join(v.installPath, 'agents'))) add(f, 'agent', 'plugin', group, false, { plugin });
    for (const f of listSkills(path.join(v.installPath, 'skills'))) add(f, 'skill', 'plugin', group, false, { plugin });
  }

  index = new Map(items.map(i => [i.id, i]));
  return items;
}

function get(id) {
  const it = index.get(id);
  if (!it) return null;
  const m = readMeta(it.path, it.kind);
  if (!m) return null;
  const st = fs.statSync(it.path);
  return {
    ...it, name: m.name, description: m.description, model: m.model, tools: m.tools,
    allToolsAllowed: !m.hasToolsKey, body: m.parsed.body, raw: m.text, mtime: st.mtimeMs,
    historyCount: history(id).length,
  };
}

function histDir(id) { return path.join(HISTORY, id); }

function backup(it, note) {
  const dir = histDir(it.id);
  fs.mkdirSync(dir, { recursive: true });
  const ts = Date.now();
  fs.writeFileSync(path.join(dir, `${ts}.md`), fs.readFileSync(it.path));
  fs.writeFileSync(path.join(dir, `${ts}.json`), JSON.stringify({ ts, path: it.path, note }));
}

function history(id) {
  return dirents(histDir(id))
    .filter(e => e.name.endsWith('.json'))
    .map(e => { try { return JSON.parse(fs.readFileSync(path.join(histDir(id), e.name), 'utf8')); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts);
}

class UserError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

function writeChecked(it, newText, note, expectMtime) {
  if (!it.editable) throw new UserError('Mục này chỉ xem được, không sửa được.', 403);
  const st = fs.statSync(it.path);
  if (expectMtime && Math.abs(st.mtimeMs - expectMtime) > 1) {
    throw new UserError('File vừa được sửa ở nơi khác. Hãy đóng và mở lại để xem bản mới nhất.', 409);
  }
  const old = fs.readFileSync(it.path, 'utf8');
  if (old === newText) return false;
  backup(it, note);
  fs.writeFileSync(it.path, newText);
  return true;
}

// changes: { description?, model?, tools? (array | null = all tools), body?, raw? }
function save(id, changes, expectMtime) {
  const it = index.get(id);
  if (!it) throw new UserError('Không tìm thấy mục này. Hãy tải lại trang.', 404);
  const cur = readMeta(it.path, it.kind);
  let next;
  const notes = [];
  if (typeof changes.raw === 'string') {
    next = changes.raw;
    notes.push('Sửa file gốc');
  } else {
    const fields = {};
    if (changes.description != null && changes.description !== cur.description) { fields.description = changes.description; notes.push('mô tả'); }
    if (changes.model != null && changes.model !== cur.model) { fields.model = changes.model || null; notes.push(`model → ${changes.model || 'mặc định'}`); }
    if (it.kind === 'agent' && 'tools' in changes) {
      const want = changes.tools; // null = all tools
      const same = want == null ? !cur.hasToolsKey : cur.hasToolsKey && want.join(',') === cur.tools.join(',');
      if (!same) { fields.tools = want == null ? null : want; notes.push('công cụ'); }
    }
    let body;
    if (changes.body != null && changes.body !== cur.parsed.body) { body = changes.body; notes.push('quy tắc'); }
    if (!Object.keys(fields).length && body == null) return { changed: false };
    next = fm.update(cur.text, { fields, body });
  }
  const changed = writeChecked(it, next, `Đã sửa ${notes.join(', ')}`, expectMtime);
  return { changed };
}

function setModelMany(ids, model) {
  const results = [];
  for (const id of ids) {
    const it = index.get(id);
    if (!it || !it.editable) { results.push({ id, ok: false }); continue; }
    try {
      const cur = readMeta(it.path, it.kind);
      if ((cur.model || '') === (model || '')) { results.push({ id, ok: true }); continue; }
      const next = fm.update(cur.text, { fields: { model: model || null } });
      writeChecked(it, next, `Đổi model hàng loạt → ${model || 'mặc định'}`);
      results.push({ id, ok: true });
    } catch (e) { results.push({ id, ok: false, error: e.message }); }
  }
  return results;
}

function restore(id, ts) {
  const it = index.get(id);
  if (!it) throw new UserError('Không tìm thấy mục này.', 404);
  const f = path.join(histDir(id), `${Number(ts)}.md`);
  if (!fs.existsSync(f)) throw new UserError('Không tìm thấy bản lưu này.', 404);
  writeChecked(it, fs.readFileSync(f, 'utf8'), `Khôi phục bản lúc ${new Date(Number(ts)).toLocaleString('vi-VN')}`);
}

function historyVersion(id, ts) {
  const f = path.join(histDir(id), `${Number(ts)}.md`);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}

// Copies a read-only (plugin / synced) item into the user's own folder so it can be edited.
function copyToUser(id) {
  const it = index.get(id);
  if (!it) throw new UserError('Không tìm thấy mục này.', 404);
  const safe = it.name.replace(/[^\p{L}\p{N}_-]+/gu, '-');
  if (it.kind === 'agent') {
    const dest = path.join(CLAUDE, 'agents', `${safe}.md`);
    if (fs.existsSync(dest)) throw new UserError(`Bạn đã có agent tên “${safe}” rồi.`, 409);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(it.path, dest);
    return idFor(dest);
  }
  const dest = path.join(CLAUDE, 'skills', safe);
  if (fs.existsSync(dest)) throw new UserError(`Bạn đã có skill tên “${safe}” rồi.`, 409);
  fs.cpSync(path.dirname(it.path), dest, { recursive: true, dereference: true });
  return idFor(path.join(dest, 'SKILL.md'));
}

// "Dịch thuật Anh–Việt" -> "dich-thuat-anh-viet": Claude Code names are lowercase letters, numbers and hyphens.
function slugify(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
}

// Creates a new agent (<base>/agents/<slug>.md) or skill (<base>/skills/<slug>/SKILL.md).
// base is ~/.claude, or <project>/.claude when a project folder is given.
function create({ kind, name, description, model, body }, projectDir) {
  if (kind !== 'agent' && kind !== 'skill') throw new UserError('Hãy chọn Agent hoặc Skill.');
  const slug = slugify(name);
  if (!slug) throw new UserError('Hãy đặt tên (ít nhất một chữ cái hoặc chữ số).');
  if (!String(description || '').trim()) throw new UserError('Hãy viết “Khi nào dùng”, để AI biết lúc nào cần gọi.');
  const base = projectDir ? path.join(projectDir, '.claude') : CLAUDE;
  const file = kind === 'agent' ? path.join(base, 'agents', `${slug}.md`) : path.join(base, 'skills', slug, 'SKILL.md');
  if (fs.existsSync(kind === 'agent' ? file : path.dirname(file))) {
    throw new UserError(`Đã có ${kind === 'agent' ? 'agent' : 'skill'} tên “${slug}”. Hãy đặt tên khác.`, 409);
  }
  const fields = { name: slug, description: String(description).trim().replace(/\s*\n\s*/g, ' ') };
  if (model) fields.model = model;
  const text = fm.update('', { fields, body: `\n${String(body || '').trim()}\n` });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return idFor(path.resolve(file));
}

module.exports = { init, scan, get, save, setModelMany, history, historyVersion, restore, copyToUser, create, slugify, UserError };
