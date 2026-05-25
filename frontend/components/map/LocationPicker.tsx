"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from "react-leaflet";

type LocationPickerProps = {
  latitude: number;
  longitude: number;
  onSelect: (latitude: number, longitude: number) => void;
};

function MapClickHandler({ onSelect }: { onSelect: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function LocationPicker({
  latitude,
  longitude,
  onSelect,
}: LocationPickerProps) {
  return (
    <div className="h-[520px] overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer
        center={[latitude || 44.4268, longitude || 26.1025]}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onSelect={onSelect} />

        {latitude && longitude && (
          <CircleMarker
            center={[latitude, longitude]}
            radius={9}
            pathOptions={{
              color: "#0f172a",
              fillColor: "#0f172a",
              fillOpacity: 0.9,
            }}
          >
            <Popup>Locatie selectata</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}