#!/usr/bin/env python3
"""Southwest Michigan as an ERB partial: county outlines from the US Census
cartographic boundaries (https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json), projected equirectangular with
cos(lat) scaling, simplified, clipped to the frame. Usage: script/area_map.py counties.json out.erb"""
import json, math, sys

src, out = sys.argv[1], sys.argv[2]
W, H = 800, 500
LNG0, LNG1, LAT0, LAT1 = -86.52, -84.62, 41.97, 42.86
K = math.cos(math.radians((LAT0 + LAT1) / 2))
sx = W / ((LNG1 - LNG0) * K)
sy = H / (LAT1 - LAT0)
s = min(sx, sy)
ox = (W - (LNG1 - LNG0) * K * s) / 2
oy = (H - (LAT1 - LAT0) * s) / 2

def xy(lng, lat):
    return (ox + (lng - LNG0) * K * s, oy + (LAT1 - lat) * s)

SERVED = {"26005": "allegan", "26015": "barry", "26025": "calhoun", "26077": "kalamazoo", "26159": "van-buren"}
CONTEXT = {"26139": "Ottawa", "26081": "Kent", "26067": "Ionia", "26045": "Eaton", "26075": "Jackson",
           "26023": "Branch", "26149": "St. Joseph", "26027": "Cass", "26021": "Berrien", "26065": "Ingham", "26059": "Hillsdale", "26037": "Clinton"}
# Where each county's name sits (lat, lng), clear of the towns.
LABELS = {"allegan": (42.66, -86.02), "barry": (42.565, -85.2), "calhoun": (42.17, -84.98), "kalamazoo": (42.12, -85.53), "van-buren": (42.3, -86.12)}
NAMES = {"allegan": "Allegan", "barry": "Barry", "calhoun": "Calhoun", "kalamazoo": "Kalamazoo", "van-buren": "Van Buren"}

def ring_path(ring):
    pts, last = [], None
    for lng, lat in ring:
        p = xy(lng, lat)
        if last is None or math.dist(p, last) >= 1.2:
            pts.append(p); last = p
    if len(pts) < 3: return ""
    return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"

def path_of(geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return "".join(ring_path(r) for poly in polys for r in poly)

features = {f["id"]: f for f in json.load(open(src))["features"]}
context = "\n".join(f'    <path class="area-map__context" d="{path_of(features[fips]["geometry"])}" />' for fips in CONTEXT if fips in features)
served = []
for fips, key in SERVED.items():
    g = features[fips]["geometry"]
    cx, cy = xy(LABELS[key][1], LABELS[key][0])
    served.append((key, path_of(g), cx, cy))

# Town positions (lat, lng), approximate centers; which county they sit in.
TOWNS = [
    ("Kalamazoo", 42.2917, -85.5872, "kalamazoo", "e"), ("Portage", 42.2012, -85.5800, "kalamazoo", "e"),
    ("Richland", 42.3770, -85.4553, "kalamazoo", "base"), ("Augusta", 42.3370, -85.3533, "kalamazoo", "s"),
    ("Battle Creek", 42.3212, -85.1797, "calhoun", "e"), ("Marshall", 42.2723, -84.9633, "calhoun", "e"),
    ("Plainwell", 42.4401, -85.6489, "allegan", "w"), ("Otsego", 42.4606, -85.6964, "allegan", "nw"), ("Allegan", 42.5292, -85.8553, "allegan", "e"),
    ("South Haven", 42.4031, -86.2736, "van-buren", "e"), ("Paw Paw", 42.2178, -86.0711, "van-buren", "e"),
    ("Hastings", 42.6492, -85.2908, "barry", "e"), ("Delton", 42.4970, -85.4078, "barry", "e"), ("Gun Lake", 42.6250, -85.5300, "barry", "e"),
]
towns = []
for name, lat, lng, county, side in TOWNS:
    x, y = xy(lng, lat)
    towns.append((name, county, side, x, y))

lines = []
lines.append("<%# locals: (links: {}, counties: [], base: nil, description: \"Map of the service area in Southwest Michigan\") -%>")
lines.append("<%# Southwest Michigan, drawn from the US Census county boundaries (script/area_map.py made it). The five counties served link to their area's page (`links`, county => href); `counties` brings some forward; the pin is Richland, the home base. Drawn in on scroll (healing/area_map.js). %>")
lines.append("<% counties = Array(counties) %>")
lines.append(f'<svg class="area-map" viewBox="0 0 {W} {H}" role="img" aria-label="<%= description %>" data-area-map>')
lines.append('  <defs><clipPath id="area-map-frame"><rect width="800" height="500" rx="24" /></clipPath></defs>')
lines.append('  <g clip-path="url(#area-map-frame)">')
lines.append('    <rect class="area-map__lake" width="800" height="500" />')
lines.append(f'    <text class="area-map__water" x="{xy(-86.43, 42.6)[0]:.0f}" y="{xy(-86.43, 42.6)[1]:.0f}" transform="rotate(-90 {xy(-86.43, 42.6)[0]:.0f} {xy(-86.43, 42.6)[1]:.0f})">Lake Michigan</text>')
lines.append(context)
lines.append("  </g>")
lines.append('  <g class="area-map__counties">')
for key, d, cx, cy in served:
    lines.append(f'    <% county_class = class_names("area-map__county", "is-highlighted" => counties.include?("{key}"), "is-dimmed" => counties.any? && !counties.include?("{key}")) %>')
    lines.append("    <% county = capture do %>")
    lines.append(f'      <path class="<%= county_class %>" data-county="{key}" d="{d}" />')
    lines.append(f'      <text class="area-map__county-name" x="{cx:.0f}" y="{cy:.0f}" text-anchor="middle">{NAMES[key].upper()}</text>')
    lines.append("    <% end %>")
    lines.append(f'    <%= links["{key}"] ? link_to(county, links["{key}"], class: "area-map__link", "aria-label": "{NAMES[key]} County") : county %>')
lines.append("  </g>")
lines.append('  <g class="area-map__towns" aria-hidden="true">')
for name, county, side, x, y in towns:
    if side == "base":
        continue
    dx, anchor = {"e": (9, "start"), "w": (-9, "end"), "nw": (-9, "end"), "s": (9, "start")}[side]
    dy = {"nw": -6, "s": 12}.get(side, 4)
    lines.append(f'    <g class="area-map__town" data-town-county="{county}"><circle cx="{x:.1f}" cy="{y:.1f}" r="4" /><text x="{x + dx:.1f}" y="{y + dy:.1f}" text-anchor="{anchor}">{name}</text></g>')
lines.append("  </g>")
bx, by = xy(-85.4553, 42.3770)
lines.append(f'  <g class="area-map__base" transform="translate({bx:.1f} {by:.1f})" data-area-base>')
lines.append('    <circle class="area-map__pulse" r="18" />')
lines.append('    <path class="area-map__pin" d="M0 0c-7-9-12-15-12-21a12 12 0 0 1 24 0c0 6-5 12-12 21z" />')
lines.append('    <circle class="area-map__pin-dot" cy="-21" r="4.5" />')
lines.append('    <% if base.present? %><text class="area-map__base-label" x="16" y="-26"><%= base %></text><% end %>')
lines.append("  </g>")
lines.append("</svg>")
open(out, "w").write("\n".join(lines) + "\n")
print("wrote", out, "towns", len(towns))
