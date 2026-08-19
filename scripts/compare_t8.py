#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET
import re

EXCEL_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/Danh sách nhân sự 2026.xlsx"
SQL_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt"

# 1. Read Excel T8-26
with zipfile.ZipFile(EXCEL_PATH, "r") as z:
    wb_xml = z.read("xl/workbook.xml")
    root = ET.fromstring(wb_xml)
    shared_strings = []
    if "xl/sharedStrings.xml" in z.namelist():
        ss_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in ss_root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
            t = si.find(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
            shared_strings.append(t.text if t is not None else "")
    
    # Read sheet T8-26
    s_xml = z.read("xl/worksheets/sheet8.xml") # check sheet name
    s_root = ET.fromstring(s_xml)
    excel_codes = []
    for r in s_root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
        cells = {}
        for c in r.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
            ref = c.attrib.get("r", "")
            col = "".join([ch for ch in ref if ch.isalpha()])
            t_type = c.attrib.get("t")
            v = c.find(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
            val = v.text if v is not None else ""
            if t_type == "s" and val.isdigit():
                val = shared_strings[int(val)]
            cells[col] = val
        stt = cells.get("A", "").strip()
        code = cells.get("C", "").strip()
        name = cells.get("E", "").strip()
        if stt.isdigit() and code:
            excel_codes.append((stt, code, name))

print(f"Total employees in Excel T8-26: {len(excel_codes)}")

# 2. Read sql.txt roster items for T8
with open(SQL_PATH, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

sql_t8_codes = re.findall(r"\('[0-9a-f\-]+',\s*'roster-2026-08',\s*'[0-9a-f\-]+',\s*[0-9]+,\s*[^,]+,\s*'([A-Za-z0-9]+)',\s*'([^']+)'", text)
print(f"Total employees in sql.txt for T8 (roster-2026-08): {len(sql_t8_codes)}")

sql_set = {c[0] for c in sql_t8_codes}
missing_in_sql = [e for e in excel_codes if e[1] not in sql_set]
print("Missing in sql.txt:", missing_in_sql)
