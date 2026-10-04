from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
import math

OUT = Path(__file__).parent
S = 4


def color(value, alpha=255):
    v = value.lstrip('#')
    return tuple(int(v[i:i+2], 16) for i in (0, 2, 4)) + (alpha,)


def sparkle(draw, cx, cy, outer, inner, fill):
    points = []
    for n in range(8):
        angle = math.pi * n/4 - math.pi/2
        r = outer if n % 2 == 0 else inner
        points.append((cx + math.cos(angle)*r, cy + math.sin(angle)*r))
    draw.polygon(points, fill=fill)


def crop_icon(im):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((8*S, 8*S, 248*S, 248*S), radius=61*S, fill=255)
    im.putalpha(ImageChops.multiply(im.getchannel('A'), mask))
    return im.resize((256, 256), Image.Resampling.LANCZOS)


def a_clean():
    k = S
    im = Image.new('RGBA', (256*k, 256*k))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((8*k, 8*k, 248*k, 248*k), radius=61*k, fill='#103B50')
    d.ellipse((116*k, 118*k, 276*k, 278*k), fill=color('#279B9B', 62))
    d.rounded_rectangle((59*k, 54*k, 119*k, 193*k), radius=18*k, fill='#F6FCF9')
    d.rounded_rectangle((59*k, 146*k, 193*k, 193*k), radius=17*k, fill='#F6FCF9')
    d.polygon([(103*k, 54*k), (146*k, 54*k), (103*k, 96*k)], fill='#8DE0D1')
    d.line([(121*k, 95*k), (121*k, 143*k)], fill='#20A99D', width=7*k)
    sparkle(d, 188*k, 67*k, 20*k, 7*k, '#FFD27D')
    return crop_icon(im)


def card(fill, line, bounds, angle):
    k = S
    layer = Image.new('RGBA', (256*k, 256*k))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = [n*k for n in bounds]
    d.rounded_rectangle((x0, y0, x1, y1), radius=20*k, fill=fill)
    d.rounded_rectangle((x0+14*k, y0+24*k, x0+55*k, y0+31*k), radius=3*k, fill=line)
    d.rounded_rectangle((x0+14*k, y0+40*k, x0+42*k, y0+47*k), radius=3*k, fill=line)
    return layer.rotate(angle, Image.Resampling.BICUBIC, center=(128*k, 128*k))


def b_clean():
    k = S
    im = Image.new('RGBA', (256*k, 256*k))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((8*k, 8*k, 248*k, 248*k), radius=61*k, fill='#073F52')
    d.ellipse((-58*k, -75*k, 158*k, 140*k), fill=color('#48ADB0', 70))
    im.alpha_composite(card('#E1F8F4', '#188B94', (46, 67, 150, 177), 8))
    im.alpha_composite(card('#FFD17E', '#AF753E', (106, 78, 208, 187), -8))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((92*k, 112*k, 167*k, 146*k), radius=17*k, fill='#0D5362')
    d.line([(106*k, 129*k), (150*k, 129*k)], fill='#FFFFFF', width=6*k)
    d.polygon([(148*k, 118*k), (160*k, 129*k), (148*k, 140*k)], fill='#FFFFFF')
    sparkle(d, 192*k, 58*k, 15*k, 5*k, '#FFE2A2')
    return crop_icon(im)


icons = [
    Image.open(OUT/'lexforge-icon-A.png').convert('RGBA'),
    a_clean(),
    Image.open(OUT/'lexforge-icon-B.png').convert('RGBA'),
    b_clean(),
]
icons[1].save(OUT/'lexforge-icon-A-clean.png')
icons[3].save(OUT/'lexforge-icon-B-clean.png')

regular = Path('C:/Windows/Fonts/segoeui.ttf')
semibold = Path('C:/Windows/Fonts/seguisb.ttf')
if not semibold.exists():
    semibold = regular


def font(size, bold=False):
    return ImageFont.truetype(str(semibold if bold else regular), size)


W, H = 1720, 960
sheet = Image.new('RGB', (W, H), '#F0F7F8')
d = ImageDraw.Draw(sheet)
d.text((65, 36), 'LEXFORGE  /  A & B', font=font(19, True), fill='#087B8C')
d.text((65, 71), 'Giữ ý tưởng đầu tiên, chỉ gọt bớt chi tiết', font=font(40, True), fill='#15394C')
d.text((67, 129), 'Bên trái mỗi cặp là mẫu bạn đã thích; bên phải là một chỉnh sửa rất nhẹ.', font=font(21), fill='#587885')

labels = ['A  ·  Bản đầu', 'A  ·  Nét gọn', 'B  ·  Bản đầu', 'B  ·  Nét gọn']
notes = ['Chữ L và nền cong', 'Giữ chữ L, bớt nền cong', 'Hai thẻ ngôn ngữ', 'Giữ hai thẻ, tăng độ rõ']
for i, icon in enumerate(icons):
    x = 58 + (i % 2)*420 + (i//2)*850
    y = 205
    d.rounded_rectangle((x, y, x+394, y+665), radius=25, fill='#FFFFFF', outline='#CFE5E9', width=2)
    d.text((x+26, y+28), labels[i], font=font(25, True), fill='#123A4E')
    d.text((x+26, y+68), notes[i], font=font(16), fill='#62808A')
    d.rounded_rectangle((x+25, y+112, x+369, y+420), radius=21, fill='#E7F2F3')
    large = icon.resize((256, 256), Image.Resampling.LANCZOS)
    sheet.paste(large, (x+69, y+137), large)
    d.text((x+26, y+450), 'KÍCH THƯỚC THỰC TẾ', font=font(15, True), fill='#21778A')
    for size, dx, dy in [(64, 28, 494), (32, 120, 519), (16, 179, 536)]:
        small = icon.resize((size, size), Image.Resampling.LANCZOS)
        sheet.paste(small, (x+dx, y+dy), small)
    d.rounded_rectangle((x+26, y+589, x+368, y+635), radius=12, fill='#14384C')
    task_icon = icon.resize((29, 29), Image.Resampling.LANCZOS)
    sheet.paste(task_icon, (x+38, y+597), task_icon)
    d.text((x+80, y+597), 'Lexforge', font=font(19, True), fill='#FFFFFF')

sheet.save(OUT/'lexforge-icon-A-B-compare.png')
