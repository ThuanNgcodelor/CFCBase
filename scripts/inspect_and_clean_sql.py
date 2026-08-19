#!/usr/bin/env python3
import re

sql_path = "/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt"
with open(sql_path, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

print("Total lines in sql.txt:", len(lines))

tables = []
for l in lines:
    m = re.search(r"CREATE TABLE [`\"]?([a-zA-Z0-9_]+)[`\"]?", l)
    if m:
        tables.append(m.group(1))

print("Tables found in dump:", len(tables), tables)

thuannn_lines = []
for idx, l in enumerate(lines):
    if "TV-2607270642282" in l or "Thuậnnn" in l:
        thuannn_lines.append((idx + 1, l.strip()[:140]))

print(f"\nFound {len(thuannn_lines)} lines mentioning Thuậnnn:")
for num, content in thuannn_lines:
    print(f"  Line {num}: {content}")
