# 🤖 Bảng điều khiển Agent cho Claude Code

Xem các agent đang làm gì theo thời gian thực, duyệt hoặc dừng agent, và chỉnh agent hay skill (quy tắc, model, công cụ) ngay trên giao diện, không phải mở file `.md`.

## Mở bảng điều khiển
1. Bấm đúp **`start.command`** trong thư mục này. Lần đầu macOS có thể hỏi, chọn *Mở*.
2. Trình duyệt tự mở `http://127.0.0.1:4319`.
3. Bấm **Kết nối với Claude Code** (chỉ cần làm một lần), rồi mở một cửa sổ Claude Code **mới**.

Muốn tắt thì đóng cửa sổ Terminal đang chạy bảng điều khiển. Khi bảng điều khiển tắt, Claude Code vẫn chạy bình thường.

## Ba tab
| Tab | Dùng để |
|---|---|
| Hoạt động | Sơ đồ luồng của từng lượt: agent chính gọi công cụ gì, giao việc cho agent phụ nào (rẽ nhánh sang cột riêng), nhận kết quả về. Bấm vào ô để xem chi tiết. Có **Dừng**, **Nhắn cho agent**, **Cho phép / Từ chối** |
| Agent & Skill | Bấm vào thẻ để đổi model, mô tả, công cụ, quy tắc. Đổi model cho nhiều mục cùng lúc. Có lịch sử để khôi phục |
| Cài đặt | Kết nối hoặc ngắt kết nối, chọn mức duyệt, đổi model cửa sổ chính, bật thông báo |

## Cần biết
- Sửa agent hoặc skill có hiệu lực từ **lần chạy tiếp theo**. Lần đang chạy dở không đổi.
- **Dừng** có hiệu lực ở bước kế tiếp. Bước đang chạy dở sẽ được làm cho xong.
- Agent chỉ chờ bạn duyệt khi trang này đang mở. Quá thời gian chờ thì Claude Code hỏi lại trong Terminal như cũ.
- Skill từ plugin hoặc claude.ai chỉ xem được. Bấm **Tạo bản sao để chỉnh** để có bản của riêng bạn.
- Mỗi lần kết nối hoặc ngắt kết nối, file `~/.claude/settings.json` được sao lưu thành `settings.json.bak-agent-dashboard-*`.

## Kỹ thuật
Node.js ≥ 18, không cần cài thư viện. Server chỉ nghe ở `127.0.0.1`. Dữ liệu (nhật ký bước, lịch sử chỉnh sửa) nằm trong `data/`.
- `server.js`: API, realtime (SSE), duyệt, dừng, nhắn tin
- `hook.js`: hook của Claude Code, gửi sự kiện về server, tự bỏ qua nếu server không chạy
- `lib/`: đọc/ghi frontmatter, quét agent/skill, cài hook
- `public/`: giao diện
