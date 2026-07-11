"""Point-in-polygon county lookup against the bundled Census 20m GeoJSON."""

import json
from functools import lru_cache

from shapely import STRtree
from shapely.geometry import Point, shape

from ..db import STATIC_DATA_DIR


@lru_cache(maxsize=1)
def _index():
    fc = json.loads((STATIC_DATA_DIR / "counties-20m.geojson").read_text())
    geoms, fips, names = [], [], []
    for feat in fc["features"]:
        geoms.append(shape(feat["geometry"]))
        fips.append(feat["properties"]["GEOID"])
        names.append(feat["properties"]["NAME"])
    return STRtree(geoms), geoms, fips, names


@lru_cache(maxsize=1)
def county_total() -> int:
    """Denominator for the visited counter (3,144 as of the 2023 vintage)."""
    return len(_index()[2])


@lru_cache(maxsize=1)
def state_names() -> dict[str, dict]:
    fc = json.loads((STATIC_DATA_DIR / "states-20m.geojson").read_text())
    return {
        f["properties"]["STATEFP"]: {
            "name": f["properties"]["NAME"],
            "abbr": f["properties"]["STUSPS"],
        }
        for f in fc["features"]
    }


@lru_cache(maxsize=1)
def state_breakdown() -> dict[str, dict]:
    """state_fips -> {name, abbr, geoids: [county_fips, ...]}."""
    _, _, fips, _ = _index()
    names = state_names()
    out: dict[str, dict] = {
        sfips: {**info, "geoids": []} for sfips, info in names.items()
    }
    for county_fips in fips:
        sfips = county_fips[:2]
        if sfips in out:
            out[sfips]["geoids"].append(county_fips)
    return out


def locate(lat: float, lng: float) -> dict | None:
    """Return {'county_fips', 'state_fips', 'county_name'} or None if the
    point falls outside all bundled counties (ocean, other countries).

    The 20m cartographic boundaries are simplified, so points very near a
    shoreline can miss; callers should treat None as "couldn't derive",
    not an error.
    """
    tree, geoms, fips, names = _index()
    pt = Point(lng, lat)
    for i in tree.query(pt):
        if geoms[i].covers(pt):
            return {
                "county_fips": fips[i],
                "state_fips": fips[i][:2],
                "county_name": names[i],
            }
    return None
