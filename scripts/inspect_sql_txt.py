#!/usr/bin/env python3
import re

with open("/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

print("File total lines:", len(text.splitlines()))

# Find all tables
tables = re.findall(r"DROP TABLE IF EXISTS `([a-zA-Z0-9_]+)`;", text)
print(f"Total tables: {len(tables)}")
for t in tables:
    # check how many rows
    m = re.search(r"INSERT INTO `" + t + r"` \(.*?\) VALUES(.*?);(?=\n\n|\nDROP|\Z)", text, re.DOTALL)
    if m:
        # count tuples
        val_str = m.group(1).strip()
        # rough count of rows by lines starting with ('
        rows = [l for l in val_str.splitlines() if l.strip().startswith("('") or l.strip().startswith("(")]
        print(f" - {t:35}: {len(rows)} rows")
    else:
        print(f" - {t:35}: 0 rows (or empty)")
