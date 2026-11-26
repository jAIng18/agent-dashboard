# 🤖 Agent Dashboard for Claude Code

Watch every loop of Claude Code's work: which step it is on, which agent it handed a job to, which skill it used. Change an agent's or skill's model and instructions right in the page, without opening any `.md` file. Made for non-technical people too.

The interface is in Vietnamese. UI labels are quoted below as **English name** (*Vietnamese label*) so you can find them on screen.

## Open the dashboard
1. Double-click **`start.command`** in this folder. The first time, macOS may ask for confirmation: choose *Open*.
2. Your browser opens `http://127.0.0.1:4319`.
3. Click **Connect to Claude Code** (*Kết nối với Claude Code*), only needed once, then open a **new** Claude Code window. The browser also asks whether the page may show notifications: choose *Allow*.
4. Optional: in Settings, click **Open at login** (*Bật tự mở khi bật máy*). The dashboard then runs in the background and starts on its own every time you log in, so you can close the Terminal window for good.

Without "Open at login", stop it by closing the Terminal window. With it, use **Stop the dashboard now** (*Tắt bảng điều khiển ngay*) in Settings. Double-clicking `start.command` always just opens the page if the dashboard is already running. Claude Code keeps working normally when the dashboard is off.

## Three tabs
| Tab | What it is for |
|---|---|
| Activity (*Hoạt động*) | Each request you send is one **loop**, drawn as a flow of connected steps like n8n: your request → plan → which agent got which job (agents running in parallel are stacked in the same column) → which skill was used → done. Long loops wrap onto new rows. Pick a loop in the bar at the top. Drag to pan, Ctrl + scroll to zoom. **Click a step** to open a 3-column panel: **Input** (*Đầu vào*: the job it was given), **Settings** (*Thiết lập*: change the model, "when to use" and instructions, then Save), **Output** (*Đầu ra*: the result and files it created). Use **Previous step / Next step** (*Bước trước / Bước sau*) to walk through the loop |
| Agents & Skills (*Agent & Skill*) | Every agent and skill on your machine. Change the model right on the card (saved instantly). Click a card to open the same 3-column panel, filled with the input and output of its most recent run. Includes a history so you can restore an older version. **New** (*Tạo mới*) creates an agent or skill from a template (translation, email, summary, proofreading, weekly report or blank): give it a name in plain Vietnamese, say when to use it, then edit the instructions |
| Settings (*Cài đặt*) | Connect or disconnect; choose when to be notified (Claude is waiting for you / Claude is done / chime); turn "Open at login" on or off; change the main agent's model; add project folders with **Choose folder…** (*Chọn thư mục…*) |

## Good to know
- The dashboard **only watches**. It never blocks or changes what Claude Code is doing.
- A new model or new instructions take effect from the **next run**. A run already in progress is not affected.
- Claude Code's built-in agents (such as `general-purpose`, `Explore`) have no settings file, so their model can't be changed. To customise one, click **Create your own agent** (*Tạo agent của riêng bạn*) in its panel.
- A new agent or skill is saved in `~/.claude/agents/` or `~/.claude/skills/` (or the chosen project's `.claude/`). Open a new Claude Code window to use it.
- When Claude is waiting for your answer or permission, the browser tab title starts with 🔔 and, if you're in another window, a notification and a chime tell you.
- Skills from plugins or claude.ai are read-only. Click **Make a copy to edit** (*Tạo bản sao để chỉnh*) to get your own editable version.
- Every time you connect or disconnect, `~/.claude/settings.json` is backed up as `settings.json.bak-agent-dashboard-*`.
- To share a link to one session: `http://127.0.0.1:4319/?s=<session id>`.

## Technical
Node.js ≥ 18, no dependencies to install. The server listens on `127.0.0.1` only. Data (step log, edit history) lives in `data/`.
- `server.js`: receives hook events, groups them into sessions / loops, serves the API and realtime updates (SSE)
- `hook.js`: the Claude Code hook; sends events to the server, quietly does nothing if the server isn't running, never blocks
- `lib/`: frontmatter read/write, agent/skill discovery and creation, hook installation, and `autostart.js` (the macOS LaunchAgent `~/Library/LaunchAgents/com.agent-dashboard.plist` behind "Open at login"; its log is `data/server.log`)
- `public/`: the web interface
