"""
把 Chiron GoRound TC（SIL OFL 1.1，可子集化與再散布）切成自架的 woff2 分片。

為什麼不用 next/font/google：這套字在 Turbopack 開發模式會固定有某個分片下載失敗，整個頁面跟著壞掉；
自架也讓孩子的瀏覽器不必連到 Google。

做法跟 Google Fonts 一樣用 unicode-range 分片：瀏覽器只下載頁面上真的用到的那幾片。
- 第 0 片：英數標點＋程式與種子資料裡出現的所有中文字（介面一定會用到）
- 其餘：Big5 常用字（A440–C67E，5401 字）中剩下的字，依碼位切成數片，涵蓋孩子暱稱、家庭名稱等輸入
不在這些範圍的字，會用 CSS 字體清單後面的系統字體顯示。

用法（需要 fonttools 與 brotli）：
  python scripts/subset-font.py <ChironGoRoundTC[wght].ttf 的路徑>
原始字檔：https://github.com/google/fonts/tree/main/ofl/chirongoroundtc
"""

import pathlib
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "app" / "fonts" / "chiron"
FAMILY = "Chiron GoRound TC"
CHUNK = 900

BASIC = (
    set(range(0x20, 0x7F))
    | set(range(0xA0, 0x100))
    | set(range(0x2010, 0x2028))
    | set(range(0x2030, 0x203F))
    | {0x2190, 0x2192, 0x2212, 0x00D7, 0x2026}
    | set(range(0x3000, 0x3020))
    | set(range(0xFF01, 0xFF5F))
)


def ui_chars() -> set[int]:
    chars: set[int] = set()
    for pattern in ("src/**/*.ts", "src/**/*.tsx", "supabase/migrations/*.sql"):
        for path in ROOT.glob(pattern):
            chars |= {ord(c) for c in path.read_text(encoding="utf-8") if ord(c) >= 0x2E80}
    return chars


def big5_common() -> set[int]:
    chars: set[int] = set()
    for lead in range(0xA4, 0xC7):
        for trail in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
            if (lead, trail) > (0xC6, 0x7E):
                break
            try:
                chars.add(ord(bytes([lead, trail]).decode("big5")))
            except UnicodeDecodeError:
                pass
    return chars


def to_ranges(codes: list[int]) -> str:
    codes = sorted(codes)
    parts, start, prev = [], codes[0], codes[0]
    for c in codes[1:] + [None]:
        if c is not None and c == prev + 1:
            prev = c
            continue
        parts.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        if c is not None:
            start = prev = c
    return ", ".join(parts)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    source = pathlib.Path(sys.argv[1])
    available = set(TTFont(source, lazy=True).getBestCmap().keys())
    first = (BASIC | ui_chars()) & available
    rest = sorted((big5_common() & available) - first)
    slices = [sorted(first)] + [rest[i : i + CHUNK] for i in range(0, len(rest), CHUNK)]

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.woff2"):
        old.unlink()
    css = [f"/* 由 scripts/subset-font.py 產生，不要手動修改。{FAMILY}：SIL Open Font License 1.1（見 OFL.txt） */"]
    for i, codes in enumerate(slices):
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.hinting = False
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        font = subset.load_font(str(source), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=codes)
        subsetter.subset(font)
        name = f"chiron-goround-tc-{i:02d}.woff2"
        subset.save_font(font, str(OUT / name), options)
        size = (OUT / name).stat().st_size
        print(f"{name}: {len(codes)} 字, {size / 1024:.0f} KB")
        css.append(
            "@font-face {\n"
            f'  font-family: "{FAMILY}";\n'
            "  font-style: normal;\n"
            "  font-weight: 200 900;\n"
            "  font-display: swap;\n"
            f'  src: url("./{name}") format("woff2");\n'
            f"  unicode-range: {to_ranges(codes)};\n"
            "}"
        )
    (OUT / "chiron.css").write_text("\n".join(css) + "\n", encoding="utf-8")
    license_src = source.with_name("OFL.txt")
    if license_src.exists():
        (OUT / "OFL.txt").write_text(license_src.read_text(encoding="utf-8"), encoding="utf-8")
    print("已寫入", OUT)


if __name__ == "__main__":
    main()
