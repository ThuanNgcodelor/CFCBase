#!/usr/bin/env python3
"""Build the clean-view HR template v2 from verified template v1."""

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
    display_path,
)
from hr_template_v2_contract import (
    DEFAULT_V2_MANIFEST,
    DEFAULT_V2_TEMPLATE,
    create_v2_template,
    secure_v2_permissions,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Tạo template HR v2 chỉ hiện GIAM, TĂNG và T1-26 đến T6-26."
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--v1-template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--v1-manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_V2_TEMPLATE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_V2_MANIFEST)
    args = parser.parse_args()

    paths = [
        args.source.resolve(),
        args.v1_template.resolve(),
        args.v1_manifest.resolve(),
        args.output.resolve(),
        args.manifest.resolve(),
    ]
    try:
        result = create_v2_template(*paths)
        secure_v2_permissions(paths[3])
    except (
        TemplateContractError,
        OSError,
        ValueError,
        zipfile.BadZipFile,
        ET.ParseError,
    ) as exc:
        print(f"[HR Template v2] ERROR: {exc}")
        return 1

    print("[HR Template v2] PASS: clean template đã được tạo và kiểm tra.")
    print(f"  Template: {display_path(paths[3])}")
    print(f"  Manifest: {display_path(paths[4])}")
    print(f"  SHA-256:  {result['template_v2']['sha256']}")
    print("  Visible: GIAM, TĂNG, T1-26, T2-26, T3-26, T4-26, T5-26, T6-26")
    print("  Hidden: 25 sheet còn lại (không xóa dependency)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
