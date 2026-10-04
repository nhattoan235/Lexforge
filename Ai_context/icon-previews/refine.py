from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter
from pathlib import Path
import math

OUT = Path(__file__).parent
S = 4
SIZE = 256 * S


def color(value, alpha=255):
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def sparkle(draw, x, y, outer, inner, fill):
    points = []
    for n in range(8):
        angle = n * math.pi / 4 - math.pi / 2
        radius = outer if n % 2 == 0 else inner
        points.append((x + math.cos(angle) * radius, y + math.sin(angle) * radius))
    draw.polygon(points, fill=fill)


def base(top, bottom):
    strip = Image.new('RGB', (1, SIZE))
    pixels = strip.load()
    t, b = color(top), color(bottom)
    for y in range(SIZE):
        q = y / (SIZE - 1)
        pixels[0, y] = tuple(round(t[i] * (1-q) + b[i] * q) for i in range(3))
    im = strip.resize((SIZE, SIZE)).convert('RGBA')
    mask = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((8*S, 8*S, 248*S, 248*S), radius=60*S, fill=255)
    im.putalpha(mask)
    return im, mask


def finish(im, mask):
    im.putalpha(ImageChops.multiply(im.getchannel('A'), mask))
    return im.resize((256, 256), Image.Resampling.LANCZOS)


def folded_l():
    im, mask = base('#0C7080', '#102B47')
    k = S
    glow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((-47*k, -84*k, 226*k, 188*k), fill=color('#76F0CF', 68))
    g.ellipse((99*k, 122*k, 331*k, 354*k), fill=color('#0BD8BA', 42))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(29*k)))
    d = ImageDraw.Draw(im)
    d.arc((37*k, 37*k, 217*k, 217*k), 204, 280, fill='#FFD076', width=7*k)
    d.arc((37*k, 37*k, 217*k, 217*k), 33, 80, fill='#57CFC7', width=6*k)

    # One folded ribbon forms a clear L silhouette even at 16 px.
    d.rounded_rectangle((60*k, 58*k, 118*k, 190*k), radius=16*k, fill='#7CE1D0')
    d.rounded_rectangle((73*k, 53*k, 130*k, 180*k), radius=15*k, fill='#F7FCFA')
    d.polygon([(112*k, 53*k), (144*k, 53*k), (112*k, 86*k)], fill='#72D9CC')
    d.rounded_rectangle((73*k, 145*k, 194*k, 190*k), radius=16*k, fill='#F7FCFA')
    d.polygon([(170*k, 145*k), (194*k, 145*k), (194*k, 170*k)], fill='#B7F1DC')
    d.line([(62*k, 92*k), (62*k, 170*k)], fill='#34BBAE', width=5*k)
    sparkle(d, 183*k, 75*k, 21*k, 7*k, '#FFD174')
    sparkle(d, 203*k, 105*k, 7*k, 2*k, '#E9FFF5')
    return finish(im, mask)


def card_layer(fill, outline, angle, bounds, lines):
    layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    k = S
    x0, y0, x1, y1 = bounds
    d.rounded_rectangle((x0*k, y0*k, x1*k, y1*k), radius=21*k, fill=fill, outline=outline, width=3*k)
    d.polygon([(x1*k-31*k, y0*k), (x1*k, y0*k+30*k), (x1*k-31*k, y0*k+30*k)], fill=color('#FFFFFF', 95))
    for x, y, width, tone in lines:
        d.rounded_rectangle((x*k, y*k, (x+width)*k, (y+7)*k), radius=3*k, fill=tone)
    return layer.rotate(angle, Image.Resampling.BICUBIC, center=(128*k, 128*k))


