#!/bin/bash
# Bấm đúp vào file này để mở Bảng điều khiển Agent.
cd "$(dirname "$0")"
URL="http://127.0.0.1:4319"
PLIST="$HOME/Library/LaunchAgents/com.agent-dashboard.plist"

# Đang chạy rồi (ví dụ đang chạy nền): chỉ cần mở trình duyệt.
if curl -fs -o /dev/null --max-time 2 "$URL/api/autostart"; then
  open "$URL"
  echo "Bảng điều khiển đang chạy. Bạn có thể đóng cửa sổ này."
  exit 0
fi

# Đã bật "Tự mở khi bật máy" nhưng đang tắt: khởi động lại bản chạy nền.
if [ -f "$PLIST" ]; then
  launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null
  launchctl kickstart "gui/$(id -u)/com.agent-dashboard" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fs -o /dev/null --max-time 1 "$URL/api/autostart"; then
      open "$URL"
      echo "Bảng điều khiển đang chạy nền. Bạn có thể đóng cửa sổ này."
      exit 0
    fi
    sleep 0.5
  done
fi

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Cần cài Node.js" message "Hãy tải Node.js tại https://nodejs.org (bản LTS), cài xong rồi bấm đúp lại file này."'
  exit 1
fi
(sleep 1.2; open "$URL") &
node server.js
