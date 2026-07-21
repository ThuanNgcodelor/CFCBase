#!/usr/bin/env python3
"""Build the local-only HR template v1 from the immutable source workbook."""

from __future__ import annotations

import argparse
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from hr_template_contract import (
    DEFAULT_MANIFEST,
    DEFAULT_SOURCE,
    DEFAULT_TEMPLATE,
    TemplateContractError,
    create_template,
    display_path,
    secure_workbook_permissions,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Tạo template HR v1 bằng patch OOXML giới hạn tại T6-26!AM4:AM333."
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    manifest = args.manifest.resolve()
    try:
        result = create_template(source, output, manifest)
        secure_workbook_permissions(source, output)
    except (
        TemplateContractError,
        OSError,
        ValueError,
        zipfile.BadZipFile,
        ET.ParseError,
    ) as exc:
        print(f"[HR Template] ERROR: {exc}")
        return 1

    print("[HR Template] PASS: template v1 đã được tạo và kiểm tra.")
    print(f"  Source:   {display_path(source)}")
    print(f"  Template: {display_path(output)}")
    print(f"  Manifest: {display_path(manifest)}")
    print(f"  Source SHA-256:   {result['source']['sha256']}")
    print(f"  Template SHA-256: {result['template']['sha256']}")
    print("  Allowlist: T6-26!AM4:AM333 (không insert/shift cột)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
