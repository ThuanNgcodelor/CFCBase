#!/usr/bin/env python3
import re

with open("/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

tables = re.findall(r"CREATE TABLE [`\"]?([a-zA-Z0-9_]+)[`\"]?", text)
print(f"Total tables found in sql.txt: {len(tables)}")
for t in tables:
    print(f" - {t}")
