#!/bin/bash
# Bấm đúp vào file này để mở Bảng điều khiển Agent.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Cần cài Node.js" message "Hãy tải Node.js tại https://nodejs.org (bản LTS), cài xong rồi bấm đúp lại file này."'
  exit 1
fi
(sleep 1.2; open "http://127.0.0.1:4319") &
node server.js
