import os

import cv2
import numpy as np
from PIL import ImageDraw, Image, ImageFilter, ImageOps


def crop_words_from_line(img, idx):
    img_orig = img.copy()

    img = img.convert("L")
    img_size = img.size
    img = img.crop((0, int(img.size[1] * 0.1), img.size[0], img.size[1] - int(img.size[1] * 0.1)))

    img = ImageOps.autocontrast(img.filter(ImageFilter.MedianFilter(size=3)))

    hist = img.histogram()[:256]
    total = sum(hist)
    sumB = 0
    wB = 0
    maximum = 0.0
    sum1 = sum(i * h for i, h in enumerate(hist))
    threshold = 0
    for i in range(256):
        wB += hist[i]
        if wB == 0:
            continue
        wF = total - wB
        if wF == 0:
            break
        sumB += i * hist[i]
        mB = sumB / wB
        mF = (sum1 - sumB) / wF
        between = wB * wF * (mB - mF) ** 2
        if between >= maximum:
            threshold = i
            maximum = between

    bin_img = img.point(lambda p: 255 if p > threshold else 0)

    bin_np = np.array(bin_img)
    if bin_np.mean() < 128:
        bin_np = 255 - bin_np
        bin_img = Image.fromarray(bin_np)

    bin_img_thick = bin_img.filter(ImageFilter.MaxFilter(size=3))

    bin_img_thick.save('tmp.png')

    bw = np.array(bin_img_thick) == 0  # black=True
    col_sum = bw.sum(axis=0).astype(np.float32)

    start = 0
    zero_counter = 0
    zero_start = 0
    word_boxes = []
    for x, val in enumerate(col_sum):
        if val == 0:
            zero_counter += 1
            if zero_counter == 1:
                zero_start = x
        else:
            if zero_counter > 15:
                if abs(zero_start - start) > 10 and max(0, start - 5) < min(img_size[0], zero_start + 5):
                    word_boxes.append((max(0, start - 5), 0, min(img_size[0], zero_start + 5), img_size[1]))
                start = x
            zero_counter = 0
    if abs(start - zero_start) > 10 and max(0, start - 5) < min(img_size[0], zero_start + 5):
        word_boxes.append((max(0, start - 5), 0, min(img_size[0], zero_start + 5), img_size[1]))

    img = img_orig

    vis = img.convert("RGB")
    draw = ImageDraw.Draw(vis)
    for (x0, y0, x1, y1) in word_boxes:
        draw.rectangle([x0, y0, x1, y1], outline=(255, 0, 0), width=2)

    out_vis_path = f"segmented_lines/line_{idx}.png"
    vis.save(out_vis_path)

    out_dir = "words/"
    words = []
    for idx, (x0, y0, x1, y1) in enumerate(word_boxes):
        crop = img.crop((x0, y0, x1, y1))

        pth = os.path.join(out_dir, f"word_{idx + 1}.png")
        crop.save(pth)

        img_crop = cv2.imread(pth, cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(img_crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)

        bin_inv = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV,
            31, 15
        )
        mask = (bin_inv > 0).astype(np.uint8)

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        min_area, min_w, min_h = 40, 3, 3
        clean = np.zeros_like(mask)
        for i in range(1, num_labels):
            x, y, w, h, area = stats[i]
            if area >= min_area and w >= min_w and h >= min_h:
                clean[labels == i] = 1

        if clean.sum() == 0:
            clean = mask.copy()

        kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
        closed = cv2.morphologyEx(clean, cv2.MORPH_CLOSE, kernel_h, iterations=1)

        kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 3))
        closed = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel_v, iterations=1)

        num_labels2, labels2, stats2, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)

        areas = stats2[1:, cv2.CC_STAT_AREA]
        idx = 1 + np.argmax(areas)
        x, y, w, h, area = stats2[idx]

        pad = 1
        y0 = max(0, y - pad)
        y1 = min(img_crop.shape[0] - 1, y + h - 1 + pad)

        cropped = img_crop[y0:y1 + 1, :]
        cv2.imwrite(pth, cropped)

        words.append(crop)

    return words, word_boxes


if __name__ == "__main__":
    crop_words_from_line("cropped_lines/line")
