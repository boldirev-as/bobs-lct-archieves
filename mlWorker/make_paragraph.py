from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Optional
import math
import itertools

Point = Tuple[float, float]
Polygon = List[Point]  # ожидаем невырожденный многоугольник без самопересечений


def polygon_length_along_principal_axis(poly: Polygon) -> Tuple[float, Point, Point]:
    """
    Возвращает: (длина вдоль главной оси, центр масс, единичный вектор главной оси v)
    """
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)

    # ковариация по вершинам (упрощённо, без весов площади)
    sxx = sum((x - cx) ** 2 for x in xs) / len(xs)
    syy = sum((y - cy) ** 2 for y in ys) / len(ys)
    sxy = sum((x - cx) * (y - cy) for x, y in zip(xs, ys)) / len(xs)

    # собственный вектор для наибольшего собственного значения 2x2 матрицы ковариаций
    # lambda = (tr ± sqrt(tr^2 - 4 det)) / 2
    tr = sxx + syy
    det = sxx * syy - sxy * sxy
    disc = max(tr * tr - 4 * det, 0.0)
    lam_max = 0.5 * (tr + math.sqrt(disc))

    # (S - λI)v = 0  -> выбираем компоненту
    if abs(sxy) > 1e-12:
        vx, vy = lam_max - syy, sxy
    else:
        # оси почти выровнены
        if sxx >= syy:
            vx, vy = 1.0, 0.0
        else:
            vx, vy = 0.0, 1.0

    norm = math.hypot(vx, vy)
    vx, vy = vx / norm, vy / norm

    # проектируем вершины на ось v
    proj = [((x - cx) * vx + (y - cy) * vy) for x, y in poly]
    length = max(proj) - min(proj)

    return length, (cx, cy), (vx, vy)


def suth_hodgman_clip_halfplane(poly: Polygon, p0: Point, n: Point, keep_le: bool = True) -> Polygon:
    """
    Клиппинг многоугольника полуплоскостью: n·(p - p0) <= 0 (если keep_le=True)
    или >= 0 (если keep_le=False). Возвращает список вершин отсечённого многоугольника.
    """
    if not poly:
        return []

    def side(p: Point) -> float:
        return (p[0] - p0[0]) * n[0] + (p[1] - p0[1]) * n[1]

    out: Polygon = []
    for i in range(len(poly)):
        a = poly[i]
        b = poly[(i + 1) % len(poly)]
        sa = side(a)
        sb = side(b)

        ina = (sa <= 1e-12) if keep_le else (sa >= -1e-12)
        inb = (sb <= 1e-12) if keep_le else (sb >= -1e-12)

        if ina and inb:
            # оба внутри
            out.append(b)
        elif ina and not inb:
            # выходим — добавляем точку пересечения
            out.append(intersection_on_line(a, b, p0, n))
        elif not ina and inb:
            # входим — добавляем пересечение и b
            out.append(intersection_on_line(a, b, p0, n))
            out.append(b)
        else:
            # оба снаружи — ничего
            pass

    # удаляем возможные дубли концов
    out = dedup_collinear(out)
    return out


def intersection_on_line(a: Point, b: Point, p0: Point, n: Point) -> Point:
    """
    Пересечение отрезка AB с прямой n·(p - p0) = 0
    """
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    denom = n[0] * dx + n[1] * dy
    if abs(denom) < 1e-12:
        # отрезок параллелен прямой — возвращаем ближайшую к a точку на линии (как fallback)
        return a
    t = (n[0] * (p0[0] - ax) + n[1] * (p0[1] - ay)) / denom
    t = max(0.0, min(1.0, t))
    return (ax + t * dx, ay + t * dy)


