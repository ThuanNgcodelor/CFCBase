#!/usr/bin/env python3
import re

with open("/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

# Check departments
m_dept = re.search(r"INSERT INTO `hr_departments` \(.*?\) VALUES(.*?);", text, re.DOTALL)
if m_dept:
    print("Departments in sql.txt:")
    for line in m_dept.group(1).splitlines():
        if line.strip().startswith("('"):
            print("  ", line.strip()[:80])

# Check positions
m_pos = re.search(r"INSERT INTO `hr_positions` \(.*?\) VALUES(.*?);", text, re.DOTALL)
if m_pos:
    print("\nPositions in sql.txt (first 5):")
    for line in m_pos.group(1).splitlines()[:5]:
        if line.strip().startswith("('"):
            print("  ", line.strip()[:80])
