import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import {point} from "@turf/helpers";
import {bucharestSectorPolygons} from "./bucharestSectorPolygons";

export function detectBucharestSector(latitude: number, longitude: number): number | null {
  const selectedPoint = point([longitude, latitude]);

  for (const feature of bucharestSectorPolygons.features) {
    if (booleanPointInPolygon(selectedPoint, feature as never)) {
      return feature.properties.sector_id;
    }
  }

  return null;
}
