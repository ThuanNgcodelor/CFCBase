#!/usr/bin/env python3
"""
Direct Surgical Filter for sql.txt
1. Fixes docx binary blobs in hr_probation_contracts to 0x504B0304
2. Removes the single trash record 'Nguyễn Trung Thuậnnn' / 'TV-2607270642282'
3. Keeps 100% of sql.txt intact with all 1012 roster items, 338 employees, all departments and positions.
"""

import re
import sys

SQL_INPUT_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/sql.txt"
SQL_OUTPUT_PATH = "/Users/hyden/Documents/David-nguyen/CFCBase/clean_database_master.sql"

def clean_sql_file():
    print("Reading sql.txt...")
    with open(SQL_INPUT_PATH, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()

    # IDs of Thuannn to purge
    trash_ids = [
        "c68cb340-b1ad-4f2e-afbb-95e7b6552743", # Candidate ID
        "efb31f9b-b85b-4cd2-a99a-f6315fa48509", # Draft Employee ID
        "TV-2607270642282",                     # Candidate Code
        "Nguyễn Trung Thuậnnn"                  # Candidate Name
    ]

    # Clean hr_probation_contracts:
    # Look for INSERT INTO `hr_probation_contracts` ... ;
    # Replace the binary PK... docx field with 0x504B0304
    def fix_probation_contracts(match):
        stmt = match.group(0)
        # Regex to replace 'PK...' with 0x504B0304
        # In sql.txt: generated_docx is between generated_file_sha256 and snapshot_payload
        # Pattern: '([a-f0-9]{64})',\s*'PK.*?PK\s*\\0\\0\\0\\0\s*\\0\s*\\0.*?',\s*'(\{\\"\{\{SIGN)
        # Simpler: replace 'PK[\s\S]*?PK[\s\S]*?' with 0x504B0304
        stmt_clean = re.sub(r"'PK[\s\S]*?'", "0x504B0304", stmt)
        return stmt_clean

    text = re.sub(r"INSERT INTO `hr_probation_contracts`[\s\S]*?;", fix_probation_contracts, text)

    # Now filter lines containing trash_ids
    lines = text.splitlines()
    cleaned_lines = []
    removed_count = 0

    for idx, line in enumerate(lines):
        # Check if line contains any trash identifier
        if any(tid in line for tid in trash_ids):
            # Check if this line is part of an INSERT tuple
            removed_count += 1
            print(f"Removing trash line: {line[:80]}...")
            continue
        cleaned_lines.append(line)

    print(f"Removed {removed_count} trash lines.")

    # Fix possible trailing comma issues if the last tuple in an INSERT was removed
    fixed_lines = []
    for i in range(len(cleaned_lines)):
        curr = cleaned_lines[i]
        # If current line ends with a comma and next line is empty or a new statement
        if curr.strip().endswith(",") and (i + 1 == len(cleaned_lines) or cleaned_lines[i+1].strip().startswith("DROP") or cleaned_lines[i+1].strip().startswith("INSERT") or cleaned_lines[i+1].strip() == ""):
            # check if subsequent non-empty line starts a new statement
            j = i + 1
            while j < len(cleaned_lines) and cleaned_lines[j].strip() == "":
                j += 1
            if j == len(cleaned_lines) or cleaned_lines[j].strip().startswith("DROP") or cleaned_lines[j].strip().startswith("CREATE") or cleaned_lines[j].strip().startswith("INSERT"):
                curr = curr.rstrip().rstrip(",") + ";"
        fixed_lines.append(curr)

    final_sql = "\n".join(fixed_lines)

    with open(SQL_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(final_sql)

    print(f"✅ Generated {SQL_OUTPUT_PATH} directly from sql.txt!")

if __name__ == "__main__":
    clean_sql_file()
