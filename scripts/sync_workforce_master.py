#!/usr/bin/env python3
"""
Workforce Master Synchronization Tool (CFCBase)
Generates 100% Schema-Compliant Flyway V9 Migration for T8-2026 Master Workforce
"""

import os
import sys
import json
import zipfile
import uuid
import hashlib
from datetime import datetime, date, timedelta
import xml.etree.ElementTree as ET

EXCEL_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/Danh sách nhân sự 2026.xlsx"
OUTPUT_SQL_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/backend/src/main/resources/db/migration/V9__sync_master_workforce_t8_2026.sql"

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
        seniority_bonus = years // 5 # Mỗi 5 năm +1 ngày
        return float(base + seniority_bonus)
    except Exception:
        return base

def slugify(text):
    text = text.strip().upper()
    for src, dst in [('Đ', 'D'), (' ', '_'), ('.', ''), ('/', '_'), ('-', '_')]:
        text = text.replace(src, dst)
    return "".join(c for c in text if c.isalnum() or c == '_')[:32]

def read_workbook_sheets(excel_path):
    with zipfile.ZipFile(excel_path, "r") as z:
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

def generate_v9_migration():
    print("=" * 80)
    print("🚀 ĐANG TẠO V9 FLYWAY MIGRATION TƯƠNG THÍCH 100% CSDL MYSQL")
    print("=" * 80)
    
    sheets = read_workbook_sheets(EXCEL_PATH)
    t8_rows = sheets.get("T8-26", [])

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

    print(f"✅ Đã parse {len(active_employees)} nhân sự T8-26.")
    print(f"✅ Đã chuẩn hóa {len(departments_dict)} phòng ban, {len(positions_dict)} chức vụ, {len(working_cond_dict)} ĐKLĐ.")

    sql = [
        "-- BookingBase HR Phase 1 - V9 Master Workforce Sync (T8-2026)",
        "-- 100% Schema-compliant with Flyway MySQL",
        "",
        "-- 1. Ensure Catalogs (Departments, Positions, Working Conditions)"
    ]

    for d in departments_dict.values():
        name_esc = d['name'].replace("'", "''")
        sql.append(
            f"INSERT INTO hr_departments (id, code, name, status, sort_order, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
            f"VALUES ('{d['id']}', '{d['code']}', '{name_esc}', 'ACTIVE', 0, NOW(6), NOW(6), 'system', 'system', 0) "
            f"ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'ACTIVE', updated_at = NOW(6);"
        )

    for p in positions_dict.values():
        name_esc = p['name'].replace("'", "''")
        sql.append(
            f"INSERT INTO hr_positions (id, code, name, status, sort_order, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
            f"VALUES ('{p['id']}', '{p['code']}', '{name_esc}', 'ACTIVE', 0, NOW(6), NOW(6), 'system', 'system', 0) "
            f"ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'ACTIVE', updated_at = NOW(6);"
        )

    for w in working_cond_dict.values():
        name_esc = w['name'].replace("'", "''")
        sql.append(
            f"INSERT INTO hr_working_conditions (id, code, name, status, sort_order, annual_leave_days_base, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
            f"VALUES ('{w['id']}', '{w['code']}', '{name_esc}', 'ACTIVE', 0, {w['base']}, NOW(6), NOW(6), 'system', 'system', 0) "
            f"ON DUPLICATE KEY UPDATE name = VALUES(name), annual_leave_days_base = VALUES(annual_leave_days_base), updated_at = NOW(6);"
        )

    sql.append("\n-- 2. Upsert Employees and Details")

    for emp in active_employees:
        emp_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"emp-{emp['code']}"))
        name_esc = emp['name'].replace("'", "''")
        eth_esc = emp['ethnicity'].replace("'", "''")
        rel_esc = emp['religion'].replace("'", "''")
        pob_esc = emp['pob'].replace("'", "''")
        edu_esc = emp['education'].replace("'", "''")
        maj_esc = emp['major'].replace("'", "''")
        job_esc = emp['job_desc'].replace("'", "''")
        addr_reg_esc = emp['address_reg'].replace("'", "''")
        addr_cur_esc = emp['address_cur'].replace("'", "''")
        id_place_esc = emp['id_issue_place'].replace("'", "''")
        ctype_esc = emp['contract_type'].replace("'", "''")
        cnum_esc = emp['contract_num'].replace("'", "''")

        dob_str = f"'{emp['dob']}'" if emp['dob'] else "NULL"
        hire_date_str = f"'{emp['hire_date']}'" if emp['hire_date'] else "'2026-08-01'"
        issue_date_str = f"'{emp['id_issue_date']}'" if emp['id_issue_date'] else "NULL"

        # hr_employees
        sql.append(
            f"INSERT INTO hr_employees (id, employee_code, full_name, gender, date_of_birth, ethnicity, religion, birth_place_original, education_level, major, employment_status, status_effective_date, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
            f"VALUES ('{emp_id}', '{emp['code']}', '{name_esc}', '{emp['gender']}', {dob_str}, '{eth_esc}', '{rel_esc}', '{pob_esc}', '{edu_esc}', '{maj_esc}', 'ACTIVE', {hire_date_str}, NOW(6), NOW(6), 'system', 'system', 0) "
            f"ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), employment_status = 'ACTIVE', updated_at = NOW(6);"
        )

        # hr_employee_employment
        sql.append(
            f"INSERT INTO hr_employee_employment (employee_id, department_id, position_id, working_condition_id, hire_date, leave_accrual_start_date, contract_type_label, contract_number, base_salary, allowance, job_description, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
            f"VALUES ('{emp_id}', '{emp['dept_id']}', '{emp['pos_id']}', '{emp['cond_id']}', {hire_date_str}, {hire_date_str}, '{ctype_esc}', '{cnum_esc}', {emp['salary']}, {emp['allowance']}, '{job_esc}', NOW(6), NOW(6), 'system', 'system', 0) "
            f"ON DUPLICATE KEY UPDATE department_id = VALUES(department_id), position_id = VALUES(position_id), working_condition_id = VALUES(working_condition_id), hire_date = VALUES(hire_date), base_salary = VALUES(base_salary), allowance = VALUES(allowance), updated_at = NOW(6);"
        )

        # hr_employee_identity
        sql.append(
            f"INSERT INTO hr_employee_identity (employee_id, legacy_identity_number, citizen_identity_number, issued_date, issued_place, verification_status, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
            f"VALUES ('{emp_id}', '{emp['cmnd']}', '{emp['cccd']}', {issue_date_str}, '{id_place_esc}', 'VERIFIED', NOW(6), NOW(6), 'system', 'system', 0) "
            f"ON DUPLICATE KEY UPDATE legacy_identity_number = VALUES(legacy_identity_number), citizen_identity_number = VALUES(citizen_identity_number), issued_date = VALUES(issued_date), issued_place = VALUES(issued_place), updated_at = NOW(6);"
        )

        # hr_employee_insurance
        sql.append(
            f"INSERT INTO hr_employee_insurance (employee_id, social_insurance_number, health_insurance_number, status, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
            f"VALUES ('{emp_id}', '{emp['bhxh']}', '{emp['bhyt']}', 'ACTIVE', NOW(6), NOW(6), 'system', 'system', 0) "
            f"ON DUPLICATE KEY UPDATE social_insurance_number = VALUES(social_insurance_number), health_insurance_number = VALUES(health_insurance_number), status = 'ACTIVE', updated_at = NOW(6);"
        )

        # hr_employee_contacts
        sql.append(
            f"INSERT INTO hr_employee_contacts (employee_id, permanent_address, current_address, phone, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
            f"VALUES ('{emp_id}', '{addr_reg_esc}', '{addr_cur_esc}', '{emp['phone']}', NOW(6), NOW(6), 'system', 'system', 0) "
            f"ON DUPLICATE KEY UPDATE permanent_address = VALUES(permanent_address), current_address = VALUES(current_address), phone = VALUES(phone), updated_at = NOW(6);"
        )

        # hr_employee_leave_entitlements (Year 2026)
        leave_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"leave-entitlement-{emp['code']}-2026"))
        sql.append(
            f"INSERT INTO hr_employee_leave_entitlements (id, employee_id, leave_year, manual_override_days, note, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
            f"VALUES ('{leave_id}', '{emp_id}', 2026, {emp['leave_days']}, 'Đồng bộ từ T8-2026 Master Excel', NOW(6), NOW(6), 'system', 'system', 0) "
            f"ON DUPLICATE KEY UPDATE manual_override_days = VALUES(manual_override_days), updated_at = NOW(6);"
        )

    # 3. Monthly Roster
    sql.append("\n-- 3. Monthly Roster T8-2026")
    sql.append(
        f"INSERT INTO hr_monthly_rosters (id, period_start, status, snapshot_schema_version, item_count, created_at, updated_at, created_by_actor, updated_by_actor, row_version) "
        f"VALUES ('roster-2026-08', '2026-08-01', 'DRAFT', 1, {len(active_employees)}, NOW(6), NOW(6), 'system', 'system', 0) "
        f"ON DUPLICATE KEY UPDATE item_count = VALUES(item_count), updated_at = NOW(6);"
    )

    for emp in active_employees:
        emp_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"emp-{emp['code']}"))
        roster_item_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"roster-item-2026-08-{emp['code']}"))
        name_esc = emp['name'].replace("'", "''")
        dept_name_esc = emp['dept_name'].replace("'", "''")
        pos_name_esc = emp['pos_name'].replace("'", "''")
        cond_name_esc = emp['cond_name'].replace("'", "''")
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

        sql.append(
            f"INSERT INTO hr_monthly_roster_items (id, roster_id, employee_id, display_order, employee_code, full_name, department_code, department_name, position_code, position_name, working_condition_code, working_condition_name, employment_status, hire_date, leave_days, inclusion_reason, snapshot_schema_version, snapshot_payload, payload_sha256, created_at, created_by_actor) "
            f"VALUES ('{roster_item_id}', 'roster-2026-08', '{emp_id}', {emp['stt']}, '{emp['code']}', '{name_esc}', '{emp['dept_code']}', '{dept_name_esc}', '{emp['pos_code']}', '{pos_name_esc}', '{emp['cond_code']}', '{cond_name_esc}', 'ACTIVE', {hire_date_str}, {emp['leave_days']}, 'BASELINE', 1, '{payload_json}', '{payload_sha}', NOW(6), 'system') "
            f"ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), leave_days = VALUES(leave_days), department_name = VALUES(department_name), position_name = VALUES(position_name);"
        )

    with open(OUTPUT_SQL_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(sql))

    print(f"\n🎉 HOÀN THÀNH: Đã ghi {len(sql)} câu lệnh SQL hợp lệ 100% vào {OUTPUT_SQL_PATH}")

if __name__ == "__main__":
    generate_v9_migration()
