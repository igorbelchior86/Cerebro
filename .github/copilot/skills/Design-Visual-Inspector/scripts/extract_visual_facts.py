#!/usr/bin/env python3
"""
extract_visual_facts.py

Ferramenta auxiliar para extrair fatos mecânicos de uma screenshot sem OCR.

Gera um JSON parcial com:
- dimensões da imagem
- cores dominantes (quantização)
- contagem estimada de cores distintas (aproximação)

Uso:
  python3 extract_visual_facts.py screenshot.png
"""

import sys
from PIL import Image
from collections import Counter

def rgb_to_hex(rgb):
    return "#{:02X}{:02X}{:02X}".format(rgb[0], rgb[1], rgb[2])

def main():
    if len(sys.argv) < 2:
        print("Usage: extract_visual_facts.py <image_path>", file=sys.stderr)
        sys.exit(2)

    path = sys.argv[1]
    img = Image.open(path).convert("RGBA")
    w, h = img.size

    small = img.resize((max(1, w//4), max(1, h//4)))
    pixels = [p for p in small.getdata() if p[3] > 10]

    if not pixels:
        print({"image": {"width": w, "height": h}, "dominant_colors": [], "distinct_color_count_est": 0})
        return

    q12 = small.convert("RGB").quantize(colors=12, method=2)
    palette = q12.getpalette()[:12*3]
    counts = Counter(list(q12.getdata()))
    total = sum(counts.values()) or 1

    dom = []
    for idx, cnt in counts.most_common(8):
        r = palette[idx*3]
        g = palette[idx*3+1]
        b = palette[idx*3+2]
        dom.append({"hex": rgb_to_hex((r,g,b)), "share": round(cnt/total, 4)})

    q64 = small.convert("RGB").quantize(colors=64, method=2)
    distinct_est = len(set(q64.getdata()))

    print({
        "image": {"width": w, "height": h},
        "dominant_colors": dom,
        "distinct_color_count_est": distinct_est
    })

if __name__ == "__main__":
    main()
