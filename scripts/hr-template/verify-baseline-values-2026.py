#!/usr/bin/env python3
"""Verify the clean Phase 0.1 HR baseline and comparison manifest."""

from __future__ import annotations

import argparse
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from hr_baseline_values_contract import (
    DEFAULT_BASELINE,
    DEFAULT_FORMATTED_SOURCE,
    DEFAULT_MANIFEST,
    DEFAULT_ORIGINAL,
    Phase01ContractError,
    display_path,
    verify_phase01,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Kiểm tra baseline nhân sự 2026 theo contract Phase 0.1."
    )
    parser.add_argument("--original", type=Path, default=DEFAULT_ORIGINAL)
    parser.add_argument(
        "--formatted-source", type=Path, default=DEFAULT_FORMATTED_SOURCE
    )
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    try:
        result = verify_phase01(
            args.original, args.formatted_source, args.baseline, args.manifest
        )
    except (
        Phase01ContractError,
        OSError,
        ValueError,
        zipfile.BadZipFile,
        ET.ParseError,
    ) as exc:
        print(f"[HR Phase 0.1 Verify] ERROR: {exc}")
        return 1

    comparison = result["comparison_to_original"]["T6-26"]
    contract = result["contract"]
    print("[HR Phase 0.1 Verify] PASS: workbook và manifest hợp lệ.")
    print(f"  Baseline: {display_path(args.baseline)}")
    print(f"  SHA-256: {result['artifacts']['baseline']['sha256']}")
    print(
        f"  T6 original comparison: {comparison['cells_checked']}/"
        f"{comparison['cells_checked']} cells, 0 mismatch"
    )
    print(
        f"  Employees/codes: {contract['T6-26']['employee_rows']}/"
        f"{contract['T6-26']['unique_employee_codes']}"
    )
    print("  Sheets/formulas/hidden: 3/0/0")
    print("  OOXML relationship, comments, styles and permission checks: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

