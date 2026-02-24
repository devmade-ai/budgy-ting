"""
Generate PWA icon PNGs — rounded square with white coin and green 'B'.

Pure Python, no external deps. Uses zlib + struct to write valid PNGs.
"""

import struct
import zlib
import math
import os

# Brand colour: emerald #10b981
BG_R, BG_G, BG_B = 0x10, 0xB9, 0x81


def make_png(width, height, pixels):
    """Create a PNG file from raw RGBA pixel data."""
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack('>I', len(data)) + c + crc

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)

    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw += struct.pack('BBBB', r, g, b, a)

    compressed = zlib.compress(raw, 9)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')


def aa_circle(x, y, cx, cy, r):
    """Return alpha 0-1 for anti-aliased circle edge."""
    dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    if dist < r - 0.7:
        return 1.0
    elif dist > r + 0.7:
        return 0.0
    else:
        return max(0, min(1, (r + 0.7 - dist) / 1.4))


def aa_rounded_rect(x, y, size, corner_r):
    """Return alpha 0-1 for anti-aliased rounded rectangle."""
    center = size / 2
    corners = [
        (corner_r, corner_r),
        (size - corner_r, corner_r),
        (corner_r, size - corner_r),
        (size - corner_r, size - corner_r),
    ]
    for cx, cy in corners:
        in_cx = (x < corner_r and cx < center) or (x >= size - corner_r and cx > center)
        in_cy = (y < corner_r and cy < center) or (y >= size - corner_r and cy > center)
        if in_cx and in_cy:
            dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            if dist > corner_r + 0.7:
                return 0.0
            elif dist > corner_r - 0.7:
                return max(0, min(1, (corner_r + 0.7 - dist) / 1.4))
    return 1.0


def is_in_b(nx, ny):
    """Check if normalized (0-1) coordinate is inside a 'B' glyph."""
    # Vertical stem
    stem = 0.32 <= nx <= 0.44 and 0.20 <= ny <= 0.80

    # Top serif/bar
    top_bar = 0.44 <= nx <= 0.58 and 0.20 <= ny <= 0.30

    # Middle bar
    mid_bar = 0.44 <= nx <= 0.60 and 0.46 <= ny <= 0.54

    # Bottom bar
    bot_bar = 0.44 <= nx <= 0.58 and 0.70 <= ny <= 0.80

    # Top right bump (upper bowl)
    tcx, tcy, trx, try_ = 0.55, 0.375, 0.14, 0.135
    top_bump = (((nx - tcx) / trx) ** 2 + ((ny - tcy) / try_) ** 2 <= 1.0) and nx >= 0.44

    # Bottom right bump (lower bowl, slightly wider per classic B)
    bcx, bcy, brx, bry = 0.57, 0.625, 0.15, 0.135
    bot_bump = (((nx - bcx) / brx) ** 2 + ((ny - bcy) / bry) ** 2 <= 1.0) and nx >= 0.44

    filled = stem or top_bar or mid_bar or bot_bar or top_bump or bot_bump

    if not filled:
        return False

    # Cut out the two bowl holes
    h1cx, h1cy, h1rx, h1ry = 0.49, 0.375, 0.065, 0.065
    if ((nx - h1cx) / h1rx) ** 2 + ((ny - h1cy) / h1ry) ** 2 <= 1.0:
        return False

    h2cx, h2cy, h2rx, h2ry = 0.51, 0.625, 0.070, 0.065
    if ((nx - h2cx) / h2rx) ** 2 + ((ny - h2cy) / h2ry) ** 2 <= 1.0:
        return False

    return True


def draw_icon(size):
    """Draw the icon at given size."""
    pixels = []
    center = size / 2
    corner_r = size * 0.18
    coin_r = size * 0.35

    for y in range(size):
        for x in range(size):
            # Rounded rect mask
            ra = aa_rounded_rect(x, y, size, corner_r)
            if ra <= 0:
                pixels.append((0, 0, 0, 0))
                continue

            alpha = int(ra * 255)

            # Coin circle
            ca = aa_circle(x, y, center, center, coin_r)

            if ca >= 1.0:
                # Inside coin — check B letter
                nx = 0.5 + (x - center) / (coin_r * 2)
                ny = 0.5 + (y - center) / (coin_r * 2)
                if is_in_b(nx, ny):
                    pixels.append((BG_R, BG_G, BG_B, alpha))
                else:
                    pixels.append((255, 255, 255, alpha))
            elif ca > 0:
                # Anti-alias coin edge
                r = int(BG_R * (1 - ca) + 255 * ca)
                g = int(BG_G * (1 - ca) + 255 * ca)
                b = int(BG_B * (1 - ca) + 255 * ca)
                pixels.append((r, g, b, alpha))
            else:
                # Background
                pixels.append((BG_R, BG_G, BG_B, alpha))

    return pixels


def main():
    out_dir = '/home/user/budgy-ting/public'
    os.makedirs(out_dir, exist_ok=True)

    sizes = {
        'pwa-512x512.png': 512,
        'pwa-192x192.png': 192,
        'apple-touch-icon.png': 180,
    }

    for filename, size in sizes.items():
        print(f'Generating {filename} ({size}x{size})...')
        pixels = draw_icon(size)
        png_data = make_png(size, size, pixels)
        path = os.path.join(out_dir, filename)
        with open(path, 'wb') as f:
            f.write(png_data)
        print(f'  Written: {len(png_data)} bytes')

    # Favicon 32x32
    print('Generating favicon.ico (32x32)...')
    pixels = draw_icon(32)
    png_data = make_png(32, 32, pixels)
    ico_header = struct.pack('<HHH', 0, 1, 1)
    ico_entry = struct.pack('<BBBBHHII', 32, 32, 0, 0, 1, 32, len(png_data), 22)
    with open(os.path.join(out_dir, 'favicon.ico'), 'wb') as f:
        f.write(ico_header + ico_entry + png_data)
    print(f'  Written: {6 + 16 + len(png_data)} bytes')

    # SVG reference
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="92" fill="#{BG_R:02x}{BG_G:02x}{BG_B:02x}"/>
  <circle cx="256" cy="256" r="180" fill="white"/>
  <text x="256" y="270" font-family="Georgia,serif" font-weight="bold"
    font-size="240" fill="#{BG_R:02x}{BG_G:02x}{BG_B:02x}" text-anchor="middle"
    dominant-baseline="central">B</text>
</svg>'''
    with open(os.path.join(out_dir, 'icon.svg'), 'w') as f:
        f.write(svg)
    print('Written icon.svg')
    print('\nDone!')


if __name__ == '__main__':
    main()
