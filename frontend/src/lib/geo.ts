type Ring = [number, number][]
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] }

export type Bbox = [number, number, number, number] // minX, minY, maxX, maxY

export function bboxOfGeometry(geom: Geometry): Bbox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const rings: Ring[] = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat()
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return [minX, minY, maxX, maxY]
}

export function unionBbox(boxes: Bbox[]): Bbox {
  return boxes.reduce<Bbox>(
    (acc, b) => [
      Math.min(acc[0], b[0]),
      Math.min(acc[1], b[1]),
      Math.max(acc[2], b[2]),
      Math.max(acc[3], b[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  )
}
