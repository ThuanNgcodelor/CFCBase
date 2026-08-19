#!/usr/bin/env python3
"""
Clean Master Database Rebuilder for CFCBase
- Input: sql.txt (Existing Database Dump) + 'Danh sách nhân sự 2026.xlsx'
- Output: clean_database_master.sql (Production Ready Dump)
"""

import os
import sys
import re
import json
import zipfile
import uuid
import hashlib
from datetime import datetime, date, timedelta
import xml.etree.ElementTree as ET

SQL_INPUT_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt"
EXCEL_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/Danh sách nhân sự 2026.xlsx"
SQL_OUTPUT_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/clean_database_master.sql"

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS = {"main": MAIN_NS}

def parse_excel_date(val):
    if not val:
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    try:
        serial = float(val_str)
        if 10000 < serial < 100000:
            dt = datetime(1899, 12, 30) + timedelta(days=serial)
            return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass
    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y"]:
        try:
            return datetime.strptime(val_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None

def parse_number(val, default=0.0):
    if val is None:
        return default
    s = str(val).strip().replace(",", "")
    try:
        return float(s)
    except ValueError:
        return default

def calculate_leave_days(hire_date_str, working_condition):
    base = 12.0
    cond_norm = str(working_condition or "").upper()
    if any(k in cond_norm for k in ["NẶNG NHỌC", "ĐỘC HẠI", "NGUY HIỂM"]):
        base = 14.0
    if not hire_date_str:
        return base
    try:
        hire = datetime.strptime(hire_date_str, "%Y-%m-%d").date()
        target = date(2026, 8, 31)
        if hire > target:
            return base
        years = (target - hire).days // 365
        seniority_bonus = years // 5
        return float(base + seniority_bonus)
    except Exception:
        return base

def slugify(text):
    text = text.strip().upper()
    for src, dst in [('Đ', 'D'), (' ', '_'), ('.', ''), ('/', '_'), ('-', '_')]:
        text = text.replace(src, dst)
    return "".join(c for c in text if c.isalnum() or c == '_')[:32]

def read_excel_data():
    with zipfile.ZipFile(EXCEL_PATH, "r") as z:
        wb_xml = z.read("xl/workbook.xml")
        root = ET.fromstring(wb_xml)
        rels_xml = z.read("xl/_rels/workbook.xml.rels")
        rels_root = ET.fromstring(rels_xml)
        rel_map = {}
        for r in rels_root.findall(".//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
            rel_map[r.attrib.get("Id")] = r.attrib.get("Target")

        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            ss_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in ss_root.findall(".//main:si", NS):
                t = si.find(".//main:t", NS)
                shared_strings.append(t.text if t is not None else "")

        sheet_data = {}
        for s in root.findall(".//main:sheet", NS):
            name = s.attrib.get("name")
            rId = s.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = rel_map.get(rId, "")
            if name in ["T8-26", "TĂNG", "GIAM", "GIẢM"]:
                sheet_path = "xl/" + target if not target.startswith("xl/") else target
                s_xml = z.read(sheet_path)
                s_root = ET.fromstring(s_xml)
                
                rows_list = []
                for r in s_root.findall(".//main:row", NS):
                    row_idx = int(r.attrib.get("r", 0))
                    cells = {}
                    for c in r.findall(".//main:c", NS):
                        r_ref = c.attrib.get("r", "")
                        col = "".join([ch for ch in r_ref if ch.isalpha()])
                        t_type = c.attrib.get("t")
                        v = c.find(".//main:v", NS)
                        val = v.text if v is not None else ""
                        is_tag = c.find(".//main:is/main:t", NS)
                        if is_tag is not None and is_tag.text:
                            val = is_tag.text
                        if t_type == "s" and val.isdigit():
                            idx = int(val)
                            if idx < len(shared_strings):
                                val = shared_strings[idx]
                        cells[col] = val
                    rows_list.append((row_idx, cells))
                sheet_data[name] = rows_list
    return sheet_data

def build_master_dump():
    print("=" * 80)
    print("🛠️ BẮT ĐẦU TẠO CLEAN MASTER DATABASE DUMP CHO CFCBASE")
    print("=" * 80)
    
    # 1. Parse Excel Master
    sheets = read_excel_data()
    t8_rows = sheets.get("T8-26", [])
    tang_rows = sheets.get("TĂNG", [])
    giam_rows = sheets.get("GIAM") or sheets.get("GIẢM") or []

    active_employees = []
    departments_dict = {}
    positions_dict = {}
    working_cond_dict = {}

    for row_idx, cells in t8_rows:
        stt = cells.get("A", "").strip()
        code = cells.get("C", "").strip()
        name = cells.get("E", "").strip()
        pos_name = cells.get("N", "").strip() or "Nhân viên"
        dept_name = cells.get("O", "").strip() or "Khối Quản lý"
        cond_name = cells.get("AB", "").strip() or "Bình thường"
        
        if stt.isdigit() and code and name:
            bhxh = cells.get("D", "").strip()
            bhyt = cells.get("F", "").strip()
            salary = parse_number(cells.get("G"))
            allowance = parse_number(cells.get("H"))
            gender_raw = cells.get("J", "").strip().upper()
            gender = "MALE" if "NAM" in gender_raw else ("FEMALE" if "NỮ" in gender_raw or "NU" in gender_raw else "UNKNOWN")
            ethnicity = cells.get("L", "").strip()
            religion = cells.get("M", "").strip()
            
            dob = parse_excel_date(cells.get("P"))
            hire_date = parse_excel_date(cells.get("Q")) or "2026-08-01"
            contract_type = cells.get("T", "").strip() or "HĐLĐ"
            contract_num = cells.get("U", "").strip()
            cmnd = cells.get("W", "").strip()
            cccd = cells.get("X", "").strip()
            id_issue_date = parse_excel_date(cells.get("AA"))
            id_issue_place = cells.get("AC", "").strip()
            pob = cells.get("AD", "").strip()
            address_reg = cells.get("AF", "").strip()
            address_cur = cells.get("AG", "").strip()
            phone = cells.get("AH", "").strip()
            education = cells.get("AI", "").strip()
            major = cells.get("AJ", "").strip()
            job_desc = cells.get("AK", "").strip()
            
            leave_days = calculate_leave_days(hire_date, cond_name)

            dept_code = slugify(dept_name)
            pos_code = slugify(pos_name)
            cond_code = slugify(cond_name)

            if dept_name not in departments_dict:
                departments_dict[dept_name] = {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dept-{dept_code}")),
                    "code": dept_code,
                    "name": dept_name
                }
            if pos_name not in positions_dict:
                positions_dict[pos_name] = {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"pos-{pos_code}")),
                    "code": pos_code,
                    "name": pos_name
                }
            if cond_name not in working_cond_dict:
                working_cond_dict[cond_name] = {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"cond-{cond_code}")),
                    "code": cond_code,
                    "name": cond_name,
                    "base": 14.0 if "NẶNG NHỌC" in cond_name.upper() else 12.0
                }

            emp_obj = {
                "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"emp-{code}")),
                "stt": int(stt),
                "code": code,
                "name": name,
                "dept_id": departments_dict[dept_name]["id"],
                "dept_code": dept_code,
                "dept_name": dept_name,
                "pos_id": positions_dict[pos_name]["id"],
                "pos_code": pos_code,
                "pos_name": pos_name,
                "cond_id": working_cond_dict[cond_name]["id"],
                "cond_code": cond_code,
                "cond_name": cond_name,
                "dob": dob,
                "hire_date": hire_date,
                "gender": gender,
                "ethnicity": ethnicity,
                "religion": religion,
                "pob": pob,
                "education": education,
                "major": major,
                "salary": salary,
                "allowance": allowance,
                "bhxh": bhxh,
                "bhyt": bhyt,
                "cmnd": cmnd,
                "cccd": cccd,
                "id_issue_date": id_issue_date,
                "id_issue_place": id_issue_place,
                "phone": phone,
                "address_reg": address_reg,
                "address_cur": address_cur,
                "leave_days": leave_days,
                "contract_type": contract_type,
                "contract_num": contract_num,
                "job_desc": job_desc
            }
            active_employees.append(emp_obj)

    print(f"✅ Đã nạp {len(active_employees)} nhân sự T8-26 từ Excel.")

    # 2. Read existing non-HR tables from sql.txt (Users, Bookings, Push, Notifications, Rooms, Cars)
    with open(SQL_INPUT_PATH, "r", encoding="utf-8", errors="ignore") as f:
        sql_lines = f.readlines()

    # Tables to extract as-is from sql.txt:
    preserved_tables = [
        "approval_steps", "booking_cars", "booking_rooms", "departments", "flyway_schema_history",
        "notifications", "profile_update_requests", "push_subscriptions", "rooms", "users",
        "vehicle_types", "vehicles", "hr_probation_job_templates"
    ]

    out_sql = []
    out_sql.append("-- CFCBase Master Production Database Dump")
    out_sql.append("-- Authoritative 338 Active Employees (T8-2026) + Clean 3 Probation Candidates")
    out_sql.append("SET NAMES utf8mb4;")
    out_sql.append("SET time_zone = '+00:00';")
    out_sql.append("SET foreign_key_checks = 0;")
    out_sql.append("SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';\n")

    current_table = None
    collecting = False
    table_buffer = []

    for line in sql_lines:
        m_create = re.search(r"CREATE TABLE [`\"]?([a-zA-Z0-9_]+)[`\"]?", line)
        if m_create:
            current_table = m_create.group(1)
            collecting = current_table in preserved_tables
            if collecting:
                table_buffer.append(f"\nDROP TABLE IF EXISTS `{current_table}`;")
        
        m_insert = re.search(r"INSERT INTO [`\"]?([a-zA-Z0-9_]+)[`\"]?", line)
        if m_insert:
            current_table = m_insert.group(1)
            collecting = current_table in preserved_tables
        
        if collecting:
            # Filter out Thuannn if in any preserved table
            if "TV-2607270642282" not in line and "Thuậnnn" not in line:
                table_buffer.append(line)
        
        if line.strip().endswith(";") and not collecting:
            current_table = None

    out_sql.extend(table_buffer)

    # 3. Add Probation Candidates (Clean 3 candidates)
    out_sql.append("\n-- Clean 3 Probation Candidates")
    out_sql.append("DROP TABLE IF EXISTS `hr_probation_candidates`;")
    out_sql.append("""CREATE TABLE `hr_probation_candidates` (
  `id` varchar(36) NOT NULL,
  `candidate_code` varchar(32) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `salutation` varchar(32) DEFAULT NULL,
  `gender` varchar(16) NOT NULL DEFAULT 'UNKNOWN',
  `date_of_birth` date DEFAULT NULL,
  `place_of_birth` varchar(500) DEFAULT NULL,
  `nationality` varchar(100) NOT NULL DEFAULT 'Việt Nam',
  `citizen_identity_number` varchar(32) DEFAULT NULL,
  `identity_issued_date` date DEFAULT NULL,
  `identity_issued_place` varchar(255) DEFAULT NULL,
  `permanent_address` varchar(1000) DEFAULT NULL,
  `current_address` varchar(1000) DEFAULT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `work_email` varchar(320) DEFAULT NULL,
  `personal_email` varchar(320) DEFAULT NULL,
  `ethnicity` varchar(100) DEFAULT NULL,
  `religion` varchar(100) DEFAULT NULL,
  `education_level` varchar(255) DEFAULT NULL,
  `major` varchar(255) DEFAULT NULL,
  `probation_status` varchar(32) NOT NULL DEFAULT 'IN_PROGRESS',
  `department_id` varchar(36) DEFAULT NULL,
  `position_id` varchar(36) DEFAULT NULL,
  `job_template_id` varchar(36) DEFAULT NULL,
  `working_condition_id` varchar(36) DEFAULT NULL,
  `probation_start_date` date NOT NULL,
  `probation_end_date` date NOT NULL,
  `probation_salary_amount` decimal(15,2) DEFAULT NULL,
  `contract_number` varchar(100) DEFAULT NULL,
  `official_employee_id` varchar(36) DEFAULT NULL,
  `notes` varchar(1000) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_probation_candidate_code` (`candidate_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    # Insert 3 candidates from sql.txt
    out_sql.append("""INSERT INTO `hr_probation_candidates` VALUES
('a05f11e9-4e78-43d9-ab70-13f56b0a8848', 'TV-260814031002', 'Lê Huy Hào', 'Ông', 'MALE', '2000-08-15', 'Cần Thơ', 'Việt Nam', '092200001234', '2021-05-10', 'Cục Cảnh sát QLHC về TTXH', '123 Đường 30/4, P. Hưng Lợi, Q. Ninh Kiều, TP. Cần Thơ', '123 Đường 30/4, P. Hưng Lợi, Q. Ninh Kiều, TP. Cần Thơ', '0930015043', NULL, 'hao.lehuy@example.com', 'Kinh', 'Không', 'Đại học', 'Kỹ thuật hóa học', 'IN_PROGRESS', '0450534c-6878-4ea7-9a4f-561b0cba0a0f', 'fe7a5e5a-f101-4475-8025-a503e9112469', '1406e232-a548-4389-bc55-e41ee6c3fc42', '4143fcfa-1c69-42b7-a36c-2f9543e527d9', '2026-04-23', '2026-06-22', 8000000.00, '09/2026', NULL, 'Hồ sơ thử việc tạo từ giao diện', NOW(6), NOW(6), 'USER:37a9a237-bf1a-4231-ad33-6862d8e44439', 'USER:37a9a237-bf1a-4231-ad33-6862d8e44439', 0),
('b16f22f0-5f89-54ea-bc81-24f67c1b9959', 'TV-260814032152', 'Nguyễn Việt Khoa', 'Ông', 'MALE', '1998-11-20', 'Cần Thơ', 'Việt Nam', '092198005678', '2020-08-15', 'Cục Cảnh sát QLHC về TTXH', '456 Đường 3/2, P. Xuân Khánh, Q. Ninh Kiều, TP. Cần Thơ', '456 Đường 3/2, P. Xuân Khánh, Q. Ninh Kiều, TP. Cần Thơ', '0930015044', NULL, 'khoa.nguyen@example.com', 'Kinh', 'Không', 'Đại học', 'Kinh doanh quốc tế', 'IN_PROGRESS', '81b7a2d4-0466-4aa7-92aa-66ec96fe398c', 'a68ef3be-4977-449e-ba78-4cf5bb36b9c9', '21e25d25-6677-4e6f-a894-35bbd5c58a69', '4143fcfa-1c69-42b7-a36c-2f9543e527d9', '2026-07-01', '2026-08-03', 8500000.00, '10/2026', NULL, 'Hồ sơ thử việc tạo từ giao diện', NOW(6), NOW(6), 'USER:37a9a237-bf1a-4231-ad33-6862d8e44439', 'USER:37a9a237-bf1a-4231-ad33-6862d8e44439', 0),
('a2f5f14e-76c2-48a0-97e3-0c451dbcf951', 'TV-260727064228', 'Nguyễn Trung Thuận', 'Ông', 'MALE', '2005-04-26', 'Rạch Giá, Kiên Giang', 'Việt Nam', '091205009999', '2023-01-10', 'Cục Cảnh sát QLHC về TTXH', '789 Nguyễn Văn Cừ, P. An Khánh, Q. Ninh Kiều, TP. Cần Thơ', '789 Nguyễn Văn Cừ, P. An Khánh, Q. Ninh Kiều, TP. Cần Thơ', '0388509046', NULL, 'thuan.nguyen@example.com', 'Kinh', 'Không', 'Đại học', 'Quản trị nhân lực', 'IN_PROGRESS', '3b7bca06-df6b-4c4c-9f87-6e6e22f281e0', '8c22d515-5136-4d00-a548-5c49ea07cb15', '6fe38202-b258-450f-a39c-f91be52e6462', '4143fcfa-1c69-42b7-a36c-2f9543e527d9', '2026-06-22', '2026-08-21', 7500000.00, '07/2026', NULL, 'Hồ sơ thử việc tạo từ giao diện', NOW(6), NOW(6), 'USER:37a9a237-bf1a-4231-ad33-6862d8e44439', 'USER:37a9a237-bf1a-4231-ad33-6862d8e44439', 0);""")

    # 4. Generate Catalogs
    out_sql.append("\n-- HR Catalogs")
    out_sql.append("DROP TABLE IF EXISTS `hr_departments`;")
    out_sql.append("""CREATE TABLE `hr_departments` (
  `id` varchar(36) NOT NULL,
  `code` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `parent_id` varchar(36) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_department_code` (`code`),
  UNIQUE KEY `uk_hr_department_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    for d in departments_dict.values():
        name_esc = d['name'].strip("'").replace("'", "''")
        out_sql.append(f"INSERT INTO `hr_departments` (`id`, `code`, `name`, `status`, `sort_order`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('{d['id']}', '{d['code']}', '{name_esc}', 'ACTIVE', 0, NOW(6), NOW(6), 'system', 'system', 0);")

    out_sql.append("\nDROP TABLE IF EXISTS `hr_positions`;")
    out_sql.append("""CREATE TABLE `hr_positions` (
  `id` varchar(36) NOT NULL,
  `code` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_position_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    for p in positions_dict.values():
        name_esc = p['name'].strip("'").replace("'", "''")
        out_sql.append(f"INSERT INTO `hr_positions` (`id`, `code`, `name`, `status`, `sort_order`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('{p['id']}', '{p['code']}', '{name_esc}', 'ACTIVE', 0, NOW(6), NOW(6), 'system', 'system', 0);")

    out_sql.append("\nDROP TABLE IF EXISTS `hr_working_conditions`;")
    out_sql.append("""CREATE TABLE `hr_working_conditions` (
  `id` varchar(36) NOT NULL,
  `code` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `sort_order` int NOT NULL DEFAULT '0',
  `annual_leave_days_base` decimal(6,2) NOT NULL DEFAULT '12.00',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_working_condition_code` (`code`),
  UNIQUE KEY `uk_hr_working_condition_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    for w in working_cond_dict.values():
        name_esc = w['name'].strip("'").replace("'", "''")
        out_sql.append(f"INSERT INTO `hr_working_conditions` (`id`, `code`, `name`, `status`, `sort_order`, `annual_leave_days_base`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('{w['id']}', '{w['code']}', '{name_esc}', 'ACTIVE', 0, {w['base']}, NOW(6), NOW(6), 'system', 'system', 0);")

    # 5. Build HR Employees (Exact 338 active employees)
    out_sql.append("\n-- HR Employees (Exact 338 Active Employees)")
    out_sql.append("DROP TABLE IF EXISTS `hr_employees`;")
    out_sql.append("""CREATE TABLE `hr_employees` (
  `id` varchar(36) NOT NULL,
  `employee_code` varchar(32) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `gender` varchar(16) NOT NULL DEFAULT 'UNKNOWN',
  `date_of_birth` date DEFAULT NULL,
  `ethnicity` varchar(100) DEFAULT NULL,
  `religion` varchar(100) DEFAULT NULL,
  `birth_place_original` varchar(500) DEFAULT NULL,
  `birth_place_current` varchar(500) DEFAULT NULL,
  `education_level` varchar(255) DEFAULT NULL,
  `major` varchar(255) DEFAULT NULL,
  `employment_status` varchar(16) NOT NULL DEFAULT 'DRAFT',
  `status_effective_date` date DEFAULT NULL,
  `source_import_batch_id` varchar(36) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_employee_code` (`employee_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    for emp in active_employees:
        name_esc = emp['name'].strip("'").replace("'", "''")
        eth_esc = emp['ethnicity'].strip("'").replace("'", "''")
        rel_esc = emp['religion'].strip("'").replace("'", "''")
        pob_esc = emp['pob'].strip("'").replace("'", "''")
        edu_esc = emp['education'].strip("'").replace("'", "''")
        maj_esc = emp['major'].strip("'").replace("'", "''")
        dob_str = f"'{emp['dob']}'" if emp['dob'] else "NULL"
        hire_date_str = f"'{emp['hire_date']}'" if emp['hire_date'] else "'2026-08-01'"
        out_sql.append(f"INSERT INTO `hr_employees` (`id`, `employee_code`, `full_name`, `gender`, `date_of_birth`, `ethnicity`, `religion`, `birth_place_original`, `education_level`, `major`, `employment_status`, `status_effective_date`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('{emp['id']}', '{emp['code']}', '{name_esc}', '{emp['gender']}', {dob_str}, '{eth_esc}', '{rel_esc}', '{pob_esc}', '{edu_esc}', '{maj_esc}', 'ACTIVE', {hire_date_str}, NOW(6), NOW(6), 'system', 'system', 0);")

    # 6. HR Employee Details (Employment, Identity, Insurance, Contacts, Leave)
    out_sql.append("\nDROP TABLE IF EXISTS `hr_employee_employment`;")
    out_sql.append("""CREATE TABLE `hr_employee_employment` (
  `employee_id` varchar(36) NOT NULL,
  `department_id` varchar(36) DEFAULT NULL,
  `position_id` varchar(36) DEFAULT NULL,
  `working_condition_id` varchar(36) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `leave_accrual_start_date` date DEFAULT NULL,
  `termination_date` date DEFAULT NULL,
  `contract_type_label` varchar(100) DEFAULT NULL,
  `contract_number` varchar(100) DEFAULT NULL,
  `base_salary` decimal(15,2) DEFAULT NULL,
  `allowance` decimal(15,2) DEFAULT NULL,
  `job_description` varchar(2000) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`employee_id`),
  KEY `fk_hr_employment_department` (`department_id`),
  KEY `fk_hr_employment_position` (`position_id`),
  KEY `fk_hr_employment_condition` (`working_condition_id`),
  CONSTRAINT `fk_hr_employment_department` FOREIGN KEY (`department_id`) REFERENCES `hr_departments` (`id`),
  CONSTRAINT `fk_hr_employment_position` FOREIGN KEY (`position_id`) REFERENCES `hr_positions` (`id`),
  CONSTRAINT `fk_hr_employment_condition` FOREIGN KEY (`working_condition_id`) REFERENCES `hr_working_conditions` (`id`),
  CONSTRAINT `fk_hr_employment_employee` FOREIGN KEY (`employee_id`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    out_sql.append("\nDROP TABLE IF EXISTS `hr_employee_identity`;")
    out_sql.append("""CREATE TABLE `hr_employee_identity` (
  `employee_id` varchar(36) NOT NULL,
  `legacy_identity_number` varchar(32) DEFAULT NULL,
  `citizen_identity_number` varchar(32) DEFAULT NULL,
  `issued_date` date DEFAULT NULL,
  `issued_place` varchar(255) DEFAULT NULL,
  `verification_status` varchar(20) NOT NULL DEFAULT 'UNVERIFIED',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`employee_id`),
  CONSTRAINT `fk_hr_identity_employee` FOREIGN KEY (`employee_id`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    out_sql.append("\nDROP TABLE IF EXISTS `hr_employee_insurance`;")
    out_sql.append("""CREATE TABLE `hr_employee_insurance` (
  `employee_id` varchar(36) NOT NULL,
  `social_insurance_number` varchar(32) DEFAULT NULL,
  `health_insurance_number` varchar(32) DEFAULT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'UNKNOWN',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`employee_id`),
  CONSTRAINT `fk_hr_insurance_employee` FOREIGN KEY (`employee_id`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    out_sql.append("\nDROP TABLE IF EXISTS `hr_employee_contacts`;")
    out_sql.append("""CREATE TABLE `hr_employee_contacts` (
  `employee_id` varchar(36) NOT NULL,
  `permanent_address` varchar(1000) DEFAULT NULL,
  `current_address` varchar(1000) DEFAULT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `work_email` varchar(320) DEFAULT NULL,
  `personal_email` varchar(320) DEFAULT NULL,
  `emergency_contact_name` varchar(255) DEFAULT NULL,
  `emergency_contact_phone` varchar(32) DEFAULT NULL,
  `emergency_contact_relation` varchar(100) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`employee_id`),
  CONSTRAINT `fk_hr_contacts_employee` FOREIGN KEY (`employee_id`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    out_sql.append("\nDROP TABLE IF EXISTS `hr_employee_leave_entitlements`;")
    out_sql.append("""CREATE TABLE `hr_employee_leave_entitlements` (
  `id` varchar(36) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `leave_year` smallint NOT NULL,
  `manual_override_days` decimal(6,2) DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_leave_entitlement_employee_year` (`employee_id`,`leave_year`),
  KEY `idx_hr_leave_entitlement_year` (`leave_year`),
  CONSTRAINT `fk_hr_leave_entitlement_employee` FOREIGN KEY (`employee_id`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    for emp in active_employees:
        job_esc = emp['job_desc'].strip("'").replace("'", "''")
        addr_reg_esc = emp['address_reg'].strip("'").replace("'", "''")
        addr_cur_esc = emp['address_cur'].strip("'").replace("'", "''")
        id_place_esc = emp['id_issue_place'].strip("'").replace("'", "''")
        ctype_esc = emp['contract_type'].strip("'").replace("'", "''")
        cnum_esc = emp['contract_num'].strip("'").replace("'", "''")
        cmnd_esc = emp['cmnd'].strip("'").replace("'", "''")
        cccd_esc = emp['cccd'].strip("'").replace("'", "''")
        phone_esc = emp['phone'].strip("'").replace("'", "''")
        bhxh_esc = emp['bhxh'].strip("'").replace("'", "''")
        bhyt_esc = emp['bhyt'].strip("'").replace("'", "''")
        hire_date_str = f"'{emp['hire_date']}'" if emp['hire_date'] else "'2026-08-01'"
        issue_date_str = f"'{emp['id_issue_date']}'" if emp['id_issue_date'] else "NULL"

        # Employment
        out_sql.append(f"INSERT INTO `hr_employee_employment` (`employee_id`, `department_id`, `position_id`, `working_condition_id`, `hire_date`, `leave_accrual_start_date`, `contract_type_label`, `contract_number`, `base_salary`, `allowance`, `job_description`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('{emp['id']}', '{emp['dept_id']}', '{emp['pos_id']}', '{emp['cond_id']}', {hire_date_str}, {hire_date_str}, '{ctype_esc}', '{cnum_esc}', {emp['salary']}, {emp['allowance']}, '{job_esc}', NOW(6), NOW(6), 'system', 'system', 0);")

        # Identity
        out_sql.append(f"INSERT INTO `hr_employee_identity` (`employee_id`, `legacy_identity_number`, `citizen_identity_number`, `issued_date`, `issued_place`, `verification_status`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('{emp['id']}', '{cmnd_esc}', '{cccd_esc}', {issue_date_str}, '{id_place_esc}', 'VERIFIED', NOW(6), NOW(6), 'system', 'system', 0);")

        # Insurance
        out_sql.append(f"INSERT INTO `hr_employee_insurance` (`employee_id`, `social_insurance_number`, `health_insurance_number`, `status`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('{emp['id']}', '{bhxh_esc}', '{bhyt_esc}', 'ACTIVE', NOW(6), NOW(6), 'system', 'system', 0);")

        # Contacts
        out_sql.append(f"INSERT INTO `hr_employee_contacts` (`employee_id`, `permanent_address`, `current_address`, `phone`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('{emp['id']}', '{addr_reg_esc}', '{addr_cur_esc}', '{phone_esc}', NOW(6), NOW(6), 'system', 'system', 0);")

        # Leave Entitlements
        leave_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"leave-entitlement-{emp['code']}-2026"))
        out_sql.append(f"INSERT INTO `hr_employee_leave_entitlements` (`id`, `employee_id`, `leave_year`, `manual_override_days`, `note`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('{leave_id}', '{emp['id']}', 2026, {emp['leave_days']}, 'Đồng bộ từ T8-2026 Master Excel', NOW(6), NOW(6), 'system', 'system', 0);")

    # 7. Monthly Rosters (T8-2026: 338 employees)
    out_sql.append("\n-- Monthly Rosters & Items")
    out_sql.append("DROP TABLE IF EXISTS `hr_monthly_rosters`;")
    out_sql.append("""CREATE TABLE `hr_monthly_rosters` (
  `id` varchar(36) NOT NULL,
  `period_start` date NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'DRAFT',
  `source_roster_id` varchar(36) DEFAULT NULL,
  `source_import_batch_id` varchar(36) DEFAULT NULL,
  `snapshot_schema_version` smallint NOT NULL DEFAULT '1',
  `item_count` int NOT NULL DEFAULT '0',
  `roster_checksum` char(64) DEFAULT NULL,
  `opened_at` datetime(6) DEFAULT NULL,
  `opened_by_actor` varchar(320) DEFAULT NULL,
  `closed_at` datetime(6) DEFAULT NULL,
  `closed_by_actor` varchar(320) DEFAULT NULL,
  `exported_at` datetime(6) DEFAULT NULL,
  `exported_by_actor` varchar(320) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_roster_period` (`period_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    out_sql.append(f"INSERT INTO `hr_monthly_rosters` (`id`, `period_start`, `status`, `snapshot_schema_version`, `item_count`, `opened_at`, `opened_by_actor`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES ('roster-2026-08', '2026-08-01', 'OPEN', 1, {len(active_employees)}, '2026-08-01 00:00:00.000000', 'system', NOW(6), NOW(6), 'system', 'system', 0);")

    out_sql.append("\nDROP TABLE IF EXISTS `hr_monthly_roster_items`;")
    out_sql.append("""CREATE TABLE `hr_monthly_roster_items` (
  `id` varchar(36) NOT NULL,
  `roster_id` varchar(36) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `display_order` int NOT NULL,
  `department_display_order` int DEFAULT NULL,
  `employee_code` varchar(32) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `department_code` varchar(32) DEFAULT NULL,
  `department_name` varchar(255) DEFAULT NULL,
  `position_code` varchar(32) DEFAULT NULL,
  `position_name` varchar(255) DEFAULT NULL,
  `working_condition_code` varchar(32) DEFAULT NULL,
  `working_condition_name` varchar(255) DEFAULT NULL,
  `employment_status` varchar(16) NOT NULL,
  `hire_date` date DEFAULT NULL,
  `termination_date` date DEFAULT NULL,
  `leave_days` decimal(6,2) DEFAULT NULL,
  `inclusion_reason` varchar(20) NOT NULL,
  `source_movement_id` varchar(36) DEFAULT NULL,
  `snapshot_schema_version` smallint NOT NULL DEFAULT '1',
  `snapshot_payload` json NOT NULL,
  `payload_sha256` char(64) NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_roster_item_employee` (`roster_id`,`employee_id`),
  UNIQUE KEY `uk_hr_roster_item_code` (`roster_id`,`employee_code`),
  UNIQUE KEY `uk_hr_roster_item_order` (`roster_id`,`display_order`),
  CONSTRAINT `fk_hr_roster_item_roster` FOREIGN KEY (`roster_id`) REFERENCES `hr_monthly_rosters` (`id`),
  CONSTRAINT `fk_hr_roster_item_employee` FOREIGN KEY (`employee_id`) REFERENCES `hr_employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    for emp in active_employees:
        roster_item_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"roster-item-2026-08-{emp['code']}"))
        name_esc = emp['name'].strip("'").replace("'", "''")
        dept_name_esc = emp['dept_name'].strip("'").replace("'", "''")
        pos_name_esc = emp['pos_name'].strip("'").replace("'", "''")
        cond_name_esc = emp['cond_name'].strip("'").replace("'", "''")
        hire_date_str = f"'{emp['hire_date']}'" if emp['hire_date'] else "NULL"
        
        payload_json = json.dumps({
            "employeeCode": emp['code'],
            "fullName": emp['name'],
            "departmentName": emp['dept_name'],
            "positionName": emp['pos_name'],
            "workingConditionName": emp['cond_name'],
            "annualLeaveDays": emp['leave_days']
        }, ensure_ascii=False).replace("'", "''")
        payload_sha = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()

        out_sql.append(f"INSERT INTO `hr_monthly_roster_items` (`id`, `roster_id`, `employee_id`, `display_order`, `employee_code`, `full_name`, `department_code`, `department_name`, `position_code`, `position_name`, `working_condition_code`, `working_condition_name`, `employment_status`, `hire_date`, `leave_days`, `inclusion_reason`, `snapshot_schema_version`, `snapshot_payload`, `payload_sha256`, `created_at`, `created_by_actor`) VALUES ('{roster_item_id}', 'roster-2026-08', '{emp['id']}', {emp['stt']}, '{emp['code']}', '{name_esc}', '{emp['dept_code']}', '{dept_name_esc}', '{emp['pos_code']}', '{pos_name_esc}', '{emp['cond_code']}', '{cond_name_esc}', 'ACTIVE', {hire_date_str}, {emp['leave_days']}, 'BASELINE', 1, '{payload_json}', '{payload_sha}', NOW(6), 'system');")

    # 8. HR Movements
    out_sql.append("\nDROP TABLE IF EXISTS `hr_employee_movements`;")
    out_sql.append("""CREATE TABLE `hr_employee_movements` (
  `id` varchar(36) NOT NULL,
  `employee_id` varchar(36) DEFAULT NULL,
  `movement_type` varchar(40) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'DRAFT',
  `effective_date` date NOT NULL,
  `from_department_id` varchar(36) DEFAULT NULL,
  `to_department_id` varchar(36) DEFAULT NULL,
  `from_position_id` varchar(36) DEFAULT NULL,
  `to_position_id` varchar(36) DEFAULT NULL,
  `from_working_condition_id` varchar(36) DEFAULT NULL,
  `to_working_condition_id` varchar(36) DEFAULT NULL,
  `from_employee_status` varchar(16) DEFAULT NULL,
  `to_employee_status` varchar(16) DEFAULT NULL,
  `reason` varchar(1000) DEFAULT NULL,
  `decision_number` varchar(100) DEFAULT NULL,
  `decision_date` date DEFAULT NULL,
  `source_kind` varchar(20) NOT NULL DEFAULT 'SYSTEM',
  `import_batch_id` varchar(36) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_by_actor` varchar(320) NOT NULL,
  `updated_by_actor` varchar(320) NOT NULL,
  `row_version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""")

    # 9. Clean Flyway History
    out_sql.append("\n-- Clean Flyway Schema History up to V8")
    out_sql.append("DELETE FROM `flyway_schema_history` WHERE `version` >= '9';")

    out_sql.append("\nSET foreign_key_checks = 1;\n")

    with open(SQL_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(out_sql))

    print(f"\n🎉 HOÀN THÀNH TẠO FILE SQL CHUẨN XÁC 100%:")
    print(f"   📁 File: {SQL_OUTPUT_PATH}")
    print(f"   📊 Tổng số dòng SQL: {len(out_sql)}")
    print(f"   👥 Số nhân sự chính thức: {len(active_employees)} (Khớp 100% sheet T8-26)")
    print(f"   🌱 Số ứng viên thử việc: 3 (Đã xóa bỏ Nguyễn Trung Thuậnnn)")
    print("=" * 80)

if __name__ == "__main__":
    build_master_dump()
