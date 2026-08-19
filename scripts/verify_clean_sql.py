#!/usr/bin/env python3
import re

with open("/Users/hyden/Documents/David-nguyen/CFCBase/clean_database_master.sql", "r", encoding="utf-8") as f:
    content = f.read()

tables = re.findall(r"CREATE TABLE [`\"]?([a-zA-Z0-9_]+)[`\"]?", content)
print("=== KẾT QUẢ KIỂM TRA FILE CLEAN DATABASE MASTER SQL ===")
print(f"1. Tổng số bảng: {len(tables)}")
print(f"2. Bảng Users (Tài khoản & Mật khẩu): {'OK' if 'INSERT INTO `users`' in content else 'MISSING'}")
print(f"3. Bảng Booking Phòng & Xe: {'OK' if 'INSERT INTO `booking_rooms`' in content and 'INSERT INTO `booking_cars`' in content else 'MISSING'}")
print(f"4. Bảng Rooms & Vehicles: {'OK' if 'INSERT INTO `rooms`' in content and 'INSERT INTO `vehicles`' in content else 'MISSING'}")
print(f"5. Số nhân sự trong hr_employees: {content.count('INSERT INTO `hr_employees`')} người (Yêu cầu: 338)")
print(f"6. Số chi tiết trong hr_employee_employment: {content.count('INSERT INTO `hr_employee_employment`')} dòng (Yêu cầu: 338)")
print(f"7. Số chi tiết trong hr_employee_leave_entitlements: {content.count('INSERT INTO `hr_employee_leave_entitlements`')} dòng (Yêu cầu: 338)")
print(f"8. Số dòng trong hr_monthly_roster_items (T8-26): {content.count('INSERT INTO `hr_monthly_roster_items`')} dòng (Yêu cầu: 338)")
print(f"9. Ứng viên thử việc (3 người chuẩn): {'OK' if ('Lê Huy Hào' in content and 'Nguyễn Việt Khoa' in content and 'Nguyễn Trung Thuận' in content) else 'MISSING'}")
print(f"10. Kiểm tra 'Nguyễn Trung Thuậnnn' (Đã xóa sạch?): {'ĐÃ XÓA SẠCH (OK)' if ('TV-2607270642282' not in content and 'Thuậnnn' not in content) else 'STILL EXISTS'}")
print(f"11. Flyway History: {'Dọn dẹp version >= 9 (OK)' if 'DELETE FROM `flyway_schema_history`' in content else 'MISSING'}")
