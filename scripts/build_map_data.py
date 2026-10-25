"""Derived map data, not new survey observations.

Run after extract_data.py: python scripts/build_map_data.py
Requires pyproj. Retains every source record, including overlapping locations.
"""
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SIDE = 10000.0  # Metres from centre to vertex; full hex area is ~259.8 km².
forward = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
inverse = Transformer.from_crs("EPSG:3577", "EPSG:4326", always_xy=True)


def axial_round(q, r):
    x, z = q, r
    y = -x-z
    rx, ry, rz = round(x), round(y), round(z)
    dx, dy, dz = abs(rx-x), abs(ry-y), abs(rz-z)
    if dx > dy and dx > dz:
        rx = -ry-rz
    elif dy > dz:
        ry = -rx-rz
    else:
        rz = -rx-ry
    return rx, rz


with (DATA / "telstra_sites_victoria_2026.csv").open(newline="", encoding="utf-8") as f:
    source = list(csv.DictReader(f))
bins = defaultdict(lambda: {"record_count": 0, "five_g_records": 0, "other_records": 0})
for record in source:
    x, y = forward.transform(float(record["longitude"]), float(record["latitude"]))
    q = (math.sqrt(3)/3*x-y/3)/SIDE
    r = 2*y/(3*SIDE)
    cell = bins[axial_round(q, r)]
    cell["record_count"] += 1
    cell["five_g_records" if int(record["five_g_present"]) else "other_records"] += 1

features, records = [], []
for (q, r), counts in sorted(bins.items()):
    cx = SIDE*math.sqrt(3)*(q+r/2)
    cy = SIDE*1.5*r
    lon, lat = inverse.transform(cx, cy)
    props = dict(cell_id=f"{q}:{r}", q=q, r=r, year=2026,
                 **counts, cell_area_km2=round(3*math.sqrt(3)*SIDE*SIDE/2/1e6, 6),
                 centroid_lon=round(lon, 6), centroid_lat=round(lat, 6),
                 source_id="accc_sites",
                 method="Hexagonal aggregation of the generalised Victoria subset; EPSG:3577; centre-to-vertex 10km")
    # Clockwise exterior for Vega/D3 spherical geoshape rendering.
    vertices = [list(inverse.transform(
        cx+SIDE*math.cos(math.radians(30-i*60)),
        cy+SIDE*math.sin(math.radians(30-i*60)))) for i in range(6)]
    vertices.append(vertices[0])
    features.append(dict(type="Feature", properties=props,
                         geometry=dict(type="Polygon", coordinates=[vertices])))
    records.append(props)

assert sum(r["record_count"] for r in records) == len(source)
assert sum(r["five_g_records"] for r in records) == sum(int(r["five_g_present"]) for r in source)
assert all(r["record_count"] == r["five_g_records"]+r["other_records"] for r in records)
(DATA/"victoria_hexbins_2026.geojson").write_text(
    json.dumps(dict(type="FeatureCollection", features=features), separators=(",", ":")))


def write_csv(name, rows, description, manifest):
    with (DATA/name).open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    entry = dict(file=name, rows=len(rows), columns=list(rows[0]),
                 description=description, bytes=(DATA/name).stat().st_size)
    manifest["files"] = [e for e in manifest["files"] if e["file"] != name] + [entry]


manifest = json.loads((DATA/"manifest.json").read_text())
write_csv("victoria_hexbins_2026.csv", records,
          "Telstra source-record counts in full ~259.8km² equal-area hexagons. Contains all/5G/other counts; not coverage or unique towers.", manifest)
manifest["files"] = [e for e in manifest["files"] if e["file"] not in {
    "state_tile_layout.csv", "adii_cartogram_metrics.csv"}]
for key in list(manifest["validation"]):
    if key.startswith("cartogram_"):
        manifest["validation"].pop(key)
manifest["validation"]["hexbin_records_reconcile"] = True
manifest["validation"]["hexbin_records"] = len(source)
manifest["validation"]["occupied_hexagons"] = len(records)
manifest["validation"].pop("tile_states", None)
(DATA/"manifest.json").write_text(json.dumps(manifest, indent=2))
methods = dict(
    source_csv="telstra_sites_victoria_2026.csv",
    source_records=len(source), occupied_hexagons=len(records),
    five_g_records=sum(r["five_g_records"] for r in records),
    projected_crs="EPSG:3577 (GDA94 / Australian Albers)",
    radius_metres=SIDE, full_cell_area_km2=records[0]["cell_area_km2"],
    grid_origin=[0, 0], orientation="pointy-top", clipped=False,
    limitations=[
        "Whole cells can extend beyond Victoria; counts only include source records in the existing generalised Victoria subset.",
        "Overlapping RFNSA records are retained, not silently treated as unique towers.",
        "Blank areas indicate no selected records in this extract, not no signal coverage."
    ])
(DATA/"map_methods.json").write_text(json.dumps(methods, indent=2))
print(json.dumps(methods, indent=2))
