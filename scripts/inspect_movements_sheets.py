#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET

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

    for sheet_name in ["TĂNG", "GIAM"]:
        for s in root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"):
            if s.attrib.get("name") == sheet_name:
                r_id = s.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                target = rel_map.get(r_id, "")
                sheet_path = "xl/" + target if not target.startswith("xl/") else target
                s_xml = z.read(sheet_path)
                s_root = ET.fromstring(s_xml)
                
                print(f"\n--- Sheet '{sheet_name}' ---")
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
                    print("Row:", {k: v for k, v in cells.items() if v})
