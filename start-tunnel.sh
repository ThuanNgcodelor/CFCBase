#!/bin/bash

# Script khởi động nhanh Cloudflare Tunnel cho BookingBase
# Tên miền chính: https://cfcbooking.io.vn
# Tên miền API:   https://api.cfcbooking.io.vn

echo "============================================="
echo "   Khởi động Cloudflare Tunnel cho BookingBase"
echo "============================================="

# Đường dẫn file config mặc định
CONFIG_PATH="/home/david-nguyen/.cloudflared/config.yml"
TUNNEL_ID="9af3b453-b2c4-4f31-a4a8-bbd2941c41d0"

if [ ! -f "$CONFIG_PATH" ]; then
    echo "Lỗi: Không tìm thấy file config tại $CONFIG_PATH"
    echo "Đang thử copy từ thư mục dự án..."
    mkdir -p ~/.cloudflared
    cp cloudflared-config.yml "$CONFIG_PATH"
fi

echo "-> Đang chạy tunnel $TUNNEL_ID..."
echo "-> Nhấn Ctrl + C để dừng tunnel."
echo "---------------------------------------------"

cloudflared tunnel --config "$CONFIG_PATH" run "$TUNNEL_ID"
