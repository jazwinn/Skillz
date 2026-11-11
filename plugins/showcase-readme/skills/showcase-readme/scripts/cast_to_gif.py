import argparse
import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

BG = (13, 17, 23)
FG = (201, 209, 217)
BAR = (22, 27, 34)
BORDER = (48, 54, 61)
ANSI16 = [(1, 4, 9), (255, 123, 114), (63, 185, 80), (210, 153, 34), (88, 166, 255), (188, 140, 255),
          (57, 197, 207), (177, 186, 196), (110, 118, 129), (255, 161, 152), (86, 211, 100),
          (227, 179, 65), (121, 192, 255), (210, 168, 255), (86, 212, 221), (240, 246, 252)]
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\CascadiaMono.ttf", r"C:\Windows\Fonts\consola.ttf",
    "/System/Library/Fonts/Menlo.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
]
CSI = re.compile(r"\x1b\[([0-9;?]*)([A-Za-z])")


def color256(n):
    if n < 16:
        return ANSI16[n]
    if n < 232:
        n -= 16
        steps = [0, 95, 135, 175, 215, 255]
        return (steps[n // 36], steps[(n // 6) % 6], steps[n % 6])
    v = 8 + 10 * (n - 232)
    return (v, v, v)


class Screen:
    def __init__(self, cols, rows):
        self.cols, self.rows = cols, rows
        self.cells = [[(" ", None, False, False) for _ in range(cols)] for _ in range(rows)]
        self.x = self.y = 0
        self.fg, self.bold, self.dim = None, False, False

    def newline(self):
        self.x = 0
        self.y += 1
        if self.y >= self.rows:
            self.cells.pop(0)
            self.cells.append([(" ", None, False, False) for _ in range(self.cols)])
            self.y = self.rows - 1

    def put(self, ch):
        if self.x >= self.cols:
            self.newline()
        self.cells[self.y][self.x] = (ch, self.fg, self.bold, self.dim)
        self.x += 1

    def sgr(self, params):
        codes = [int(c) if c else 0 for c in params.split(";")] if params else [0]
        i = 0
        while i < len(codes):
            c = codes[i]
            if c == 0:
                self.fg, self.bold, self.dim = None, False, False
            elif c == 1:
                self.bold = True
            elif c == 2:
                self.dim = True
            elif c == 22:
                self.bold = self.dim = False
            elif c == 39:
                self.fg = None
            elif 30 <= c <= 37:
                self.fg = ANSI16[c - 30]
            elif 90 <= c <= 97:
                self.fg = ANSI16[c - 82]
            elif c == 38 and i + 2 < len(codes) and codes[i + 1] == 5:
                self.fg = color256(codes[i + 2])
                i += 2
            elif c == 38 and i + 4 < len(codes) and codes[i + 1] == 2:
                self.fg = tuple(codes[i + 2:i + 5])
                i += 4
            i += 1

    def feed(self, text):
        i = 0
        while i < len(text):
            ch = text[i]
            if ch == "\x1b":
                m = CSI.match(text, i)
                if m:
                    params, final = m.groups()
                    if final == "m":
                        self.sgr(params)
                    elif final == "K":
                        mode = int(params or 0)
                        rng = range(self.cols) if mode == 2 else range(self.x, self.cols) if mode == 0 else range(0, self.x)
                        for k in rng:
                            self.cells[self.y][k] = (" ", None, False, False)
                    elif final == "J" and params in ("2", "3"):
                        self.cells = [[(" ", None, False, False) for _ in range(self.cols)] for _ in range(self.rows)]
                        self.x = self.y = 0
                    i = m.end()
                    continue
                i += 1
                continue
            if ch == "\n":
                self.newline()
            elif ch == "\r":
                self.x = 0
            elif ch == "\b":
                self.x = max(0, self.x - 1)
            elif ch == "\t":
                self.x = min(self.cols - 1, (self.x // 8 + 1) * 8)
            elif ch >= " ":
                self.put(ch)
            i += 1

    def snapshot(self):
        return tuple(tuple(r) for r in self.cells), self.x, self.y


def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def blend(c, amount):
    return tuple(int(BG[k] + (c[k] - BG[k]) * amount) for k in range(3))


def render(snap, cols, rows, font, cw, ch, title, cursor, badge="", pad=18, bar=34):
    cells, cx, cy = snap
    w = cols * cw + pad * 2
    h = rows * ch + pad * 2 + bar
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, bar], fill=BAR)
    d.line([0, bar, w, bar], fill=BORDER)
    for k, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([14 + k * 20, bar // 2 - 6, 26 + k * 20, bar // 2 + 6], fill=col)
    if title:
        tw = d.textlength(title, font=font)
        d.text(((w - tw) / 2, bar // 2), title, font=font, fill=(139, 148, 158), anchor="lm")
    if badge:
        bw = d.textlength(badge, font=font)
        x1 = w - 12
        x0 = x1 - bw - 16
        d.rounded_rectangle([x0, bar // 2 - 11, x1, bar // 2 + 11], radius=6, fill=(56, 139, 253))
        d.text((x0 + 8, bar // 2), badge, font=font, fill=(255, 255, 255), anchor="lm")
    for y, row in enumerate(cells):
        for x, (glyph, fg, bold, dim) in enumerate(row):
            if glyph == " ":
                continue
            color = fg or FG
            if bold and fg is None:
                color = (240, 246, 252)
            if dim:
                color = blend(color, 0.55)
            d.text((pad + x * cw, bar + pad + y * ch), glyph, font=font, fill=color)
    if cursor and cx < cols:
        x0, y0 = pad + cx * cw, bar + pad + cy * ch
        d.rectangle([x0, y0 + 2, x0 + cw - 1, y0 + ch - 2], fill=(139, 148, 158))
    return img


def main():
    p = argparse.ArgumentParser(description="Render an asciinema v2 cast to an animated GIF.")
    p.add_argument("cast")
    p.add_argument("out")
    p.add_argument("--title", default="")
    p.add_argument("--cols", type=int, default=None)
    p.add_argument("--rows", type=int, default=None)
    p.add_argument("--font-size", type=int, default=16)
    p.add_argument("--fps", type=int, default=15)
    p.add_argument("--hold-end", type=float, default=3.0)
    p.add_argument("--speed", type=float, default=1.0)
    p.add_argument("--no-badge", action="store_true",
                   help="omit the speed badge; the README caption must then state the speed-up")
    p.add_argument("--start", type=float, default=0.0, help="skip the first N seconds of the cast")
    p.add_argument("--end", type=float, default=None, help="stop at N seconds of the cast")
    a = p.parse_args()

    with open(a.cast, encoding="utf-8") as f:
        header = json.loads(f.readline())
        events = [json.loads(line) for line in f if line.strip()]
    if a.end is not None:
        events = [e for e in events if e[0] <= a.end]
    cols = a.cols or header["width"]
    rows = a.rows or header["height"]
    font = load_font(a.font_size)
    cw = round(font.getlength("M"))
    chh = round(a.font_size * 1.35)

    badge = "" if a.speed == 1 or a.no_badge else f"{a.speed:g}× speed"
    screen = Screen(cols, rows)
    step = 1.0 / a.fps
    frames, durations = [], []
    last_snap = None
    idx = 0
    end = (events[-1][0] if events else 0) / a.speed
    t = a.start / a.speed
    while idx < len(events) and events[idx][0] / a.speed <= t:
        if events[idx][1] == "o":
            screen.feed(events[idx][2])
        idx += 1
    while t <= end + step:
        while idx < len(events) and events[idx][0] / a.speed <= t:
            if events[idx][1] == "o":
                screen.feed(events[idx][2])
            idx += 1
        snap = screen.snapshot()
        if snap != last_snap:
            frames.append(render(snap, cols, rows, font, cw, chh, a.title, True, badge))
            durations.append(step)
            last_snap = snap
        else:
            durations[-1] += step
        t += step
    if durations:
        durations[-1] += a.hold_end

    palette_src = frames[-1].quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    pal = [fr.quantize(palette=palette_src, dither=Image.Dither.NONE) for fr in frames]
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    pal[0].save(a.out, save_all=True, append_images=pal[1:], loop=0,
                duration=[max(20, int(d * 1000)) for d in durations], optimize=True, disposal=1)
    size = os.path.getsize(a.out)
    print(json.dumps({"frames": len(frames), "seconds": round(sum(durations), 1),
                      "size_mb": round(size / 1e6, 2), "px": frames[0].size}))


if __name__ == "__main__":
    main()
