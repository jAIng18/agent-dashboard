'use strict';
// Minimal, formatting-preserving YAML frontmatter reader/writer for agent and skill .md files.
// Only top-level keys are understood; keys we don't touch are written back byte-for-byte.

function split(text) {
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { has: false, fm: '', body: text };
  return { has: true, fm: m[1], body: text.slice(m[0].length) };
}

function parseEntries(fm) {
  const entries = [];
  for (const line of fm.split(/\r?\n/)) {
    const km = /^([A-Za-z0-9_.-]+)\s*:(.*)$/.exec(line);
    if (km && !/^\s/.test(line)) entries.push({ key: km[1], lines: [line] });
    else if (entries.length) entries[entries.length - 1].lines.push(line);
    else entries.push({ key: null, lines: [line] });
  }
  return entries;
}

function unquote(s) {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    try { return JSON.parse(s); } catch { return s.slice(1, -1); }
  }
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

function valueOf(entry) {
  const first = entry.lines[0].replace(/^[^:]+:\s?/, '');
  const rest = entry.lines.slice(1);
  const t = first.trim();
  if (/^[|>][+-]?\d*$/.test(t)) {
    const nonEmpty = rest.filter(l => l.trim());
    const ind = nonEmpty.length ? Math.min(...nonEmpty.map(l => /^\s*/.exec(l)[0].length)) : 0;
    const body = rest.map(l => l.slice(ind));
    const s = t[0] === '|' ? body.join('\n') : body.join(' ').replace(/[ \t]+/g, ' ');
    return s.replace(/\s+$/, '');
  }
  if (!t && rest.some(l => /^\s*-\s/.test(l))) {
    return rest.map(l => l.trim()).filter(l => l.startsWith('- ')).map(l => unquote(l.slice(2).trim()));
  }
  if (!t && rest.some(l => l.trim())) return null; // nested mapping: not a simple value
  const s = [first, ...rest.map(l => l.trim())].join(' ').trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    return s.slice(1, -1).split(',').map(x => unquote(x.trim())).filter(Boolean);
  }
  return unquote(s);
}

function parse(text) {
  const sp = split(text);
  const entries = sp.has ? parseEntries(sp.fm) : [];
  const data = {};
  for (const e of entries) if (e.key) data[e.key] = valueOf(e);
  return { has: sp.has, entries, data, body: sp.body };
}

function needsQuote(v) {
  return /^[\s'"\[\]{}>|*&!%@`#,?:~-]/.test(v) || /:\s|\s#|:$/.test(v) || /\s$/.test(v) ||
    /^(true|false|null|yes|no|on|off)$/i.test(v) || /^[\d.+-]+$/.test(v);
}

function formatEntry(key, v) {
  if (Array.isArray(v)) return [`${key}: ${v.join(', ')}`];
  v = String(v);
  if (v.includes('\n')) return [`${key}: |`, ...v.replace(/\s+$/, '').split('\n').map(l => (l ? '  ' + l : ''))];
  return [`${key}: ${needsQuote(v) ? JSON.stringify(v) : v}`];
}

// fields: { key: value | null }  (null/'' removes the key). body: new body or undefined.
function update(text, { fields = {}, body } = {}) {
  const sp = split(text);
  const entries = sp.has ? parseEntries(sp.fm) : [];
  for (const [k, v] of Object.entries(fields)) {
    const i = entries.findIndex(e => e.key === k);
    const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
    if (empty) { if (i >= 0) entries.splice(i, 1); continue; }
    const lines = formatEntry(k, v);
    if (i >= 0) entries[i].lines = lines; else entries.push({ key: k, lines });
  }
  const newBody = body != null ? body : sp.body;
  if (!entries.length && !sp.has) return newBody;
  return `---\n${entries.map(e => e.lines.join('\n')).join('\n')}\n---\n${newBody}`;
}

module.exports = { parse, update, split };
