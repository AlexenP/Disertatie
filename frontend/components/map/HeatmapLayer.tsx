"use client";

import {useEffect} from "react";
import {useMap} from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

type HeatPoint = [number, number, number];

type HeatmapLayerProps = {
    points: HeatPoint[];
    visible: boolean;
};

export default function HeatmapLayer({points, visible}: HeatmapLayerProps) {
    const map = useMap();

    useEffect(() => {
        if (!visible || !points.length) {
            return;
        }

        const heatLayer = (L as typeof L & {
            heatLayer: (points: HeatPoint[], options: Record<string, number>) => L.Layer;
        }).heatLayer(points, {
            radius: 36,
            blur: 28,
            maxZoom: 17,
            minOpacity: 0.35,
            max: 1,
        });

        heatLayer.addTo(map);

        return () => {
            map.removeLayer(heatLayer);
        };
    }, [map, points, visible]);

    return null;
}
