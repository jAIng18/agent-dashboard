#!/usr/bin/env node
'use strict';
// Claude Code hook: forwards each event to the local dashboard (which only watches, it never blocks Claude Code).
// If the dashboard isn't running, it exits silently so Claude Code works exactly as usual.
const http = require('http');

const PORT = Number(process.env.AGENT_DASHBOARD_PORT || 4319);
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  try { JSON.parse(input); } catch { process.exit(0); }
  const req = http.request({
    host: '127.0.0.1', port: PORT, path: '/api/hook', method: 'POST',
    headers: { 'content-type': 'application/json', 'x-agent-dashboard': 'hook', 'content-length': Buffer.byteLength(input) },
    timeout: 2500,
  }, res => {
    let out = '';
    res.setEncoding('utf8');
    res.on('data', d => { out += d; });
    res.on('end', () => {
      if (res.statusCode === 200 && out.trim() && out.trim() !== '{}') process.stdout.write(out);
      process.exit(0);
    });
  });
  req.on('timeout', () => { req.destroy(); process.exit(0); });
  req.on('error', () => process.exit(0));
  req.end(input);
});