def dedup_collinear(poly: Polygon, eps: float = 1e-10) -> Polygon:
    """
    Убирает подряд идущие одинаковые/коллинеарные точки.
    """
    if len(poly) <= 2:
        return poly[:]
    out = []
    for p in poly:
        if not out or (abs(p[0] - out[-1][0]) > eps or abs(p[1] - out[-1][1]) > eps):
            out.append(p)

    # удалим коллинеарные вершины
    def area2(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    changed = True
    while changed and len(out) >= 3:
        changed = False
        res = []
        for i in range(len(out)):
            a = out[i - 1]
            b = out[i]
            c = out[(i + 1) % len(out)]
            if abs(area2(a, b, c)) < eps and i != len(out) - 1:
                changed = True
                continue
            res.append(b)
        out = res
    return out


def split_polygon_by_center_gap(poly: Polygon, L: float, gap: float) -> Optional[Tuple[Polygon, Polygon]]:
    """
    Если длина полигона вдоль главной оси > L,
    вырезает центральную полосу шириной gap и возвращает два новых полигона.
    Если не превышает — возвращает None.
    """
    if len(poly) < 3:
        return None

    length, (cx, cy), (vx, vy) = polygon_length_along_principal_axis(poly)
    if length <= L:
        return None

    # главная ось v = (vx, vy); нормаль к линии разреза n — это сама v,
    # т.к. границы выреза — две линии, перпендикулярные оси v, то есть нормаль вдоль v.
    n = (vx, vy)

    # центральная позиция на оси = (cx, cy). Сдвигаем две линии на ± gap/2 вдоль оси v.
    p_left = (cx - 0.5 * gap * vx, cy - 0.5 * gap * vy)  # n·(p - p_left) = 0
    p_right = (cx + 0.5 * gap * vx, cy + 0.5 * gap * vy)

    # Левая часть: n·(p - p_left) <= 0
    left_poly = suth_hodgman_clip_halfplane(poly, p_left, n, keep_le=True)
    # Правая часть: n·(p - p_right) >= 0  -> keep_le=False
    right_poly = suth_hodgman_clip_halfplane(poly, p_right, n, keep_le=False)

    # если какая-то часть исчезла, вернём только существующие
    if left_poly and right_poly:
        return left_poly, right_poly
    elif left_poly:
        return left_poly, []
    elif right_poly:
        return [], right_poly
    else:
        return None


@dataclass
class Line:
    polygon: Polygon
    # производные фичи
    left: float
    right: float
    top: float
    bottom: float
    width: float
    height: float
    mid_y: float
    center_x: float


def _bbox(poly: Polygon) -> Tuple[float, float, float, float]:
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)


def _line_from_polygon(poly: Polygon) -> Line:
    l, t, r, b = _bbox(poly)
    return Line(
        polygon=poly,
        left=l, right=r, top=t, bottom=b,
        width=r - l, height=b - t,
        mid_y=(t + b) / 2.0,
        center_x=(l + r) / 2.0,
    )


