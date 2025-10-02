import io

from PIL import Image


def bbox_corners(poly):
    xs, ys = zip(*poly)
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    return [(xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax)]


def get_image_size(file_content: bytes):
    with Image.open(io.BytesIO(file_content)) as img:
        return img.size
