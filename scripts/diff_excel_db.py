#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET

# 1. Read Excel T8-26
EXCEL_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/Danh sách nhân sự 2026.xlsx"

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

    for s in root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"):
        if s.attrib.get("name") == "T8-26":
            r_id = s.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = rel_map.get(r_id, "")
            sheet_path = "xl/" + target if not target.startswith("xl/") else target
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
                dept = cells.get("O", "").strip()
                pos = cells.get("N", "").strip()
                if stt.isdigit() and code and name:
                    excel_employees.append((int(stt), code, name, dept, pos))

print(f"Excel T8-26 total: {len(excel_employees)}")

# 2. Check DB
import subprocess
out = subprocess.check_output(['docker', 'exec', 'booking_db', 'mysql', '-uroot', '-prootpassword', '--default-character-set=utf8mb4', '-e', 'USE booking_db; SELECT employee_code, full_name, employment_status FROM hr_employees WHERE employment_status = "ACTIVE";']).decode('utf-8', errors='ignore')
db_active = {}
for line in out.splitlines()[1:]:
    parts = line.split('\t')
    if len(parts) >= 2:
        db_active[parts[0]] = parts[1]

print(f"DB ACTIVE employees: {len(db_active)}")

excel_codes = {e[1]: e[2] for e in excel_employees}
missing_in_db = [c for c, n in excel_codes.items() if c not in db_active]
print(f"Missing in DB ACTIVE ({len(missing_in_db)}):", [(c, excel_codes[c]) for c in missing_in_db])

extra_in_db = [c for c, n in db_active.items() if c not in excel_codes]
print(f"Extra in DB ACTIVE ({len(extra_in_db)}):", [(c, db_active[c]) for c in extra_in_db])
