#!/usr/bin/env python3
"""
Section-by-Section SQL Parser for CFCBase
Splits sql.txt strictly on "\nDROP TABLE IF EXISTS " boundaries so multiline strings (like avatar base64) are preserved 100%.
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
    for src, dst in [('Đ', 'D'), (' ', '_'), ('.', ''), ('&', '_'), ('(', ''), (')', ''), ('/', '_'), ('-', '_')]:
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

def build_clean_sql():
    print("=" * 80)
    print("🚀 BẮT ĐẦU XỬ LÝ KHỐI BẢNG CHUẨN XÁC")
    print("=" * 80)

    # 1. Parse Excel
    sheets = read_excel_data()
    t8_rows = sheets.get("T8-26", [])

    active_employees = []
    departments_by_code = {}
    positions_by_code = {}
    working_cond_by_code = {}

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

            if dept_code not in departments_by_code:
                departments_by_code[dept_code] = {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dept-{dept_code}")),
                    "code": dept_code,
                    "name": dept_name
                }
            if pos_code not in positions_by_code:
                positions_by_code[pos_code] = {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"pos-{pos_code}")),
                    "code": pos_code,
                    "name": pos_name
                }
            if cond_code not in working_cond_by_code:
                working_cond_by_code[cond_code] = {
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
                "dept_id": departments_by_code[dept_code]["id"],
                "dept_code": dept_code,
                "dept_name": departments_by_code[dept_code]["name"],
                "pos_id": positions_by_code[pos_code]["id"],
                "pos_code": pos_code,
                "pos_name": positions_by_code[pos_code]["name"],
                "cond_id": working_cond_by_code[cond_code]["id"],
                "cond_code": cond_code,
                "cond_name": working_cond_by_code[cond_code]["name"],
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

    print(f"✅ Đã chuẩn hóa {len(active_employees)} nhân sự T8-26.")

    # 2. Read sql.txt
    with open(SQL_INPUT_PATH, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Split into sections by "\nDROP TABLE IF EXISTS "
    sections = content.split("\nDROP TABLE IF EXISTS `")

    out = []
    # Header
    out.append("""-- Adminer Master Clean Database Dump
-- CFCBase Full Schema & Data T8-2026

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

