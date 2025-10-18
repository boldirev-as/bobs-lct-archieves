import os

from PIL import ImageDraw, Image


def crop_line(img, poly, idx):
    x_coords = [p[0] for p in poly]
    y_coords = [p[1] for p in poly]
    x0, y0, x1, y1 = min(x_coords), min(y_coords), max(x_coords), max(y_coords)

    cropped = img.crop((x0, y0, x1, y1))

    shifted_poly = [(x - x0, y - y0) for (x, y) in poly]

    mask = Image.new("L", cropped.size, 0)
    ImageDraw.Draw(mask).polygon(shifted_poly, outline=255, fill=255)

    white_bg = Image.new("RGB", cropped.size, (255, 255, 255))

    white_bg.paste(cropped, mask=mask)

    os.makedirs("cropped_lines", exist_ok=True)
    save_path = os.path.join("cropped_lines", f"line_{idx:04d}.jpg")
    white_bg.save(save_path)

    return white_bg


def bbox_corners(poly):
    xs, ys = zip(*poly)
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    return [(xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax)]
