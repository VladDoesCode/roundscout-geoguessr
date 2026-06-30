import argparse
import json
from pathlib import Path


def point_segment_distance_sq(point, start, end):
    px, py = point
    ax, ay = start
    bx, by = end
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return (px - ax) ** 2 + (py - ay) ** 2
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    qx, qy = ax + t * dx, ay + t * dy
    return (px - qx) ** 2 + (py - qy) ** 2


def rdp(points, tolerance_sq):
    if len(points) <= 2:
        return points
    start, end = points[0], points[-1]
    index, distance = 0, -1.0
    for current in range(1, len(points) - 1):
        candidate = point_segment_distance_sq(points[current], start, end)
        if candidate > distance:
            index, distance = current, candidate
    if distance <= tolerance_sq:
        return [start, end]
    left = rdp(points[: index + 1], tolerance_sq)
    right = rdp(points[index:], tolerance_sq)
    return left[:-1] + right


def simplify_ring(raw_ring, tolerance):
    points = []
    for value in raw_ring:
        point = (round(float(value[0]), 5), round(float(value[1]), 5))
        if not points or point != points[-1]:
            points.append(point)
    if len(points) > 1 and points[0] == points[-1]:
        points.pop()
    if len(points) < 3:
        return []

    anchor = max(range(1, len(points)), key=lambda i: (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2)
    first = rdp(points[: anchor + 1], tolerance * tolerance)
    second = rdp(points[anchor:] + [points[0]], tolerance * tolerance)
    simplified = first + second[1:-1]
    if len(simplified) < 3:
        simplified = points[:3]
    return [[x, y] for x, y in simplified] + [[simplified[0][0], simplified[0][1]]]


def simplify_polygon(polygon, tolerance):
    rings = [simplify_ring(ring, tolerance) for ring in polygon]
    return [ring for ring in rings if len(ring) >= 4]


def simplify_geometry(geometry, tolerance):
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates", [])
    if kind == "Polygon":
        polygon = simplify_polygon(coordinates, tolerance)
        return {"type": kind, "coordinates": polygon} if polygon else None
    if kind == "MultiPolygon":
        polygons = [simplify_polygon(polygon, tolerance) for polygon in coordinates]
        polygons = [polygon for polygon in polygons if polygon]
        return {"type": kind, "coordinates": polygons} if polygons else None
    return None


def visit_points(value, points):
    if isinstance(value, list) and len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
        points.append(value)
        return
    if isinstance(value, list):
        for item in value:
            visit_points(item, points)


def geometry_bounds(geometry):
    points = []
    visit_points(geometry["coordinates"], points)
    return [
        min(point[0] for point in points),
        min(point[1] for point in points),
        max(point[0] for point in points),
        max(point[1] for point in points),
    ]


def country_codes(country_path):
    data = json.loads(country_path.read_text(encoding="utf-8"))
    result = {}
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        code = props.get("ISO_A2_EH") or props.get("ISO_A2")
        if isinstance(code, str) and len(code) == 2:
            for key in (props.get("ADM0_A3"), props.get("SOV_A3"), props.get("GU_A3")):
                if key:
                    result[key] = code.upper()
    return result


def build(source_path, country_path, output_path, tolerance):
    source = json.loads(source_path.read_text(encoding="utf-8"))
    code_map = country_codes(country_path)
    features = []
    for feature in source.get("features", []):
        props = feature.get("properties", {})
        code = str(props.get("iso_a2") or "").upper()
        if len(code) != 2:
            code = code_map.get(props.get("adm0_a3"), "")
        name = props.get("name_en") or props.get("name") or props.get("gn_name")
        geometry = simplify_geometry(feature.get("geometry") or {}, tolerance)
        if not code or not name or not geometry:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "country": code,
                "name": name,
                "id": props.get("iso_3166_2") or "",
                "type": props.get("type_en") or props.get("type") or "",
                "parent": props.get("region") or props.get("region_sub") or "",
            },
            "bbox": geometry_bounds(geometry),
            "geometry": geometry,
        })
    payload = {"type": "FeatureCollection", "features": features}
    output_path.write_text(json.dumps(payload, ensure_ascii=True, separators=(",", ":")), encoding="utf-8")
    return len(features)


def main():
    parser = argparse.ArgumentParser(description="Build RoundScout's compact Natural Earth region index.")
    parser.add_argument("source", type=Path)
    parser.add_argument("countries", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--tolerance", type=float, default=0.0025)
    args = parser.parse_args()
    count = build(args.source, args.countries, args.output, args.tolerance)
    print(f"Wrote {count} regions to {args.output}")


if __name__ == "__main__":
    main()
