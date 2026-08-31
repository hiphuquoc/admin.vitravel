#!/usr/bin/env python3
from pathlib import Path

ROOT = Path("/var/www/html/admin.vitravel.dev/src")

FILES = [
    "features/packages/PackageFormPage.tsx",
    "app/(dashboard)/services/products/form/page.tsx",
    "app/(dashboard)/services/categories/form/page.tsx",
    "app/(dashboard)/tours/categories/form/page.tsx",
    "app/(dashboard)/tours/destinations/form/page.tsx",
    "app/(dashboard)/tours/themes/form/page.tsx",
    "app/(dashboard)/cruises/types/form/page.tsx",
    "app/(dashboard)/content/articles/form/page.tsx",
    "app/(dashboard)/content/slides/form/page.tsx",
    "app/(dashboard)/brand/team/form/page.tsx",
    "app/(dashboard)/brand/reviews/form/page.tsx",
    "app/(dashboard)/brand/videos/form/page.tsx",
    "app/(dashboard)/settings/users/form/page.tsx",
]

IMPORT_LINE = "import { beginFormHydration, markFormHydrationStale } from '@/hooks/useFormHydration';\n"
IMPORT_NEEDLES = [
    "import { useEditLocale } from '@/hooks/useEditLocale';\n",
    "import { useAuth } from '@/lib/auth-context';\n",
]


def patch(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    orig = text

    if "beginFormHydration" not in text:
        inserted = False
        for needle in IMPORT_NEEDLES:
            if needle in text:
                text = text.replace(needle, needle + IMPORT_LINE, 1)
                inserted = True
                break
        if not inserted:
            # after first import block line containing 'from'
            lines = text.splitlines(True)
            for i, line in enumerate(lines):
                if line.startswith("import ") and " from " in line:
                    # find last consecutive import
                    j = i
                    while j + 1 < len(lines) and (
                        lines[j + 1].startswith("import ")
                        or lines[j + 1].startswith("}")
                        or lines[j + 1].strip() == ""
                        or lines[j + 1].startswith("  ")
                        or lines[j + 1].startswith("\t")
                        or lines[j + 1].startswith("type ")
                        or lines[j + 1].startswith("}")
                    ):
                        # better: find end of imports
                        break
            # simpler: after last import ... from ...;
            last_import = -1
            for i, line in enumerate(lines):
                if "from '" in line or 'from "' in line:
                    last_import = i
            if last_import >= 0:
                lines.insert(last_import + 1, IMPORT_LINE)
                text = "".join(lines)
                inserted = True
        if not inserted:
            return f"FAIL import {path}"

    if "hydrateKeyRef" not in text:
        # after snapshotRef declaration
        markers = [
            "const snapshotRef = useRef",
            "const snapshotRef=",
        ]
        placed = False
        for m in markers:
            idx = text.find(m)
            if idx < 0:
                continue
            end = text.find("\n", idx)
            if end < 0:
                continue
            insert = "\n  const hydrateKeyRef = useRef<string | null>(null);"
            text = text[:end] + insert + text[end:]
            placed = True
            break
        if not placed:
            # after useState form
            idx = text.find("useState")
            # try after isDirty
            for m in ["const isDirty = useMemo", "const [form, setForm]"]:
                idx = text.find(m)
                if idx >= 0:
                    end = text.find("\n", idx)
                    # for isDirty find closing );
                    if m.startswith("const isDirty"):
                        end = text.find(";", idx)
                    text = text[: end + 1] + "\n  const hydrateKeyRef = useRef<string | null>(null);" + text[end + 1 :]
                    placed = True
                    break
        if not placed:
            return f"FAIL ref {path}"

    # Guard detailQuery hydration
    guards = [
        (
            "useEffect(() => {\n    if (!detailQuery.data) return;\n",
            "useEffect(() => {\n    if (!detailQuery.data) return;\n    if (!beginFormHydration(hydrateKeyRef, id, locale)) return;\n",
        ),
        (
            "useEffect(() => {\n    if (!detailQuery.data) {\n      return;\n    }\n",
            "useEffect(() => {\n    if (!detailQuery.data) {\n      return;\n    }\n    if (!beginFormHydration(hydrateKeyRef, id, locale)) return;\n",
        ),
    ]
    if "beginFormHydration(hydrateKeyRef" not in text:
        applied = False
        for old, new in guards:
            if old in text:
                text = text.replace(old, new, 1)
                applied = True
                break
        if not applied:
            return f"FAIL guard {path}"

    # detail query refetch opts — first occurrence of enabled: !!id in detailQuery block
    if "refetchOnWindowFocus: false" not in text:
        old = "enabled: !!id,\n  });"
        new = "enabled: !!id,\n    refetchOnWindowFocus: false,\n    refetchInterval: false,\n  });"
        if old in text:
            text = text.replace(old, new, 1)

    # mark stale on save success — best effort
    if "markFormHydrationStale" in text and "markFormHydrationStale(hydrateKeyRef)" not in text:
        for needle in [
            "toast.success(isNew ? 'Đã tạo' : 'Đã lưu');\n",
            'toast.success(isNew ? "Đã tạo" : "Đã lưu");\n',
            "toast.success('Đã lưu');\n",
            'toast.success("Đã lưu");\n',
        ]:
            if needle in text:
                text = text.replace(
                    needle,
                    needle + "      markFormHydrationStale(hydrateKeyRef);\n",
                    1,
                )
                break

    if text != orig:
        path.write_text(text, encoding="utf-8")
        return f"OK {path.relative_to(ROOT)}"
    return f"NOCHANGE {path.relative_to(ROOT)}"


def main():
    for rel in FILES:
        print(patch(ROOT / rel))


if __name__ == "__main__":
    main()
