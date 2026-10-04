from PIL import Image, ImageDraw, ImageFont, ImageChops
from pathlib import Path
import math

OUT = Path(__file__).parent
OUT.mkdir(parents=True, exist_ok=True)
S = 4


def rgba(hex_color, alpha=255):
    value = hex_color.lstrip('#')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def star(draw, cx, cy, outer, inner, fill):
    points = []
    for i in range(8):
        a = math.pi * i / 4 - math.pi / 2
        r = outer if i % 2 == 0 else inner
        points.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    draw.polygon(points, fill=fill)


def finish_icon(im):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((8*S, 8*S, 248*S, 248*S), radius=61*S, fill=255)
    im.putalpha(ImageChops.multiply(im.getchannel('A'), mask))
    return im.resize((256, 256), Image.Resampling.LANCZOS)


def icon_a():
    im = Image.new('RGBA', (256 * S, 256 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = S
    d.rounded_rectangle((8*k, 8*k, 248*k, 248*k), radius=61*k, fill='#103B50')
    d.ellipse((105*k, 108*k, 304*k, 307*k), fill=rgba('#147C80', 90))
    d.rounded_rectangle((58*k, 53*k, 118*k, 193*k), radius=19*k, fill='#F6FCF9')
    d.rounded_rectangle((58*k, 145*k, 194*k, 193*k), radius=18*k, fill='#F6FCF9')
    d.polygon([(103*k, 53*k), (147*k, 53*k), (103*k, 99*k)], fill='#78DACA')
    d.line([(120*k, 92*k), (120*k, 143*k)], fill='#1DA39E', width=8*k)
    star(d, 189*k, 66*k, 22*k, 8*k, '#FFCB73')
    return finish_icon(im)


def icon_b():
    im = Image.new('RGBA', (256 * S, 256 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = S
    d.rounded_rectangle((8*k, 8*k, 248*k, 248*k), radius=61*k, fill='#073F52')
    d.ellipse((-65*k, -90*k, 160*k, 135*k), fill=rgba('#2095A0', 80))
    left = Image.new('RGBA', im.size, (0, 0, 0, 0))
    l = ImageDraw.Draw(left)
    l.rounded_rectangle((45*k, 69*k, 150*k, 178*k), radius=21*k, fill='#D8F4F1')
    l.rounded_rectangle((57*k, 87*k, 100*k, 94*k), radius=3*k, fill='#198694')
    l.rounded_rectangle((57*k, 102*k, 88*k, 109*k), radius=3*k, fill='#63BEB9')
    left = left.rotate(10, Image.Resampling.BICUBIC, center=(97*k, 124*k))
    im.alpha_composite(left)
    right = Image.new('RGBA', im.size, (0, 0, 0, 0))
    r = ImageDraw.Draw(right)
    r.rounded_rectangle((105*k, 78*k, 207*k, 189*k), radius=21*k, fill='#FFCE78')
    r.rounded_rectangle((119*k, 147*k, 172*k, 155*k), radius=3*k, fill='#9B6330')
    r.rounded_rectangle((119*k, 162*k, 158*k, 170*k), radius=3*k, fill='#B47E3F')
    right = right.rotate(-10, Image.Resampling.BICUBIC, center=(156*k, 133*k))
    im.alpha_composite(right)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((93*k, 112*k, 166*k, 144*k), radius=16*k, fill='#0D5362')
    d.line([(107*k, 128*k), (151*k, 128*k)], fill='#FFFFFF', width=6*k)
    d.polygon([(148*k, 117*k), (161*k, 128*k), (148*k, 139*k)], fill='#FFFFFF')
    star(d, 193*k, 55*k, 15*k, 5*k, '#FFE3A4')
    return finish_icon(im)


def icon_c():
    im = Image.new('RGBA', (256 * S, 256 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = S
    d.rounded_rectangle((8*k, 8*k, 248*k, 248*k), radius=61*k, fill='#112C47')
    d.ellipse((46*k, 46*k, 210*k, 210*k), outline='#55C6BE', width=13*k)
    d.arc((37*k, 37*k, 219*k, 219*k), 212, 307, fill='#FFD079', width=15*k)
    d.ellipse((65*k, 65*k, 191*k, 191*k), fill='#176C79')
    d.rounded_rectangle((88*k, 107*k, 168*k, 153*k), radius=12*k, fill='#F1FBF7')
    d.line([(128*k, 110*k), (128*k, 151*k)], fill='#38ADA9', width=6*k)
    d.polygon([(88*k, 113*k), (128*k, 119*k), (128*k, 146*k), (88*k, 140*k)], fill='#E4F8F3')
    d.polygon([(128*k, 119*k), (168*k, 113*k), (168*k, 140*k), (128*k, 146*k)], fill='#FAFFFB')
    star(d, 198*k, 59*k, 18*k, 6*k, '#FFD079')
    return finish_icon(im)


icons = [icon_a(), icon_b(), icon_c()]
for label, icon in zip('ABC', icons):
    icon.save(OUT / f'lexforge-icon-{label}.png')

font_path = Path('C:/Windows/Fonts/segoeui.ttf')
bold_path = Path('C:/Windows/Fonts/seguisb.ttf')
if not bold_path.exists():
    bold_path = font_path


def font(size, bold=False):
    return ImageFont.truetype(str(bold_path if bold else font_path), size)


W, H = 1740, 920
sheet = Image.new('RGB', (W, H), '#F0F6F7')
d = ImageDraw.Draw(sheet)
d.text((67, 37), 'LEXFORGE  /  ICON EXPLORATION', font=font(19, True), fill='#087A8B')
d.text((67, 71), 'Ba hướng nhận diện mới', font=font(42, True), fill='#123A4F')
d.text((69, 132), 'Xem cùng một thiết kế ở kích thước icon ứng dụng, thanh tác vụ và bong bóng nổi.', font=font(20), fill='#587786')

names = ['A  ·  Chữ L gấp trang', 'B  ·  Hai thẻ ngôn ngữ', 'C  ·  Quỹ đạo ghi nhớ']
descriptions = [
    ['Gọn, sắc nét, dễ nhận ra', 'ngay cả khi thu nhỏ.'],
    ['Cảm giác học tương tác,', 'trẻ trung và thân thiện.'],
    ['Gợi hành trình tiến bộ,', 'hợp với trợ lý nổi.'],
]

for index, icon in enumerate(icons):
    x = 56 + index * 560
    y = 195
    d.rounded_rectangle((x, y, x + 530, y + 665), radius=26, fill='#FFFFFF', outline='#D5E7EA', width=2)
    d.rounded_rectangle((x + 24, y + 22, x + 71, y + 59), radius=11, fill='#DDF4F2')
    d.text((x + 39, y + 29), 'ABC'[index], font=font(17, True), fill='#0B7383')
    d.text((x + 27, y + 82), names[index], font=font(26, True), fill='#10394D')
    for line_no, line in enumerate(descriptions[index]):
        d.text((x + 27, y + 126 + line_no * 26), line, font=font(18), fill='#617B88')

    d.rounded_rectangle((x + 29, y + 194, x + 501, y + 438), radius=22, fill='#EAF5F5')
    sheet.paste(icon, (x + 63, y + 188), icon)
    d.text((x + 348, y + 240), 'ICON APP', font=font(15, True), fill='#447383')
    d.text((x + 348, y + 278), '256 px', font=font(28, True), fill='#143D51')
    d.text((x + 348, y + 320), 'Nền sáng', font=font(17), fill='#617E89')

    d.text((x + 29, y + 469), 'KHI THU NHỎ', font=font(15, True), fill='#447383')
    for size, dx, dy in [(64, 30, 506), (32, 123, 528), (16, 186, 543)]:
        small = icon.resize((size, size), Image.Resampling.LANCZOS)
        sheet.paste(small, (x + dx, y + dy), small)
    d.text((x + 300, y + 510), 'Bong bóng nổi', font=font(15), fill='#617E89')
    bubble = icon.resize((68, 68), Image.Resampling.LANCZOS)
    sheet.paste(bubble, (x + 315, y + 537), bubble)
    d.ellipse((x + 369, y + 590, x + 383, y + 604), fill='#0AA793', outline='#FFFFFF', width=3)

    d.rounded_rectangle((x + 28, y + 616, x + 502, y + 646), radius=10, fill='#112D40')
    d.text((x + 43, y + 620), 'Tông màu: xanh đậm  ·  ngọc  ·  vàng ấm', font=font(15), fill='#D9EFF0')

sheet.save(OUT / 'lexforge-icon-preview.png', quality=95)
