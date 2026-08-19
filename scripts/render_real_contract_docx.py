#!/usr/bin/env python3
"""
Render real DOCX for all probation contracts in DB and clean_database_master.sql
"""

import zipfile
import json
import xml.sax.saxutils
import io
import re

TEMPLATE_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/backend/src/main/resources/hr/templates/probation-contract-template.docx"
SQL_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/clean_database_master.sql"

def fill_docx(template_bytes, placeholders):
    in_buf = io.BytesIO(template_bytes)
    out_buf = io.BytesIO()
    
    with zipfile.ZipFile(in_buf, 'r') as zin:
        with zipfile.ZipFile(out_buf, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "word/document.xml":
                    xml_str = data.decode("utf-8")
                    for k, v in placeholders.items():
                        escaped_val = xml.sax.saxutils.escape(str(v or ""))
                        xml_str = xml_str.replace(k, escaped_val)
                    data = xml_str.encode("utf-8")
                zout.writestr(item, data)
                
    return out_buf.getvalue()

def main():
    print("🚀 Đang đọc template DOCX...")
    with open(TEMPLATE_PATH, "rb") as f:
        template_bytes = f.read()

    with open(SQL_PATH, "r", encoding="utf-8") as f:
        sql_text = f.read()

    # Find INSERT INTO `hr_probation_contracts`
    m_ctr = re.search(r"INSERT INTO `hr_probation_contracts` \(.*?\) VALUES(.*?);", sql_text, re.DOTALL)
    if not m_ctr:
        print("❌ Không tìm thấy hr_probation_contracts trong SQL!")
        return

    rows_sql = m_ctr.group(1).strip()
    rows = [r.strip().rstrip(",") for r in rows_sql.splitlines() if r.strip().startswith("('")]
    print(f"Tìm thấy {len(rows)} hợp đồng thử việc.")

    updated_rows = []
    for r in rows:
        # Find 0x504B0304, \t'...'
        idx_0x = r.find("0x504B0304")
        if idx_0x != -1:
            after = r[idx_0x + len("0x504B0304"):]
            # Find the payload between ' and '
            m_payload = re.search(r",\s*'(\{.*?\})',\s*'([A-Z_]+)'", after)
            if m_payload:
                raw_json = m_payload.group(1).replace('\\"', '"').replace("\\'", "'")
                try:
                    placeholders = json.loads(raw_json)
                except Exception:
                    # fallback replace
                    raw_json = raw_json.replace('\\\\', '\\')
                    placeholders = json.loads(raw_json)
                
                rendered_docx = fill_docx(template_bytes, placeholders)
                hex_docx = "0x" + rendered_docx.hex().upper()
                
                # Replace 0x504B0304 with hex_docx
                new_r = r[:idx_0x] + hex_docx + r[idx_0x + len("0x504B0304"):]
                updated_rows.append(new_r)
                print(f"✅ Đã render DOCX thật ({len(rendered_docx)} bytes) cho hợp đồng {placeholders.get('{{FULL_NAME}}')}.")
                continue
        print("⚠️ Không match payload cho row:", r[:80])
        updated_rows.append(r)

    new_contracts_sql = "INSERT INTO `hr_probation_contracts` (`id`, `candidate_id`, `contract_no`, `contract_year`, `template_file_name`, `template_sha256`, `generated_file_name`, `generated_file_sha256`, `generated_docx`, `snapshot_payload`, `status`, `generated_at`, `generated_by_actor`, `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`, `row_version`) VALUES\n" + ",\n".join(updated_rows) + ";\n\n"
    
    sql_text = re.sub(r"INSERT INTO `hr_probation_contracts` \(.*?\) VALUES.*?;", new_contracts_sql, sql_text, flags=re.DOTALL)
    
    with open(SQL_PATH, "w", encoding="utf-8") as f:
        f.write(sql_text)

    print("🎉 Hoàn thành cập nhật DOCX thật vào clean_database_master.sql!")

if __name__ == "__main__":
    main()