""")

    for idx, sec in enumerate(sections):
        if idx == 0:
            continue # Header comments from Adminer
        
        # Format: tablename`;\nCREATE TABLE...
        m = re.match(r"^([a-zA-Z0-9_]+)`(.*?)$", sec, re.DOTALL)
        if not m:
            continue
        
        table_name = m.group(1)
        body = m.group(2)
        
        # Extract CREATE TABLE
        m_create = re.search(r"(CREATE TABLE `" + table_name + r"` \(.*?\)\s*ENGINE=InnoDB.*?;)", body, re.DOTALL)
        if not m_create:
            print(f"⚠️ Không tìm thấy CREATE TABLE cho {table_name}")
            continue
        create_sql = m_create.group(1)
        
        out.append(f"DROP TABLE IF EXISTS `{table_name}`;\n{create_sql}\n")

        # Handle custom tables
        if table_name == "hr_departments":
            out.append("INSERT INTO `hr_departments` (`id`, `code`, `name`, `status`, `sort_order`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n")
            d_rows = []
            for d in departments_by_code.values():
                name_esc = d['name'].strip("'").replace("'", "''")
                d_rows.append(f"('{d['id']}', '{d['code']}', '{name_esc}', 'ACTIVE', 0, NOW(6), NOW(6), 'system', 'system', 0)")
            out.append(",\n".join(d_rows) + ";\n\n")

        elif table_name == "hr_positions":
            out.append("INSERT INTO `hr_positions` (`id`, `code`, `name`, `status`, `sort_order`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n")
            p_rows = []
            for p in positions_by_code.values():
                name_esc = p['name'].strip("'").replace("'", "''")
                p_rows.append(f"('{p['id']}', '{p['code']}', '{name_esc}', 'ACTIVE', 0, NOW(6), NOW(6), 'system', 'system', 0)")
            out.append(",\n".join(p_rows) + ";\n\n")

        elif table_name == "hr_working_conditions":
            out.append("INSERT INTO `hr_working_conditions` (`id`, `code`, `name`, `status`, `sort_order`, `annual_leave_days_base`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n")
            w_rows = []
            for w in working_cond_by_code.values():
                name_esc = w['name'].strip("'").replace("'", "''")
                w_rows.append(f"('{w['id']}', '{w['code']}', '{name_esc}', 'ACTIVE', 0, {w['base']}, NOW(6), NOW(6), 'system', 'system', 0)")
            out.append(",\n".join(w_rows) + ";\n\n")

        elif table_name == "hr_employees":
            out.append("INSERT INTO `hr_employees` (`id`, `employee_code`, `full_name`, `gender`, `date_of_birth`, `ethnicity`, `religion`, `birth_place_original`, `birth_place_current`, `education_level`, `major`, `employment_status`, `status_effective_date`, `source_import_batch_id`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`, `workforce_group`, `onboarding_source`, `onboarding_policy_version`) VALUES\n")
            emp_rows = []
            for emp in active_employees:
                name_esc = emp['name'].strip("'").replace("'", "''")
                eth_esc = emp['ethnicity'].strip("'").replace("'", "''")
                rel_esc = emp['religion'].strip("'").replace("'", "''")
                pob_esc = emp['pob'].strip("'").replace("'", "''")
                edu_esc = emp['education'].strip("'").replace("'", "''")
                maj_esc = emp['major'].strip("'").replace("'", "''")
                dob_str = f"'{emp['dob']}'" if emp['dob'] else "NULL"
                hire_date_str = f"'{emp['hire_date']}'" if emp['hire_date'] else "'2026-08-01'"
                emp_rows.append(f"('{emp['id']}', '{emp['code']}', '{name_esc}', '{emp['gender']}', {dob_str}, '{eth_esc}', '{rel_esc}', '{pob_esc}', NULL, '{edu_esc}', '{maj_esc}', 'ACTIVE', {hire_date_str}, NULL, NOW(6), NOW(6), 'system', 'system', 0, 'OFFICE', 'LEGACY', 1)")
            out.append(",\n".join(emp_rows) + ";\n\n")

        elif table_name == "hr_employee_employment":
            out.append("INSERT INTO `hr_employee_employment` (`employee_id`, `department_id`, `position_id`, `working_condition_id`, `hire_date`, `leave_accrual_start_date`, `termination_date`, `contract_type_label`, `contract_number`, `base_salary`, `allowance`, `job_description`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n")
            emp_rows = []
            for emp in active_employees:
                job_esc = emp['job_desc'].strip("'").replace("'", "''")
                ctype_esc = emp['contract_type'].strip("'").replace("'", "''")
                cnum_esc = emp['contract_num'].strip("'").replace("'", "''")
                hire_date_str = f"'{emp['hire_date']}'" if emp['hire_date'] else "'2026-08-01'"
                emp_rows.append(f"('{emp['id']}', '{emp['dept_id']}', '{emp['pos_id']}', '{emp['cond_id']}', {hire_date_str}, {hire_date_str}, NULL, '{ctype_esc}', '{cnum_esc}', {emp['salary']}, {emp['allowance']}, '{job_esc}', NOW(6), NOW(6), 'system', 'system', 0)")
            out.append(",\n".join(emp_rows) + ";\n\n")

        elif table_name == "hr_employee_identity":
            out.append("INSERT INTO `hr_employee_identity` (`employee_id`, `legacy_identity_number`, `citizen_identity_number`, `issued_date`, `issued_place`, `verification_status`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n")
            rows = []
            for emp in active_employees:
                cmnd_esc = emp['cmnd'].strip("'").replace("'", "''")
                cccd_esc = emp['cccd'].strip("'").replace("'", "''")
                id_place_esc = emp['id_issue_place'].strip("'").replace("'", "''")
                issue_date_str = f"'{emp['id_issue_date']}'" if emp['id_issue_date'] else "NULL"
                rows.append(f"('{emp['id']}', '{cmnd_esc}', '{cccd_esc}', {issue_date_str}, '{id_place_esc}', 'VERIFIED', NOW(6), NOW(6), 'system', 'system', 0)")
            out.append(",\n".join(rows) + ";\n\n")

        elif table_name == "hr_employee_insurance":
            out.append("INSERT INTO `hr_employee_insurance` (`employee_id`, `social_insurance_number`, `health_insurance_number`, `valid_from`, `valid_until`, `status`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n")
            rows = []
            for emp in active_employees:
                bhxh_esc = emp['bhxh'].strip("'").replace("'", "''")
                bhyt_esc = emp['bhyt'].strip("'").replace("'", "''")
                rows.append(f"('{emp['id']}', '{bhxh_esc}', '{bhyt_esc}', NULL, NULL, 'ACTIVE', NOW(6), NOW(6), 'system', 'system', 0)")
            out.append(",\n".join(rows) + ";\n\n")

        elif table_name == "hr_employee_contacts":
            out.append("INSERT INTO `hr_employee_contacts` (`employee_id`, `permanent_address`, `current_address`, `phone`, `work_email`, `personal_email`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n")
            rows = []
            for emp in active_employees:
                addr_reg_esc = emp['address_reg'].strip("'").replace("'", "''")
                addr_cur_esc = emp['address_cur'].strip("'").replace("'", "''")
                phone_esc = emp['phone'].strip("'").replace("'", "''")
                rows.append(f"('{emp['id']}', '{addr_reg_esc}', '{addr_cur_esc}', '{phone_esc}', NULL, NULL, NULL, NULL, NULL, NOW(6), NOW(6), 'system', 'system', 0)")
            out.append(",\n".join(rows) + ";\n\n")

        elif table_name == "hr_employee_leave_entitlements":
            out.append("INSERT INTO `hr_employee_leave_entitlements` (`id`, `employee_id`, `leave_year`, `manual_override_days`, `note`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n")
            rows = []
            for emp in active_employees:
                leave_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"leave-entitlement-{emp['code']}-2026"))
                rows.append(f"('{leave_id}', '{emp['id']}', 2026, {emp['leave_days']}, 'Đồng bộ từ T8-2026 Master Excel', NOW(6), NOW(6), 'system', 'system', 0)")
            out.append(",\n".join(rows) + ";\n\n")

        elif table_name == "hr_monthly_rosters":
            out.append("""INSERT INTO `hr_monthly_rosters` (`id`, `period_start`, `status`, `source_roster_id`, `source_import_batch_id`, `snapshot_schema_version`, `item_count`, `roster_checksum`, `opened_at`, `opened_by_actor`, `closed_at`, `closed_by_actor`, `exported_at`, `exported_by_actor`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES
('c895cc0b-4d87-4ae0-b158-a95c754d22bc', '2026-06-01', 'CLOSED', NULL, '1c3d83be-2d32-42af-9479-5b13a714efba', 1, 337, '95e1c2440686820af7095c17fc937e33ecdc772793769ac02c092eea1e3c3a27', '2026-07-23 20:53:02.631944', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', '2026-07-23 20:53:02.631944', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', NULL, NULL, '2026-07-23 20:53:02.985894', '2026-07-23 20:53:04.287083', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 1),
('9847303a-e9d5-4b93-a9a7-56dfbb0acce9', '2026-07-01', 'CLOSED', 'c895cc0b-4d87-4ae0-b158-a95c754d22bc', NULL, 1, 337, '155564e4f846fbd5e1fa9fd59c0fd7a29fea6991860baa4e877817f3875c422c', '2026-07-23 21:05:13.580825', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', '2026-07-31 23:59:59.000000', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', NULL, NULL, '2026-07-23 21:05:08.235059', '2026-07-23 21:05:13.947432', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 1),
('roster-2026-08', '2026-08-01', 'OPEN', '9847303a-e9d5-4b93-a9a7-56dfbb0acce9', NULL, 1, 338, NULL, '2026-08-01 00:00:00.000000', 'system', NULL, NULL, NULL, NULL, NOW(6), NOW(6), 'system', 'system', 0);
\n""")

        elif table_name == "hr_monthly_roster_items":
            out.append("INSERT INTO `hr_monthly_roster_items` (`id`, `roster_id`, `employee_id`, `display_order`, `department_display_order`, `employee_code`, `full_name`, `department_code`, `department_name`, `position_code`, `position_name`, `working_condition_code`, `working_condition_name`, `employment_status`, `hire_date`, `termination_date`, `leave_days`, `inclusion_reason`, `source_movement_id`, `snapshot_schema_version`, `snapshot_payload`, `payload_sha256`, `created_at`, `created_by_actor`) VALUES\n")
            rows = []
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
                rows.append(f"('{roster_item_id}', 'roster-2026-08', '{emp['id']}', {emp['stt']}, NULL, '{emp['code']}', '{name_esc}', '{emp['dept_code']}', '{dept_name_esc}', '{emp['pos_code']}', '{pos_name_esc}', '{emp['cond_code']}', '{cond_name_esc}', 'ACTIVE', {hire_date_str}, NULL, {emp['leave_days']}, 'BASELINE', NULL, 1, '{payload_json}', '{payload_sha}', NOW(6), 'system')")
            out.append(",\n".join(rows) + ";\n\n")

        elif table_name == "hr_probation_candidates":
            out.append("""INSERT INTO `hr_probation_candidates` (`id`, `candidate_code`, `full_name`, `candidate_title`, `gender`, `date_of_birth`, `birth_place`, `nationality`, `citizen_id`, `citizen_id_issued_date`, `citizen_id_issued_place`, `permanent_address`, `phone`, `email`, `department_id`, `position_id`, `working_condition_id`, `job_template_id`, `probation_contract_type`, `probation_start_date`, `probation_end_date`, `base_salary`, `salary_note`, `job_description`, `department_rule_note`, `status`, `status_reason`, `converted_employee_id`, `converted_at`, `converted_by_actor`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES
('15995f93-ad39-4596-a272-b55d021f85bd', 'TV-260814031002', 'Lê Huy Hào', 'ông', 'MALE', '2002-03-12', 'Xã Châu Thành, Tp Cần Thơ', 'Việt Nam', '093202002984', '2021-08-01', 'Cục cảnh sát QLHC về TTXH', 'Ấp Mỵ Đông, xã Châu Thành, Tp Cần Thơ', '0930015043', NULL, 'cccd855c-76f8-4b96-80d5-90e1f6ba20e5', 'c373f6fa-2320-4ec8-80ad-56223b2e552b', NULL, '7795693e-8088-465a-bcc0-21b7b5e2d8f2', 'Xác định thời hạn 02 tháng', '2026-04-23', '2026-06-22', 7500000.00, 'đồng/tháng', 'Do trưởng phòng phân công.', 'Chấp hành nội quy công ty và sự phân công của người quản lý trực tiếp.', 'IN_PROBATION', NULL, NULL, NULL, NULL, '2026-08-13 20:10:02.330897', '2026-08-13 20:10:25.116469', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 2),
('84085d51-9523-4ad7-990c-05db3fc8da3f', 'TV-260814032152', 'Nguyễn Việt Khoa', 'ông', 'MALE', '2003-05-11', 'Phường Tân An, Tp Cần Thơ', 'Việt Nam', '092203008376', '2021-08-13', 'Cục cảnh sát QLHC về TTXH', '385B/14B, khu vực 2, Phường Tân An, Tp Cần Thơ', NULL, NULL, 'fe786f0f-be7c-4c3a-9348-4e3553c6a2f0', '9ca46019-c65a-483e-85af-9927be8cc81a', '6381677c-3678-4f65-87cc-bdc2bcaa155d', 'cf7ae1aa-1907-41de-adc8-5b2b1ef70901', 'Xác định thời hạn 02 tháng', '2026-07-01', '2026-08-03', 8000000.00, 'đồng/tháng', 'Các công việc liên quan đến xuất nhập khẩu theo sự chỉ đạo của Phòng Xuất nhập khẩu và Ban lãnh đạo Công ty.', 'Chấp hành nội quy công ty và sự phân công của người quản lý trực tiếp.', 'IN_PROBATION', NULL, NULL, NULL, NULL, '2026-08-13 20:21:52.742298', '2026-08-13 20:22:16.907611', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 2),
('c68cb340-b1ad-4f2e-afbb-95e7b6552745', 'TV-260727064228', 'Nguyễn Trung Thuận', 'Ông', 'MALE', '2005-04-26', 'Rạch Giá, Kiên Giang', 'Việt Nam', '091205014660', '2021-09-01', 'Cục trưởng Cục CS QLHC về TT và XH', '597/39A Mạc Cửu, phường Rạch Giá, An Giang', '0388509046', NULL, '3006b6ca-4142-43f6-9350-cf2b2931737b', 'c1fce26e-cd0c-46f7-8e16-b5ff7e6c73d2', '6381677c-3678-4f65-87cc-bdc2bcaa155d', 'a35a6b0c-5087-4a9a-93f0-765d1aebb90b', 'Xác định thời hạn 02 tháng', '2026-06-22', '2026-08-21', 7500000.00, 'đồng/tháng', 'Chuyển đổi số, hỗ trợ phòng TCHC và các công việc theo chỉ đạo của Ban lãnh đạo Công ty.', 'Chấp hành nội quy công ty và sự phân công của người quản lý trực tiếp.', 'IN_PROBATION', 'ád', NULL, NULL, NULL, '2026-07-26 23:42:28.298854', '2026-07-27 07:52:03.781645', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 12);
\n""")

        elif table_name == "hr_probation_contracts":
            out.append("""INSERT INTO `hr_probation_contracts` (`id`, `candidate_id`, `contract_no`, `contract_year`, `template_file_name`, `template_sha256`, `generated_file_name`, `generated_file_sha256`, `generated_docx`, `snapshot_payload`, `status`, `generated_at`, `generated_by_actor`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES
('0213d6be-51e7-4106-a396-9eb898ab382f', 'c68cb340-b1ad-4f2e-afbb-95e7b6552745', '04', 2026, 'probation-contract-template.docx', '34e2b4209ec0596a2003dadbe4ee98e33a9565a157383282cfe08ee84eb16f03', 'HDTV-04-2026-nguyen-trung-thuan.docx', '0170e1158bec82c42d2259ed86c680c522005dffc47b547549773b6f075e76ba', 0x504B0304, '{\\"{{SIGN_DAY}}\\": \\"27\\", \\"{{FULL_NAME}}\\": \\"Nguyễn Trung Thuận\\", \\"{{SIGN_YEAR}}\\": \\"2026\\", \\"{{CITIZEN_ID}}\\": \\"091205014660\\", \\"{{SIGN_MONTH}}\\": \\"07\\", \\"{{BIRTH_PLACE}}\\": \\"Rạch Giá, Kiên Giang\\", \\"{{CONTRACT_NO}}\\": \\"04\\", \\"{{NATIONALITY}}\\": \\"Việt Nam\\", \\"{{SALARY_NOTE}}\\": \\" đồng/tháng\\", \\"{{CONTRACT_YEAR}}\\": \\"2026\\", \\"{{DATE_OF_BIRTH}}\\": \\"26/04/2005\\", \\"{{POSITION_NAME}}\\": \\"Nhân viên phòng TCHC\\", \\"{{CANDIDATE_TITLE}}\\": \\"Ông\\", \\"{{JOB_DESCRIPTION}}\\": \\"Chuyển đổi số, hỗ trợ phòng TCHC và các công việc theo chỉ đạo của Ban lãnh đạo Công ty.\\", \\"{{BASE_SALARY_TEXT}}\\": \\"7.500.000\\", \\"{{PERMANENT_ADDRESS}}\\": \\"597/39A Mạc Cửu, phường Rạch Giá, An Giang\\", \\"{{PROBATION_END_DATE}}\\": \\"21/08/2026\\", \\"{{DEPARTMENT_RULE_NOTE}}\\": \\"Chấp hành nội quy công ty và sự phân công của người quản lý trực tiếp.\\", \\"{{PROBATION_START_DATE}}\\": \\"22/06/2026\\", \\"{{CITIZEN_ID_ISSUED_DATE}}\\": \\"01/09/2021\\", \\"{{CITIZEN_ID_ISSUED_PLACE}}\\": \\"Cục trưởng Cục CS QLHC về TT và XH\\", \\"{{PROBATION_CONTRACT_TYPE}}\\": \\"Xác định thời hạn 02 tháng\\"}', 'GENERATED', '2026-07-26 23:45:36.352042', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', '2026-07-26 23:45:36.352448', '2026-07-26 23:45:36.352448', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d', 0);
\n""")

        elif table_name in ["hr_employment_contracts", "hr_employment_contract_documents", "hr_employee_documents", "hr_audit_events"]:
            pass # Keep empty

        else:
            insert_part = body[m_create.end():].strip()
            if insert_part:
                clean_lines = []
                for l in insert_part.splitlines():
                    if "TV-2607270642282" in l or "Thuậnnn" in l:
                        continue
                    clean_lines.append(l)
                out.append("\n".join(clean_lines) + "\n\n")

    final_sql = "".join(out)
    with open(SQL_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(final_sql)

    print(f"🎉 HOÀN THÀNH XUẤT FILE {SQL_OUTPUT_PATH}!")

if __name__ == "__main__":
    build_clean_sql()