def _median(xs: List[float]) -> float:
    s = sorted(xs)
    n = len(s)
    if n == 0: return 0.0
    if n % 2: return s[n // 2]
    return 0.5 * (s[n // 2 - 1] + s[n // 2])


def _horizontal_overlap(a: Line, b: Line) -> float:
    # доля перекрытия по горизонтали относительно меньшей ширины
    inter = max(0.0, min(a.right, b.right) - max(a.left, b.left))
    denom = max(1e-6, min(a.width, b.width))
    return inter / denom


def _build_columns(lines: List[Line], overlap_threshold: float) -> List[List[Line]]:
    """
    Граф по горизонтальному перекрытию. Компоненты связности — колонки.
    """
    n = len(lines)
    adj = [[] for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if _horizontal_overlap(lines[i], lines[j]) >= overlap_threshold:
                adj[i].append(j)
                adj[j].append(i)

    visited = [False] * n
    columns = []
    for i in range(n):
        if visited[i]: continue
        stack = [i]
        comp = []
        visited[i] = True
        while stack:
            u = stack.pop()
            comp.append(u)
            for v in adj[u]:
                if not visited[v]:
                    visited[v] = True
                    stack.append(v)
        columns.append([lines[k] for k in comp])
    # упорядочим колонки слева-направо, а внутри — сверху-вниз
    columns.sort(key=lambda col: _median([ln.left for ln in col]))
    for col in columns:
        col.sort(key=lambda ln: ln.top)
    return columns


def _is_centered(line: Line, page_left: float, page_right: float, tol: float) -> bool:
    page_center = 0.5 * (page_left + page_right)
    return abs(line.center_x - page_center) <= tol


def _group_into_paragraphs_in_column(col: List[Line],
                                     median_h: float,
                                     median_w: float,
                                     align_tol: float,
                                     indent_tol: float,
                                     gap_factor: float,
                                     page_left: float,
                                     page_right: float,
                                     max_lines: int = 5) -> List[List[Line]]:
    """
    Простая, но практичная логика:
      - новый абзац, если вертикальный зазор > gap_factor * median_h
      - или если заметный положительный отступ слева (первая строка абзаца)
      - или если предыдущая была "заголовком" (узкая и центрированная)
      - иначе — продолжаем текущий, если левые кромки согласованы (<= align_tol)
    """
    paras: List[List[Line]] = []
    if not col:
        return paras

    # предварительная оценка "заголовочности" по ширине и центрированию
    def likely_heading(ln: Line) -> bool:
        narrow = ln.width <= 0.6 * median_w
        centered = _is_centered(ln, page_left, page_right, tol=1.2 * median_w * 0.5)  # щадяще
        return narrow and centered

    current: List[Line] = [col[0]]
    last = col[0]
    last_was_heading = likely_heading(last)

    for ln in col[1:]:
        vgap = ln.top - last.bottom  # зазор между соседними строками
        left_shift = ln.left - current[0].left  # отступ относительно первой строки абзаца
        left_aligned = abs(ln.left - current[0].left) <= align_tol

        start_new = False
        if vgap > gap_factor * median_h:
            start_new = True
        elif last_was_heading:
            start_new = True
        elif left_shift > indent_tol and vgap >= 0.4 * median_h:
            # "первый строковый отступ": заметный сдвиг + не слепшийся интерлиньяж
            start_new = True
        elif not left_aligned and vgap >= 0.8 * median_h:
            # линия "съехала" по левой кромке и дистанция ощутимая
            start_new = True
        elif len(current) >= max_lines:  # 👈 ограничение по числу строк
            start_new = True

        if start_new:
            paras.append(current)
            current = [ln]
        else:
            current.append(ln)

        last_was_heading = likely_heading(ln)
        last = ln

    if current:
        paras.append(current)
    return paras


# --- Геометрия объединения линий в полигон абзаца ---
def _convex_hull(points: List[Point]) -> Polygon:
    # монотонная цепь (Andrew's algorithm)
    pts = sorted(points)
    if len(pts) <= 1:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def _union_polygons(polys: List[Polygon],
                    prefer_shapely: bool = True,
                    close_gaps_px: float = 0.0) -> Polygon:
    """
    Если доступен shapely: делаем unary_union + небольшую buffer() для склейки разрывов.
    Иначе — выпуклая оболочка всех точек (может "раздувать" вокруг зубчатых границ).
    """
    if prefer_shapely:
        try:
            from shapely.geometry import Polygon as SPoly, MultiPolygon
            from shapely.ops import unary_union
            geoms = []
            for poly in polys:
                if len(poly) >= 3:
                    geoms.append(SPoly(poly))
            if not geoms:
                return []
            merged = unary_union(geoms)
            if close_gaps_px > 0:
                merged = merged.buffer(close_gaps_px).buffer(-close_gaps_px)
            # В случае мультиполигона возьмём крупнейший (редко но бывает)
            if isinstance(merged, MultiPolygon):
                merged = max(merged, key=lambda g: g.area) if len(merged) else None
            if merged is None:
                return []
            x, y = merged.exterior.coords.xy
            return list(zip(x, y))
        except Exception:
            pass  # упадём в fallback

    # Fallback: convex hull всех вершин строк
    all_pts = list(itertools.chain.from_iterable(polys))
    return _convex_hull(all_pts)


# --- Основная функция ---
def line_polygons_to_paragraph_polygons(
        line_polygons: List[Polygon],
        *,
        overlap_threshold: float = 0.35,  # для кластеризации в колонки
        gap_factor: float = 0.1,  # множитель к median line height для "пустой строки"
        align_tol_factor: float = 0.75,  # доля от median_h для допуска по левой кромке
        indent_tol_factor: float = 0.8,  # доля от median_h для детекции первого отступа
        union_close_gaps_px: float = 1.0,  # при наличии shapely: склейка зазоров
        prefer_shapely: bool = True
) -> List[Polygon]:
    """
    На вход: список полигонов строк (в координатах страницы).
    На выход: список полигонов абзацев (в тех же координатах).
    """
    if not line_polygons:
        return []

    lines = [_line_from_polygon(p) for p in line_polygons]

    # Оценка статистик страницы
    median_h = _median([ln.height for ln in lines]) or 1.0
    median_w = _median([ln.width for ln in lines]) or 1.0
    page_left = min(ln.left for ln in lines)
    page_right = max(ln.right for ln in lines)

    align_tol = align_tol_factor * median_h
    indent_tol = indent_tol_factor * median_h

    # 1) колонки
    columns = _build_columns(lines, overlap_threshold=overlap_threshold)

    # 2) абзацы по колонкам
    paragraph_polygons: List[Polygon] = []
    for col in columns:
        paras = _group_into_paragraphs_in_column(
            col, median_h, median_w, align_tol, indent_tol, gap_factor, page_left, page_right
        )
        for para in paras:
            poly = _union_polygons([ln.polygon for ln in para],
                                   prefer_shapely=prefer_shapely,
                                   close_gaps_px=union_close_gaps_px)
            if len(poly) >= 3:
                paragraph_polygons.append(poly)

    return paragraph_polygons


# --- Пример использования ---
if __name__ == "__main__":
    # Пример: две строки = один абзац, потом заголовок по центру, затем новый абзац
    lines = [
        [(10, 10), (110, 10), (110, 20), (10, 20)],
        [(10, 22), (112, 22), (112, 32), (10, 32)],
        [(40, 50), (80, 50), (80, 60), (40, 60)],  # узкий центрированный заголовок
        [(12, 80), (160, 80), (160, 90), (12, 90)],
        [(12, 92), (158, 92), (158, 102), (12, 102)],
    ]
    paras = line_polygons_to_paragraph_polygons(lines)
    print(f"Параграфов: {len(paras)}")
    for i, poly in enumerate(paras, 1):
        print(i, poly[:3], "...", len(poly), "верш.")
