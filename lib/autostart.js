'use strict';
// "Open at login" on macOS: a LaunchAgent that runs the dashboard in the background, with no Terminal window.
// launchd starts it when you log in, and again if it ever crashes. A clean exit (the Stop button) keeps it stopped.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const LABEL = 'com.agent-dashboard';
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');
const LOG = path.join(ROOT, 'data', 'server.log');
const PORT = Number(process.env.AGENT_DASHBOARD_PORT || 4319);
const domain = () => `gui/${process.getuid()}`;

// Homebrew's node lives in a versioned folder (…/Cellar/node/26.1/bin/node) that disappears on "brew upgrade".
// Prefer the stable link that points at the same file, so the background copy and the hooks keep working.
function stableNode() {
  const real = p => { try { return fs.realpathSync(p); } catch { return null; } };
  const me = real(process.execPath);
  for (const c of ['/opt/homebrew/bin/node', '/usr/local/bin/node']) if (me && real(c) === me) return c;
  return process.execPath;
}

const supported = () => process.platform === 'darwin';
const underLaunchd = () => process.env.AGENT_DASHBOARD_LAUNCHD === '1';
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function plist() {
  const args = [stableNode(), SERVER].map(a => `    <string>${xml(a)}</string>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key><string>${xml(ROOT)}</string>
  <key>EnvironmentVariables</key>
  <dict><key>AGENT_DASHBOARD_LAUNCHD</key><string>1</string>${PORT !== 4319 ? `<key>AGENT_DASHBOARD_PORT</key><string>${PORT}</string>` : ''}</dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${xml(LOG)}</string>
  <key>StandardErrorPath</key><string>${xml(LOG)}</string>
</dict>
</plist>
`;
}

const launchctl = (...args) => spawnSync('/bin/launchctl', args, { encoding: 'utf8', timeout: 10000 });

function status() {
  if (!supported()) return { supported: false, enabled: false, background: false };
  return { supported: true, enabled: fs.existsSync(PLIST), background: underLaunchd() };
}

// Writes the LaunchAgent and registers it. The launchd copy can't open the port while this process holds it,
// so the caller then calls handOver(): this process exits and launchd starts the background copy.
function enable() {
  if (!supported()) throw new Error('Chỉ có trên macOS.');
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.writeFileSync(PLIST, plist());
  if (!underLaunchd()) launchctl('bootout', `${domain()}/${LABEL}`); // an older copy with stale paths
  const r = launchctl('bootstrap', domain(), PLIST);
  if (r.status !== 0 && !underLaunchd()) {
    fs.rmSync(PLIST, { force: true });
    throw new Error(`macOS không cho bật chế độ chạy nền: ${(r.stderr || r.stdout || '').trim() || 'lỗi không rõ'}`);
  }
  return status();
}

// Removes the LaunchAgent so it won't start at the next login. If this process is the background copy,
// it keeps running until you stop it or log out (booting it out here would kill the page you're looking at).
function disable() {
  if (!supported()) return status();
  fs.rmSync(PLIST, { force: true });
  if (!underLaunchd()) launchctl('bootout', `${domain()}/${LABEL}`);
  return status();
}

// Called just before this (Terminal) process exits: asks launchd to start the background copy. If that copy
// doesn't answer within a few seconds (for example macOS blocked it), turn the option back off and start the
// dashboard the old way, so it never ends up switched off.
function handOver() {
  const q = s => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const job = `${domain()}/${LABEL}`;
  const script = `sleep 1
/bin/launchctl kickstart ${job}
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16; do
  /usr/bin/curl -fs -o /dev/null --max-time 1 http://127.0.0.1:${PORT}/api/autostart && exit 0
  sleep 0.5
done
/bin/launchctl bootout ${job}
rm -f ${q(PLIST)}
echo "[$(date)] Không chạy nền được, quay về chạy thường." >> ${q(LOG)}
cd ${q(ROOT)} && exec ${q(process.execPath)} ${q(SERVER)} >> ${q(LOG)} 2>&1`;
  spawn('/bin/sh', ['-c', script], { detached: true, stdio: 'ignore' }).unref();
}

module.exports = { status, enable, disable, handOver, supported, underLaunchd, stableNode, PLIST, LABEL };
