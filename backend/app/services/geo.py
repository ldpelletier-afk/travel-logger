"""Point-in-polygon subdivision lookup against bundled cartographic GeoJSON.

Handles two countries with parallel administrative schemes:
  - US: states (STATEFP) → counties (GEOID, 5-digit)
  - CA: provinces (PRUID)  → census divisions (GEOID, 4-digit)

Both boundary sets share the same GeoJSON property names (GEOID / NAME /
STATEFP), so the machinery is identical per country. Region codes DO collide
across countries (US "24" = Maryland, CA "24" = Quebec), so everything here
is keyed by (country, code), never code alone.
"""

import json
from functools import lru_cache

from shapely import STRtree
from shapely.geometry import Point, shape

from ..db import STATIC_DATA_DIR

# country -> (subdivisions file, regions file)
FILES = {
    "US": ("counties-20m.geojson", "states-20m.geojson"),
    "CA": ("ca-census-divisions-20m.geojson", "ca-provinces-20m.geojson"),
}
COUNTRIES = tuple(FILES)


@lru_cache(maxsize=1)
def _index():
    """One combined spatial index over both countries' subdivisions.

    Returns (STRtree, geoms, meta) where meta[i] = {country, geoid, name}.
    """
    geoms, meta = [], []
    for country, (sub_file, _) in FILES.items():
        fc = json.loads((STATIC_DATA_DIR / sub_file).read_text())
        for feat in fc["features"]:
            geoms.append(shape(feat["geometry"]))
            meta.append(
                {
                    "country": country,
                    "geoid": feat["properties"]["GEOID"],
                    "name": feat["properties"]["NAME"],
                }
            )
    return STRtree(geoms), geoms, meta


@lru_cache(maxsize=1)
def subdivision_total() -> dict[str, int]:
    """Denominator per country: US counties (3,144), CA census divisions (293)."""
    totals = {c: 0 for c in COUNTRIES}
    for m in _index()[2]:
        totals[m["country"]] += 1
    return totals


@lru_cache(maxsize=1)
def region_names() -> dict[str, dict]:
    """(country, region_code) -> {name, abbr}. region_code is STATEFP/PRUID."""
    out: dict[str, dict] = {}
    for country, (_, reg_file) in FILES.items():
        fc = json.loads((STATIC_DATA_DIR / reg_file).read_text())
        for f in fc["features"]:
            out[(country, f["properties"]["STATEFP"])] = {
                "name": f["properties"]["NAME"],
                "abbr": f["properties"]["STUSPS"],
            }
    return out


@lru_cache(maxsize=1)
def region_breakdown() -> dict[tuple, dict]:
    """(country, region_code) -> {country, name, abbr, geoids: [...]}."""
    names = region_names()
    out: dict[tuple, dict] = {
        key: {"country": key[0], **info, "geoids": []} for key, info in names.items()
    }
    for m in _index()[2]:
        key = (m["country"], m["geoid"][:2])
        if key in out:
            out[key]["geoids"].append(m["geoid"])
    return out


def locate(lat: float, lng: float) -> dict | None:
    """Return {country, county_fips, state_fips, county_name} for the point,
    or None if it falls outside all bundled subdivisions (ocean, elsewhere).

    'county_fips'/'state_fips' keep their US-flavoured names for backward
    compatibility; for CA they hold the CDUID and PRUID respectively.
    """
    tree, geoms, meta = _index()
    pt = Point(lng, lat)
    for i in tree.query(pt):
        if geoms[i].covers(pt):
            m = meta[i]
            return {
                "country": m["country"],
                "county_fips": m["geoid"],
                "state_fips": m["geoid"][:2],
                "county_name": m["name"],
            }
    return None
