'use strict';
// Turns raw Claude Code tool calls into short, plain-Vietnamese step descriptions.

const base = p => (p ? String(p).split('/').filter(Boolean).pop() : '');
function short(s, n = 120) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function host(u) { try { return new URL(u).host; } catch { return short(u, 40); } }

const TASK_STATUS = { pending: 'chưa làm', in_progress: 'đang làm', completed: 'đã xong', deleted: 'đã xoá' };

// category: read | edit | command | web | agent | plan | ask | other
function describeTool(name, input = {}) {
  switch (name) {
    case 'Read': return { icon: '📖', category: 'read', text: `Đọc file ${base(input.file_path)}`, detail: input.file_path };
    case 'Write': return { icon: '📝', category: 'edit', text: `Tạo / ghi file ${base(input.file_path)}`, detail: `${input.file_path}\n\n${short(input.content, 2000)}` };
    case 'Edit': return { icon: '✏️', category: 'edit', text: `Sửa file ${base(input.file_path)}`, detail: `${input.file_path}\n\n— Đoạn cũ —\n${input.old_string ?? ''}\n\n— Đoạn mới —\n${input.new_string ?? ''}` };
    case 'MultiEdit': return { icon: '✏️', category: 'edit', text: `Sửa ${(input.edits || []).length} chỗ trong file ${base(input.file_path)}`, detail: input.file_path };
    case 'NotebookEdit': return { icon: '✏️', category: 'edit', text: `Sửa notebook ${base(input.notebook_path)}`, detail: input.notebook_path };
    case 'Bash': return { icon: '⌨️', category: 'command', text: input.description ? `Chạy lệnh: ${short(input.description, 90)}` : `Chạy lệnh ${short(input.command, 60)}`, detail: input.command };
    case 'BashOutput': case 'Monitor': return { icon: '⏱️', category: 'read', text: 'Xem kết quả lệnh đang chạy nền' };
    case 'KillShell': case 'TaskStop': return { icon: '⏹️', category: 'command', text: 'Dừng một tác vụ chạy nền' };
    case 'Grep': return { icon: '🔍', category: 'read', text: `Tìm “${short(input.pattern, 40)}” trong mã nguồn`, detail: input.path };
    case 'Glob': return { icon: '🗂️', category: 'read', text: `Tìm file theo mẫu ${short(input.pattern, 50)}` };
    case 'LS': return { icon: '🗂️', category: 'read', text: `Xem thư mục ${base(input.path)}` };
    case 'WebSearch': return { icon: '🌐', category: 'web', text: `Tìm trên web: ${short(input.query, 70)}` };
    case 'WebFetch': return { icon: '🌐', category: 'web', text: `Đọc trang web ${host(input.url)}`, detail: input.url };
    case 'Agent': case 'Task': {
      const t = input.subagent_type || 'general-purpose';
      return { icon: '👥', category: 'agent', text: `Giao việc cho agent “${t}”: ${short(input.description, 70)}`, detail: input.prompt, link: { type: 'agent', name: t } };
    }
    case 'Skill': return { icon: '🧩', category: 'agent', text: `Dùng skill “${input.skill || input.command}”`, detail: input.args, link: { type: 'skill', name: input.skill || input.command } };
    case 'TodoWrite': {
      const todos = input.todos || [];
      const done = todos.filter(t => t.status === 'completed').length;
      return { icon: '📋', category: 'plan', text: `Cập nhật kế hoạch (${done}/${todos.length} việc xong)` };
    }
    case 'TaskCreate': return { icon: '📋', category: 'plan', text: `Thêm việc vào kế hoạch: ${short(input.subject, 70)}` };
    case 'TaskUpdate': return { icon: '📋', category: 'plan', text: `Đánh dấu việc #${input.taskId} ${TASK_STATUS[input.status] || 'đã cập nhật'}` };
    case 'TaskList': case 'TaskGet': return { icon: '📋', category: 'plan', text: 'Xem lại kế hoạch' };
    case 'AskUserQuestion': return { icon: '❓', category: 'ask', text: 'Hỏi ý kiến bạn', detail: (input.questions || []).map(q => q.question).join('\n') };
    case 'ExitPlanMode': return { icon: '🗺️', category: 'ask', text: 'Trình kế hoạch để bạn duyệt', detail: input.plan };
    case 'EnterPlanMode': return { icon: '🗺️', category: 'plan', text: 'Chuyển sang chế độ lập kế hoạch' };
    case 'ToolSearch': return { icon: '🧰', category: 'read', text: 'Tìm thêm công cụ cần dùng' };
    case 'SendMessage': return { icon: '✉️', category: 'agent', text: `Nhắn tin cho agent ${short(input.to, 40)}`, detail: input.message };
    case 'SubagentHandback': return { icon: '📤', category: 'agent', text: 'Gửi kết quả về cho agent chính', detail: input.report || input.summary };
    case 'Workflow': return { icon: '🧭', category: 'agent', text: 'Chạy quy trình nhiều agent' };
    default: break;
  }
  if (name && name.startsWith('mcp__')) {
    const parts = name.split('__');
    const server = (parts[1] || '').replace(/^plugin_[^_]+_/, '').replace(/^claude_ai_/, '').replace(/_/g, ' ');
    const tool = parts.slice(2).join(' ').replace(/[_-]/g, ' ');
    return { icon: '🔌', category: 'other', text: `Dùng công cụ “${tool}” (${server})`, detail: short(JSON.stringify(input), 2000) };
  }
  return { icon: '🔧', category: 'other', text: `Dùng công cụ ${name}`, detail: short(JSON.stringify(input), 2000) };
}

const RISKY = new Set(['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'KillShell', 'TaskStop']);
// Internal bookkeeping tools never need the user's approval.
const NEVER_ASK = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'ToolSearch', 'AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode', 'BashOutput']);

module.exports = { describeTool, short, RISKY, NEVER_ASK };
