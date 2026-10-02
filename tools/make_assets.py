import os
import base64
from PIL import Image

logo_path = 'public/cbt-logo.png'
if not os.path.exists(logo_path):
    raise FileNotFoundError(f"Missing {logo_path}")

logo = Image.open(logo_path)

# 1. WebP version
logo.save('public/cbt-logo.webp', 'WEBP', lossless=True)

# 2. App touch icon (180x180) and badge (512x512)
def make_badge(size, padding=0.08):
    pad = int(size * padding)
    inner_size = size - 2 * pad
    resized = logo.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    badge = Image.new('RGBA', (size, size), (7, 8, 11, 255))
    badge.paste(resized, (pad, pad), resized)
    return badge

touch_icon = make_badge(180)
touch_icon.save('public/apple-touch-icon.png', 'PNG')

pwa_icon_192 = make_badge(192)
pwa_icon_192.save('public/pwa-192x192.png', 'PNG')

pwa_icon_512 = make_badge(512)
pwa_icon_512.save('public/pwa-512x512.png', 'PNG')

# 3. Favicon 32x32 and 16x16
fav_32 = logo.resize((32, 32), Image.Resampling.LANCZOS)
fav_32.save('public/favicon-32x32.png', 'PNG')

fav_16 = logo.resize((16, 16), Image.Resampling.LANCZOS)
fav_16.save('public/favicon-16x16.png', 'PNG')

# Multi-resolution ICO
fav_32.save('public/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])

# 4. SVG Favicon wrapping the high-res emblem
with open(logo_path, 'rb') as f:
    b64_data = base64.b64encode(f.read()).decode('utf-8')

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 536 536" width="100%" height="100%">
  <image href="data:image/png;base64,{b64_data}" width="536" height="536" />
</svg>'''

with open('public/favicon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

# Clean up test composites
for t in ['public/test-on-white.png', 'public/test-on-dark.png', 'public/test-metallic-only.png', 'public/test-metallic-white.png', 'public/test-metallic-dark.png']:
    if os.path.exists(t):
        os.remove(t)

print("SUCCESS: All official CBT.AI logo assets generated.")
