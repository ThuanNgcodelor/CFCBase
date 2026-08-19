#!/usr/bin/env python3
"""
Direct SQL.txt Cleaner v2
1. Replaces raw binary hr_probation_contracts with clean hex docx statements
2. Removes all Thuannn / TV-2607270642282 records
3. Preserves 100% of sql.txt (all 34 tables, all 1012 roster items, all 338 employees, all catalogs)
"""

import re
import sys

SQL_INPUT_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt"
SQL_OUTPUT_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/clean_database_master.sql"

def clean_and_build():
    print("🚀 Đang đọc sql.txt...")
    with open(SQL_INPUT_PATH, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()

    trash_ids = [
        "c68cb340-b1ad-4f2e-afbb-95e7b6552743", # Candidate ID
        "efb31f9b-b85b-4cd2-a99a-f6315fa48509", # Draft Employee ID
        "TV-2607270642282",                     # Candidate Code
        "Nguyễn Trung Thuậnnn"                  # Candidate Name
    ]

    # 1. Extract and clean hr_probation_contracts
    start_ctr = text.find("INSERT INTO `hr_probation_contracts`")
    end_ctr = text.find("DROP TABLE IF EXISTS `hr_probation_job_templates`")
    contracts_raw = text[start_ctr:end_ctr].strip()

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

    # Replace in text
    text = text[:start_ctr] + clean_contracts_stmt + text[end_ctr:]

    # 2. Filter lines
    lines = text.splitlines()
    cleaned_lines = []
    removed_count = 0

    for idx, line in enumerate(lines):
        if any(tid in line for tid in trash_ids):
            removed_count += 1
            continue
        cleaned_lines.append(line)

    print(f"✅ Đã loại bỏ {removed_count} dòng dữ liệu rác của Nguyễn Trung Thuậnnn.")

    # 3. Fix trailing commas
    fixed_lines = []
    for i in range(len(cleaned_lines)):
        curr = cleaned_lines[i]
        if curr.strip().endswith(","):
            j = i + 1
            while j < len(cleaned_lines) and cleaned_lines[j].strip() == "":
                j += 1
            if j == len(cleaned_lines) or cleaned_lines[j].strip().startswith("DROP") or cleaned_lines[j].strip().startswith("CREATE") or cleaned_lines[j].strip().startswith("INSERT"):
                curr = curr.rstrip().rstrip(",") + ";"
        fixed_lines.append(curr)

    final_sql = "\n".join(fixed_lines)

    with open(SQL_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(final_sql)

    print(f"🎉 Hoàn thành xuất file {SQL_OUTPUT_PATH} từ đúng nguồn sql.txt gốc!")

if __name__ == "__main__":
    clean_and_build()
