# 🤖 Agent Dashboard for Claude Code

Watch every loop of Claude Code's work: which step it is on, which agent it handed a job to, which skill it used. Change an agent's or skill's model and instructions right in the page, without opening any `.md` file. Made for non-technical people too.

The interface is in Vietnamese. UI labels are quoted below as **English name** (*Vietnamese label*) so you can find them on screen.

## Open the dashboard
1. Double-click **`start.command`** in this folder. The first time, macOS may ask for confirmation: choose *Open*.
2. Your browser opens `http://127.0.0.1:4319`.
3. Click **Connect to Claude Code** (*Kết nối với Claude Code*), only needed once, then open a **new** Claude Code window.

To stop it, close the Terminal window running the dashboard. Claude Code keeps working normally when the dashboard is off.

## Three tabs
| Tab | What it is for |
|---|---|
| Activity (*Hoạt động*) | Each request you send is one **loop**, drawn as a flow of connected steps like n8n: your request → plan → which agent got which job (agents running in parallel are stacked in the same column) → which skill was used → done. Long loops wrap onto new rows. Pick a loop in the bar at the top. Drag to pan, Ctrl + scroll to zoom. **Click a step** to open a 3-column panel: **Input** (*Đầu vào*: the job it was given), **Settings** (*Thiết lập*: change the model, "when to use" and instructions, then Save), **Output** (*Đầu ra*: the result and files it created). Use **Previous step / Next step** (*Bước trước / Bước sau*) to walk through the loop |
| Agents & Skills (*Agent & Skill*) | Every agent and skill on your machine. Change the model right on the card (saved instantly). Click a card to open the same 3-column panel, filled with the input and output of its most recent run. Includes a history so you can restore an older version |
| Settings (*Cài đặt*) | Connect or disconnect, change the main agent's model, add project folders |

## Good to know
- The dashboard **only watches**. It never blocks or changes what Claude Code is doing.
- A new model or new instructions take effect from the **next run**. A run already in progress is not affected.
- Claude Code's built-in agents (such as `general-purpose`, `Explore`) have no settings file, so their model can't be changed. To customise one, create your own agent.
- Skills from plugins or claude.ai are read-only. Click **Make a copy to edit** (*Tạo bản sao để chỉnh*) to get your own editable version.
- Every time you connect or disconnect, `~/.claude/settings.json` is backed up as `settings.json.bak-agent-dashboard-*`.
- To share a link to one session: `http://127.0.0.1:4319/?s=<session id>`.

## Technical
Node.js ≥ 18, no dependencies to install. The server listens on `127.0.0.1` only. Data (step log, edit history) lives in `data/`.
- `server.js`: receives hook events, groups them into sessions / loops, serves the API and realtime updates (SSE)
- `hook.js`: the Claude Code hook; sends events to the server, quietly does nothing if the server isn't running, never blocks
- `lib/`: frontmatter read/write, agent/skill discovery, hook installation
- `public/`: the web interface