def two_cards():
    im, mask = base('#156780', '#112846')
    k = S
    d = ImageDraw.Draw(im)
    d.ellipse((35*k, 39*k, 221*k, 225*k), outline=color('#9AE5DB', 87), width=3*k)
    d.arc((27*k, 30*k, 229*k, 232*k), 275, 350, fill='#FFCB73', width=7*k)
    left = card_layer('#E9FFFA', '#9DE4DC', 12, (37, 64, 142, 180),
                      [(51, 102, 52, '#0B8692'), (51, 120, 35, '#74CFC4')])
    im.alpha_composite(left)
    right = card_layer('#FFD17B', '#FFE9B7', -12, (113, 67, 218, 183),
                       [(128, 124, 50, '#9E6733'), (128, 141, 34, '#C08B4C')])
    im.alpha_composite(right)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((84*k, 111*k, 172*k, 148*k), radius=18*k, fill='#0C4B5D', outline='#79DCD2', width=2*k)
    d.line([(102*k, 124*k), (151*k, 124*k)], fill='#FFFFFF', width=5*k)
    d.polygon([(144*k, 116*k), (158*k, 124*k), (144*k, 132*k)], fill='#FFFFFF')
    d.line([(153*k, 138*k), (105*k, 138*k)], fill='#FFC876', width=4*k)
    d.polygon([(112*k, 131*k), (98*k, 138*k), (112*k, 145*k)], fill='#FFC876')
    sparkle(d, 192*k, 56*k, 17*k, 5*k, '#FFE3A2')
    return finish(im, mask)


icons = [folded_l(), two_cards()]
for name, icon in zip(('A-plus', 'B-plus'), icons):
    icon.save(OUT / f'lexforge-icon-{name}.png')

font_file = Path('C:/Windows/Fonts/segoeui.ttf')
bold_file = Path('C:/Windows/Fonts/seguisb.ttf')
if not bold_file.exists():
    bold_file = font_file


def font(size, bold=False):
    return ImageFont.truetype(str(bold_file if bold else font_file), size)


W, H = 1600, 920
sheet = Image.new('RGB', (W, H), '#EFF6F7')
d = ImageDraw.Draw(sheet)
d.text((65, 37), 'LEXFORGE  /  ICON REFINEMENT', font=font(19, True), fill='#087A8B')
d.text((65, 73), 'A và B, cá tính hơn', font=font(43, True), fill='#12384C')
d.text((67, 132), 'Hai hướng mới có nét riêng rõ hơn, vẫn nhận ra được khi thu nhỏ.', font=font(21), fill='#5D7A87')

names = ['A+   Dải trang tạo chữ L', 'B+   Hai ngôn ngữ kết nối']
descs = [
    ['Chữ L dày, nếp gấp ngọc và tia sáng vàng.', 'Hướng này hợp làm biểu tượng chính.'],
    ['Hai thẻ nghiêng và mũi tên hai chiều.', 'Hướng này vui hơn cho bong bóng trợ lý.'],
]
for i, icon in enumerate(icons):
    x, y = 65 + i*755, 195
    d.rounded_rectangle((x, y, x+720, y+660), radius=29, fill='#FFFFFF', outline='#D1E6EA', width=2)
    d.text((x+31, y+27), names[i], font=font(29, True), fill='#103B50')
    for j, line in enumerate(descs[i]):
        d.text((x+32, y+76+j*27), line, font=font(18), fill='#637F89')
    d.rounded_rectangle((x+31, y+149, x+689, y+454), radius=22, fill='#E7F2F3')
    sheet.paste(icon, (x+72, y+175), icon)
    d.text((x+380, y+203), 'ICON ỨNG DỤNG', font=font(16, True), fill='#287386')
    d.text((x+380, y+244), '256 px', font=font(32, True), fill='#12394D')
    d.text((x+380, y+293), 'Nền sáng  ·  góc bo', font=font(19), fill='#5E7D88')
    d.text((x+32, y+489), 'HIỂN THỊ THỰC TẾ', font=font(16, True), fill='#287386')
    d.rounded_rectangle((x+31, y+522, x+396, y+619), radius=18, fill='#14384D')
    tiny = icon.resize((56, 56), Image.Resampling.LANCZOS)
    sheet.paste(tiny, (x+51, y+543), tiny)
    d.text((x+122, y+542), 'Lexforge', font=font(22, True), fill='#FFFFFF')
    d.text((x+122, y+572), 'Học tiếng Anh mỗi ngày', font=font(16), fill='#B9D8DE')
    bubble = icon.resize((82, 82), Image.Resampling.LANCZOS)
    sheet.paste(bubble, (x+518, y+530), bubble)
    d.ellipse((x+585, y+594, x+603, y+612), fill='#0EAA92', outline='#FFFFFF', width=3)
    d.text((x+487, y+619), 'Bong bóng nổi', font=font(16), fill='#637F89')

sheet.save(OUT / 'lexforge-icon-refined-preview.png')
