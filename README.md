# 🤖 Bảng điều khiển Agent cho Claude Code

Xem từng vòng làm việc của AI: đang làm bước nào, giao việc cho agent nào, dùng skill nào. Đổi model và sửa hướng dẫn của agent/skill ngay trên giao diện, không phải mở file `.md`. Dành cho cả người không làm kỹ thuật.

## Mở bảng điều khiển
1. Bấm đúp **`start.command`** trong thư mục này. Lần đầu macOS có thể hỏi, chọn *Mở*.
2. Trình duyệt tự mở `http://127.0.0.1:4319`.
3. Bấm **Kết nối với Claude Code** (chỉ cần làm một lần), rồi mở một cửa sổ Claude Code **mới**.

Muốn tắt thì đóng cửa sổ Terminal đang chạy bảng điều khiển. Khi bảng điều khiển tắt, Claude Code vẫn chạy bình thường.

## Ba tab
| Tab | Dùng để |
|---|---|
| Hoạt động | Mỗi lần bạn giao việc là một **vòng**, vẽ thành sơ đồ các bước nối nhau như n8n: yêu cầu của bạn → kế hoạch → agent nào được giao việc gì (agent chạy song song nằm chồng lên nhau trong cùng một cột) → skill nào được dùng → xong. Chọn vòng ở thanh phía trên. Kéo để di chuyển, Ctrl + cuộn để phóng to. **Bấm vào một bước** để mở bảng 3 cột: *Đầu vào* (việc được giao), *Thiết lập* (đổi model, “khi nào dùng”, hướng dẫn, rồi Lưu), *Đầu ra* (kết quả, file tạo ra). Dùng “Bước trước / Bước sau” để đi qua từng bước |
| Agent & Skill | Mọi agent và skill trên máy. Đổi model ngay trên thẻ (lưu luôn). Bấm vào thẻ để mở cùng bảng 3 cột như trên, với đầu vào / đầu ra của lần chạy gần nhất. Có lịch sử để khôi phục |
| Cài đặt | Kết nối hoặc ngắt kết nối, đổi model của agent chính, thêm thư mục dự án |

## Cần biết
- Bảng điều khiển **chỉ xem**, không chặn hay thay đổi việc Claude Code đang làm.
- Đổi model hoặc hướng dẫn có hiệu lực từ **lần chạy tiếp theo**. Lần đang chạy dở không đổi.
- Agent có sẵn của Claude Code (như `general-purpose`, `Explore`) không có file thiết lập nên không đổi model được. Muốn chỉnh, hãy tạo agent riêng.
- Skill từ plugin hoặc claude.ai chỉ xem được. Bấm **Tạo bản sao để chỉnh** để có bản của riêng bạn.
- Mỗi lần kết nối hoặc ngắt kết nối, file `~/.claude/settings.json` được sao lưu thành `settings.json.bak-agent-dashboard-*`.
- Muốn gửi link một phiên cụ thể: `http://127.0.0.1:4319/?s=<mã phiên>`.

## Kỹ thuật
Node.js ≥ 18, không cần cài thư viện. Server chỉ nghe ở `127.0.0.1`. Dữ liệu (nhật ký bước, lịch sử chỉnh sửa) nằm trong `data/`.
- `server.js`: nhận sự kiện từ hook, gom thành phiên / vòng, API và realtime (SSE)
- `hook.js`: hook của Claude Code, gửi sự kiện về server, tự bỏ qua nếu server không chạy, không bao giờ chặn
- `lib/`: đọc/ghi frontmatter, quét agent/skill, cài hook
- `public/`: giao diện
