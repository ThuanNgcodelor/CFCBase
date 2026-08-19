#!/usr/bin/env python3
import re

with open("/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

start = text.find("INSERT INTO `hr_probation_contracts`")
end = text.find("DROP TABLE IF EXISTS `hr_probation_job_templates`")

contracts_sql = text[start:end].strip()
print("Total length of contracts block:", len(contracts_sql))

# Count how many records: look for ('uuid', 'candidate_id', '04', 2026 ...
tuples = re.findall(r"\('([0-9a-f\-]{36})',\s*'([0-9a-f\-]{36})',\s*'([0-9]+)',\s*([0-9]+)", contracts_sql)
print(f"Total contracts found: {len(tuples)}")
for t in tuples:
    print("Contract:", t)
