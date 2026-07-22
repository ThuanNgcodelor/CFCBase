#!/usr/bin/env python3
"""Build the clean Phase 0.1 HR baseline workbook."""

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
    create_phase01,
    display_path,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Tạo baseline nhân sự 2026 sạch theo contract Phase 0.1."
    )
    parser.add_argument("--original", type=Path, default=DEFAULT_ORIGINAL)
    parser.add_argument(
        "--formatted-source", type=Path, default=DEFAULT_FORMATTED_SOURCE
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    try:
        result = create_phase01(
            args.original, args.formatted_source, args.output, args.manifest
        )
    except (
        Phase01ContractError,
        OSError,
        ValueError,
        zipfile.BadZipFile,
        ET.ParseError,
    ) as exc:
        print(f"[HR Phase 0.1 Build] ERROR: {exc}")
        return 1

    comparison = result["comparison_to_original"]["T6-26"]
    print("[HR Phase 0.1 Build] PASS: baseline sạch đã được tạo.")
    print(f"  Baseline: {display_path(args.output)}")
    print(f"  Manifest: {display_path(args.manifest)}")
    print(f"  SHA-256: {result['artifacts']['baseline']['sha256']}")
    print("  Sheets: GIAM, TĂNG, T6-26 (3 visible / 0 hidden)")
    print(
        f"  Original comparison: {comparison['cells_checked']} cells, "
        f"{comparison['mismatches']} mismatch"
    )
    print("  T6-26: A1:AH333, 329 employees, leave column AH blank")
    print("  Formula cells: 0; retained literal #N/A values: 29")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

