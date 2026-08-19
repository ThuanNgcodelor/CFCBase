#!/usr/bin/env python3
import re

with open("/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

start = text.find("INSERT INTO `hr_probation_contracts`")
end = text.find("DROP TABLE IF EXISTS `hr_probation_job_templates`")
if end == -1:
    end = text.find("DROP TABLE IF EXISTS `hr_working_conditions`")
print(f"hr_probation_contracts start: {start}, end: {end}")

# Let's find the next DROP TABLE after hr_probation_contracts
p = re.search(r"DROP TABLE IF EXISTS `hr_probation_contracts`;.*?(DROP TABLE IF EXISTS `[a-zA-Z0-9_]+`;)", text, re.DOTALL)
if p:
    print("Next table is:", p.group(1))
