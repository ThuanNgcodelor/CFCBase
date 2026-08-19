#!/usr/bin/env python3
import re
import json

with open("/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

start = text.find("INSERT INTO `hr_probation_contracts`")
end = text.find("DROP TABLE IF EXISTS `hr_probation_job_templates`")

contracts_sql = text[start:end].strip()

# Find each record start: ('<uuid>',\t'<candidate_id>',\t'<contract_no>',\t<year>, ...
record_starts = list(re.finditer(r"\('([0-9a-f\-]{36})',\s*'([0-9a-f\-]{36})',\s*'([0-9]+)',\s*([0-9]+),\s*'([^']+)',\s*'([a-f0-9]+)',\s*'([^']+)',\s*'([a-f0-9]+)'", contracts_sql))

print("Found contract records:", len(record_starts))
clean_rows = []

for i, m in enumerate(record_starts):
    cid = m.group(1)
    cand_id = m.group(2)
    cno = m.group(3)
    cyear = m.group(4)
    tpl_name = m.group(5)
    tpl_sha = m.group(6)
    gen_name = m.group(7)
    gen_sha = m.group(8)
    
    if cand_id == "c68cb340-b1ad-4f2e-afbb-95e7b6552743": # Thuannn
        print("Skipping trash contract for Thuannn:", cid)
        continue
    
    # Next record start index or end of string
    next_idx = record_starts[i+1].start() if i+1 < len(record_starts) else len(contracts_sql)
    chunk = contracts_sql[m.start():next_idx]
    
    # Extract trailing fields: '{"{{...}}', '<status>', '<generated_at>', '<actor>', '<created_at>', '<updated_at>', '<actor>', '<actor>', <version>
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
        
        row = f"('{cid}', '{cand_id}', '{cno}', {cyear}, '{tpl_name}', '{tpl_sha}', '{gen_name}', '{gen_sha}', 0x504B0304, '{payload}', '{status}', '{gen_at}', '{gen_actor}', '{created_at}', '{updated_at}', '{cr_actor}', '{up_actor}', {row_ver})"
        clean_rows.append(row)
        print(f"✅ Extracted contract {cno}/{cyear} for candidate {cand_id}")
    else:
        print(f"⚠️ Could not parse trailing fields for contract {cid}")

print(f"Total clean contract rows extracted: {len(clean_rows)}")
