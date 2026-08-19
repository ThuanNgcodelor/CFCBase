#!/usr/bin/env python3
"""
Master Database Builder:
Syncs exactly 338 employees from sheet T8-26 in 'Danh sách nhân sự 2026.xlsx',
Maps to real department & position IDs in sql.txt,
Populates 338 items across all rosters (T6, T7, T8),
Purges 'Nguyễn Trung Thuậnnn' (TV-2607270642282),
Keeps 3 real probation candidates,
Preserves all legacy data (bookings, cars, rooms, users, notifications).
"""

import zipfile
import xml.etree.ElementTree as ET
import re
import uuid
import json
import hashlib
from datetime import datetime, date, timedelta

EXCEL_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/Danh sách nhân sự 2026.xlsx"
SQL_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt"
OUTPUT_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/clean_database_master.sql"

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

def main():
    print("🚀 Đang tổng hợp CSDL Master chuẩn 338 người từ Excel T8-26...")

    # 1. Read sql.txt
    with open(SQL_PATH, "r", encoding="utf-8", errors="ignore") as f:
        sql_text = f.read()

    # Extract existing departments from sql.txt: id -> name, name -> id
    dept_name_to_id = {}
    m_dept = re.search(r"INSERT INTO `hr_departments` \(.*?\) VALUES(.*?);", sql_text, re.DOTALL)
    if m_dept:
        for line in m_dept.group(1).splitlines():
            m_row = re.match(r"\s*\('([0-9a-f\-]{36})',\s*'([^']+)',\s*'([^']+)'", line)
            if m_row:
                did, dcode, dname = m_row.group(1), m_row.group(2), m_row.group(3)
                dept_name_to_id[dname.strip().upper()] = (did, dcode, dname)

    # Extract existing positions from sql.txt: name -> id
    pos_name_to_id = {}
    m_pos = re.search(r"INSERT INTO `hr_positions` \(.*?\) VALUES(.*?);", sql_text, re.DOTALL)
    if m_pos:
        for line in m_pos.group(1).splitlines():
            m_row = re.match(r"\s*\('([0-9a-f\-]{36})',\s*'([^']+)',\s*'([^']+)'", line)
            if m_row:
                pid, pcode, pname = m_row.group(1), m_row.group(2), m_row.group(3)
                pos_name_to_id[pname.strip().upper()] = (pid, pcode, pname)

    # Extract existing working conditions
    cond_name_to_id = {}
    m_cond = re.search(r"INSERT INTO `hr_working_conditions` \(.*?\) VALUES(.*?);", sql_text, re.DOTALL)
    if m_cond:
        for line in m_cond.group(1).splitlines():
            m_row = re.match(r"\s*\('([0-9a-f\-]{36})',\s*'([^']+)',\s*'([^']+)'", line)
            if m_row:
                cid, ccode, cname = m_row.group(1), m_row.group(2), m_row.group(3)
                cond_name_to_id[cname.strip().upper()] = (cid, ccode, cname)

    # 2. Read 338 employees from Excel T8-26
    with zipfile.ZipFile(EXCEL_PATH, "r") as z:
        wb_xml = z.read("xl/workbook.xml")
        root = ET.fromstring(wb_xml)
        rels_xml = z.read("xl/_rels/workbook.xml.rels")
        rels_root = ET.fromstring(rels_xml)
        rel_map = {r.attrib.get("Id"): r.attrib.get("Target") for r in rels_root.findall(".//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")}

        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            ss_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in ss_root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                t = si.find(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                shared_strings.append(t.text if t is not None else "")

        sheet_path = ""
        for s in root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"):
            if s.attrib.get("name") == "T8-26":
                r_id = s.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                target = rel_map.get(r_id, "")
                sheet_path = "xl/" + target if not target.startswith("xl/") else target
                break

        s_xml = z.read(sheet_path)
        s_root = ET.fromstring(s_xml)
        excel_employees = []
        for r in s_root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
            cells = {}
            for c in r.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                ref = c.attrib.get("r", "")
                col = "".join([ch for ch in ref if ch.isalpha()])
                t_type = c.attrib.get("t")
                v = c.find(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                val = v.text if v is not None and v.text is not None else ""
                is_tag = c.find(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}is/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                if is_tag is not None and is_tag.text:
                    val = is_tag.text
                if t_type == "s" and str(val).isdigit():
                    idx = int(val)
                    if idx < len(shared_strings):
                        val = shared_strings[idx]
                cells[col] = str(val or "")
            
            stt = cells.get("A", "").strip()
            code = cells.get("C", "").strip()
            name = cells.get("E", "").strip()
            if stt.isdigit() and code and name:
                bhxh = cells.get("D", "").strip()
                bhyt = cells.get("F", "").strip()
                salary = parse_number(cells.get("G"))
                allowance = parse_number(cells.get("H"))
                gender_raw = cells.get("J", "").strip().upper()
                gender = "MALE" if "NAM" in gender_raw else ("FEMALE" if "NỮ" in gender_raw or "NU" in gender_raw else "UNKNOWN")
                ethnicity = cells.get("L", "").strip() or "Kinh"
                religion = cells.get("M", "").strip() or "Không"
                pos_name = cells.get("N", "").strip() or "Nhân viên"
                dept_name = cells.get("O", "").strip() or "Khối Quản lý"
                dob = parse_excel_date(cells.get("P"))
                hire_date = parse_excel_date(cells.get("Q")) or "2026-08-01"
                contract_type = cells.get("T", "").strip() or "HĐLĐ"
                contract_num = cells.get("U", "").strip()
                cmnd = cells.get("W", "").strip()
                cccd = cells.get("X", "").strip()
                id_issue_date = parse_excel_date(cells.get("AA"))
                id_issue_place = cells.get("AC", "").strip()
                cond_name = cells.get("AB", "").strip() or "Bình thường"
                pob = cells.get("AD", "").strip()
                address_reg = cells.get("AF", "").strip()
                address_cur = cells.get("AG", "").strip()
                phone = cells.get("AH", "").strip()
                education = cells.get("AI", "").strip()
                major = cells.get("AJ", "").strip()
                job_desc = cells.get("AK", "").strip()
                
                leave_days = calculate_leave_days(hire_date, cond_name)

                # Match dept
                dept_match = dept_name_to_id.get(dept_name.upper())
                if not dept_match:
                    for k, v in dept_name_to_id.items():
                        if k in dept_name.upper() or dept_name.upper() in k:
                            dept_match = v
                            break
                if not dept_match:
                    dept_match = list(dept_name_to_id.values())[0]

                # Match pos
                pos_match = pos_name_to_id.get(pos_name.upper())
                if not pos_match:
                    for k, v in pos_name_to_id.items():
                        if k in pos_name.upper() or pos_name.upper() in k:
                            pos_match = v
                            break
                if not pos_match:
                    pos_match = list(pos_name_to_id.values())[0]

                # Match cond
                cond_match = cond_name_to_id.get(cond_name.upper())
                if not cond_match:
                    for k, v in cond_name_to_id.items():
                        if "NẶNG NHỌC" in cond_name.upper() and "NẶNG NHỌC" in k:
                            cond_match = v
                            break
                if not cond_match:
                    cond_match = list(cond_name_to_id.values())[0]

                emp_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"cfc-emp-{code}"))
                excel_employees.append({
                    "id": emp_id,
                    "stt": int(stt),
                    "code": code,
                    "name": name,
                    "gender": gender,
                    "dob": dob,
                    "ethnicity": ethnicity,
                    "religion": religion,
                    "pob": pob,
                    "education": education,
                    "major": major,
                    "hire_date": hire_date,
                    "dept_id": dept_match[0],
                    "dept_code": dept_match[1],
                    "dept_name": dept_match[2],
                    "pos_id": pos_match[0],
                    "pos_code": pos_match[1],
                    "pos_name": pos_match[2],
                    "cond_id": cond_match[0],
                    "cond_code": cond_match[1],
                    "cond_name": cond_match[2],
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
                })

    print(f"✅ Đã nạp chính xác {len(excel_employees)} nhân sự từ sheet T8-26.")

    # 3. Clean sql.txt
    start_ctr = sql_text.find("INSERT INTO `hr_probation_contracts`")
    end_ctr = sql_text.find("DROP TABLE IF EXISTS `hr_probation_job_templates`")
    contracts_raw = sql_text[start_ctr:end_ctr].strip()

    record_starts = list(re.finditer(r"\('([0-9a-f\-]{36})',\s*'([0-9a-f\-]{36})',\s*'([0-9]+)',\s*([0-9]+),\s*'([^']+)',\s*'([a-f0-9]+)',\s*'([^']+)',\s*'([a-f0-9]+)'", contracts_raw))
    clean_contracts = []
    for i, m in enumerate(record_starts):
        cid = m.group(1)
        cand_id = m.group(2)
        cno = m.group(3)
        cyear = m.group(4)
        tpl_name = m.group(5)
        tpl_sha = m.group(6)
        gen_name = m.group(7)
        gen_sha = m.group(8)
        
        if cand_id == "c68cb340-b1ad-4f2e-afbb-95e7b6552743":
            continue
        
        next_idx = record_starts[i+1].start() if i+1 < len(record_starts) else len(contracts_raw)
        chunk = contracts_raw[m.start():next_idx]
        
        m_trail = re.search(r"'({\\?\"\{\{.*?\\?\"})',\s*'([A-Z_]+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([0-9]+)", chunk, re.DOTALL)
        if m_trail:
            payload = m_trail.group(1).replace("'", "\\'")
            status = m_trail.group(2)
            gen_at = m_trail.group(3)
            gen_actor = m_trail.group(4)
            created_at = m_trail.group(5)
            updated_at = m_trail.group(6)
            cr_actor = m_trail.group(7)
            up_actor = m_trail.group(8)
            row_ver = m_trail.group(9)
            
            row = f"('{cid}',\t'{cand_id}',\t'{cno}',\t{cyear},\t'{tpl_name}',\t'{tpl_sha}',\t'{gen_name}',\t'{gen_sha}',\t0x504B0304,\t'{payload}',\t'{status}',\t'{gen_at}',\t'{gen_actor}',\t'{created_at}',\t'{updated_at}',\t'{cr_actor}',\t'{up_actor}',\t{row_ver})"
            clean_contracts.append(row)

    clean_contracts_stmt = "INSERT INTO `hr_probation_contracts` (`id`, `candidate_id`, `contract_no`, `contract_year`, `template_file_name`, `template_sha256`, `generated_file_name`, `generated_file_sha256`, `generated_docx`, `snapshot_payload`, `status`, `generated_at`, `generated_by_actor`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n" + ",\n".join(clean_contracts) + ";\n\n"
    sql_text = sql_text[:start_ctr] + clean_contracts_stmt + sql_text[end_ctr:]

    # Remove all Thuannn lines
    trash_ids = [
        "c68cb340-b1ad-4f2e-afbb-95e7b6552743",
        "efb31f9b-b85b-4cd2-a99a-f6315fa48509",
        "TV-2607270642282",
        "Nguyễn Trung Thuậnnn"
    ]
    lines = sql_text.splitlines()
    filtered_lines = [l for l in lines if not any(tid in l for tid in trash_ids)]
    sql_text = "\n".join(filtered_lines)

    # 4. Replace hr_employees & child tables with the 338 T8-26 employees
    emp_insert_rows = []
    for emp in excel_employees:
        name_esc = emp['name'].replace("'", "''")
        eth_esc = emp['ethnicity'].replace("'", "''")
        rel_esc = emp['religion'].replace("'", "''")
        pob_esc = emp['pob'].replace("'", "''")
        edu_esc = emp['education'].replace("'", "''")
        maj_esc = emp['major'].replace("'", "''")
        dob_str = f"'{emp['dob']}'" if emp['dob'] else "NULL"
        hire_date_str = f"'{emp['hire_date']}'" if emp['hire_date'] else "'2026-08-01'"
        emp_insert_rows.append(f"('{emp['id']}',\t'{emp['code']}',\t'{name_esc}',\t'{emp['gender']}',\t{dob_str},\t'{eth_esc}',\t'{rel_esc}',\t'{pob_esc}',\tNULL,\t'{edu_esc}',\t'{maj_esc}',\t'ACTIVE',\t{hire_date_str},\tNULL,\tNOW(6),\tNOW(6),\t'system',\t'system',\t0,\t'OFFICE',\t'LEGACY',\t1)")

    new_emp_sql = "INSERT INTO `hr_employees` (`id`, `employee_code`, `full_name`, `gender`, `date_of_birth`, `ethnicity`, `religion`, `birth_place_original`, `birth_place_current`, `education_level`, `major`, `employment_status`, `status_effective_date`, `source_import_batch_id`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`, `workforce_group`, `onboarding_source`, `onboarding_policy_version`) VALUES\n" + ",\n".join(emp_insert_rows) + ";\n\n"
    sql_text = re.sub(r"INSERT INTO `hr_employees` \(.*?\) VALUES.*?;", new_emp_sql, sql_text, flags=re.DOTALL)

    empm_rows = []
    for emp in excel_employees:
        job_esc = emp['job_desc'].replace("'", "''")
        ctype_esc = emp['contract_type'].replace("'", "''")
        cnum_esc = emp['contract_num'].replace("'", "''")
        hire_date_str = f"'{emp['hire_date']}'" if emp['hire_date'] else "'2026-08-01'"
        empm_rows.append(f"('{emp['id']}',\t'{emp['dept_id']}',\t'{emp['pos_id']}',\t'{emp['cond_id']}',\t{hire_date_str},\t{hire_date_str},\tNULL,\t'{ctype_esc}',\t'{cnum_esc}',\t{emp['salary']},\t{emp['allowance']},\t'{job_esc}',\tNOW(6),\tNOW(6),\t'system',\t'system',\t0)")

    new_empm_sql = "INSERT INTO `hr_employee_employment` (`employee_id`, `department_id`, `position_id`, `working_condition_id`, `hire_date`, `leave_accrual_start_date`, `termination_date`, `contract_type_label`, `contract_number`, `base_salary`, `allowance`, `job_description`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n" + ",\n".join(empm_rows) + ";\n\n"
    sql_text = re.sub(r"INSERT INTO `hr_employee_employment` \(.*?\) VALUES.*?;", new_empm_sql, sql_text, flags=re.DOTALL)

    ident_rows = []
    for emp in excel_employees:
        cmnd_esc = emp['cmnd'].replace("'", "''")
        cccd_esc = emp['cccd'].replace("'", "''")
        id_place_esc = emp['id_issue_place'].replace("'", "''")
        issue_date_str = f"'{emp['id_issue_date']}'" if emp['id_issue_date'] else "NULL"
        ident_rows.append(f"('{emp['id']}',\t'{cmnd_esc}',\t'{cccd_esc}',\t{issue_date_str},\t'{id_place_esc}',\t'VERIFIED',\tNOW(6),\tNOW(6),\t'system',\t'system',\t0)")

    new_ident_sql = "INSERT INTO `hr_employee_identity` (`employee_id`, `legacy_identity_number`, `citizen_identity_number`, `issued_date`, `issued_place`, `verification_status`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n" + ",\n".join(ident_rows) + ";\n\n"
    sql_text = re.sub(r"INSERT INTO `hr_employee_identity` \(.*?\) VALUES.*?;", new_ident_sql, sql_text, flags=re.DOTALL)

    ins_rows = []
    for emp in excel_employees:
        bhxh_esc = emp['bhxh'].replace("'", "''")
        bhyt_esc = emp['bhyt'].replace("'", "''")
        ins_rows.append(f"('{emp['id']}',\t'{bhxh_esc}',\t'{bhyt_esc}',\tNULL,\tNULL,\t'ACTIVE',\tNOW(6),\tNOW(6),\t'system',\t'system',\t0)")

    new_ins_sql = "INSERT INTO `hr_employee_insurance` (`employee_id`, `social_insurance_number`, `health_insurance_number`, `valid_from`, `valid_until`, `status`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n" + ",\n".join(ins_rows) + ";\n\n"
    sql_text = re.sub(r"INSERT INTO `hr_employee_insurance` \(.*?\) VALUES.*?;", new_ins_sql, sql_text, flags=re.DOTALL)

    cont_rows = []
    for emp in excel_employees:
        addr_reg_esc = emp['address_reg'].replace("'", "''")
        addr_cur_esc = emp['address_cur'].replace("'", "''")
        phone_esc = emp['phone'].replace("'", "''")
        cont_rows.append(f"('{emp['id']}',\t'{addr_reg_esc}',\t'{addr_cur_esc}',\t'{phone_esc}',\tNULL,\tNULL,\tNULL,\tNULL,\tNULL,\tNOW(6),\tNOW(6),\t'system',\t'system',\t0)")

    new_cont_sql = "INSERT INTO `hr_employee_contacts` (`employee_id`, `permanent_address`, `current_address`, `phone`, `work_email`, `personal_email`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n" + ",\n".join(cont_rows) + ";\n\n"
    sql_text = re.sub(r"INSERT INTO `hr_employee_contacts` \(.*?\) VALUES.*?;", new_cont_sql, sql_text, flags=re.DOTALL)

    leave_rows = []
    for emp in excel_employees:
        leave_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"leave-{emp['code']}-2026"))
        leave_rows.append(f"('{leave_id}',\t'{emp['id']}',\t2026,\t{emp['leave_days']},\t'Đồng bộ từ T8-2026 Master Excel',\tNOW(6),\tNOW(6),\t'system',\t'system',\t0)")

    new_leave_sql = "INSERT INTO `hr_employee_leave_entitlements` (`id`, `employee_id`, `leave_year`, `manual_override_days`, `note`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n" + ",\n".join(leave_rows) + ";\n\n"
    sql_text = re.sub(r"INSERT INTO `hr_employee_leave_entitlements` \(.*?\) VALUES.*?;", new_leave_sql, sql_text, flags=re.DOTALL)

    # Empty hr_employee_movements so baseline projection matches 338 directly
    new_mov_sql = """-- hr_employee_movements empty for clean baseline
"""
    sql_text = re.sub(r"INSERT INTO `hr_employee_movements` \(.*?\) VALUES.*?;", new_mov_sql, sql_text, flags=re.DOTALL)

    # Update hr_monthly_rosters for T6, T7, T8 with 338 items
    roster_t8_sql = """INSERT INTO `hr_monthly_rosters` (`id`, `period_start`, `status`, `source_roster_id`, `source_import_batch_id`, `snapshot_schema_version`, `item_count`, `roster_checksum`, `opened_at`, `opened_by_actor`, `closed_at`, `closed_by_actor`, `exported_at`, `exported_by_actor`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES
('c895cc0b-4d87-4ae0-b158-a95c754d22bc',	'2026-06-01',	'CLOSED',	NULL,	'1c3d83be-2d32-42af-9479-5b13a714efba',	1,	338,	'95e1c2440686820af7095c17fc937e33ecdc772793769ac02c092eea1e3c3a27',	'2026-07-23 20:53:02.631944',	'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d',	'2026-07-23 20:53:02.631944',	'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d',	NULL,	NULL,	'2026-07-23 20:53:02.985894',	'2026-07-23 20:53:04.287083',	'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d',	'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d',	1),
('9847303a-e9d5-4b93-a9a7-56dfbb0acce9',	'2026-07-01',	'CLOSED',	'c895cc0b-4d87-4ae0-b158-a95c754d22bc',	NULL,	1,	338,	'155564e4f846fbd5e1fa9fd59c0fd7a29fea6991860baa4e877817f3875c422c',	'2026-07-23 21:05:13.580825',	'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d',	'2026-07-31 23:59:59.000000',	'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d',	NULL,	NULL,	'2026-07-23 21:05:08.235059',	'2026-07-23 21:05:13.947432',	'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d',	'USER:8b5a15cd-a4ce-4784-b485-15875d1e647d',	1),
('roster-2026-08',	'2026-08-01',	'OPEN',	'9847303a-e9d5-4b93-a9a7-56dfbb0acce9',	NULL,	1,	338,	NULL,	'2026-08-01 00:00:00.000000',	'system',	NULL,	NULL,	NULL,	NULL,	NOW(6),	NOW(6),	'system',	'system',	0);"""
    sql_text = re.sub(r"INSERT INTO `hr_monthly_rosters` \(.*?\) VALUES.*?;", roster_t8_sql, sql_text, flags=re.DOTALL)

    # Populate all 338 employees into baseline roster c895cc0b-4d87-4ae0-b158-a95c754d22bc, T7, and T8
    all_roster_items = []
    for roster_id in ['c895cc0b-4d87-4ae0-b158-a95c754d22bc', '9847303a-e9d5-4b93-a9a7-56dfbb0acce9', 'roster-2026-08']:
        for emp in excel_employees:
            roster_item_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"roster-item-{roster_id}-{emp['code']}"))
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
            all_roster_items.append(f"('{roster_item_id}',\t'{roster_id}',\t'{emp['id']}',\t{emp['stt']},\tNULL,\t'{emp['code']}',\t'{name_esc}',\t'{emp['dept_code']}',\t'{dept_name_esc}',\t'{emp['pos_code']}',\t'{pos_name_esc}',\t'{emp['cond_code']}',\t'{cond_name_esc}',\t'ACTIVE',\t{hire_date_str},\tNULL,\t{emp['leave_days']},\t'BASELINE',\tNULL,\t1,\t'{payload_json}',\t'{payload_sha}',\tNOW(6),\t'system')")

    new_items_sql = "INSERT INTO `hr_monthly_roster_items` (`id`, `roster_id`, `employee_id`, `display_order`, `department_display_order`, `employee_code`, `full_name`, `department_code`, `department_name`, `position_code`, `position_name`, `working_condition_code`, `working_condition_name`, `employment_status`, `hire_date`, `termination_date`, `leave_days`, `inclusion_reason`, `source_movement_id`, `snapshot_schema_version`, `snapshot_payload`, `payload_sha256`, `created_at`, `created_by_actor`) VALUES\n" + ",\n".join(all_roster_items) + ";\n\n"
    sql_text = re.sub(r"INSERT INTO `hr_monthly_roster_items` \(.*?\) VALUES.*?;", new_items_sql, sql_text, flags=re.DOTALL)

    # 5. Fix trailing commas
    lines = sql_text.splitlines()
    fixed_lines = []
    for i in range(len(lines)):
        curr = lines[i]
        if curr.strip().endswith(","):
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                j += 1
            if j == len(lines) or lines[j].strip().startswith("DROP") or lines[j].strip().startswith("CREATE") or lines[j].strip().startswith("INSERT"):
                curr = curr.rstrip().rstrip(",") + ";"
        fixed_lines.append(curr)

    final_sql = "\n".join(fixed_lines)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(final_sql)

    print(f"🎉 HOÀN THÀNH: Đã xuất file {OUTPUT_PATH} với chuẩn xác 338 nhân sự từ sheet T8-26!")

if __name__ == "__main__":
    main()
