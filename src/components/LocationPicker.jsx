import React, { useEffect, useRef } from "react";

const DEFAULT_POSITION = { lat: 28.209346470763503, lng: 83.98582556979629 };

export default function LocationPicker({
  onLocationChange,
  latitude,
  longitude,
  address,
}) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    // Load Google Maps script if not already loaded
    if (!window.google || !window.google.maps) {
      const script = document.createElement("script");
      script.src =
        "https://maps.googleapis.com/maps/api/js?key=AIzaSyDpKqSxlnbhvXhkmW6l430zp8SIUDsTYc8&libraries=places";
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }

    function initMap() {
      const position =
        latitude && longitude
          ? { lat: parseFloat(latitude), lng: parseFloat(longitude) }
          : DEFAULT_POSITION;

      const map = new window.google.maps.Map(mapRef.current, {
        center: position,
        zoom: 14,
        // Default to satellite view
        mapTypeId: "satellite",
        // Show a map type control so users can switch if needed
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });

      geocoderRef.current = new window.google.maps.Geocoder();

      markerRef.current = new window.google.maps.Marker({
        map,
        position,
        draggable: true,
      });

      updatePosition(position);

      markerRef.current.addListener("dragend", function () {
        const pos = {
          lat: markerRef.current.getPosition().lat(),
          lng: markerRef.current.getPosition().lng(),
        };
        updatePosition(pos);
      });
    }

    function updatePosition(position) {
      geocoderRef.current.geocode({ location: position }, (results, status) => {
        const addr =
          status === "OK" && results[0]
            ? results[0].formatted_address
            : "Unable to fetch address";
        onLocationChange({
          latitude: position.lat,
          longitude: position.lng,
          address: addr,
        });
      });
    }
    // eslint-disable-next-line
  }, []);

  return (
    <div>
      <div
        id="map"
        ref={mapRef}
        style={{ height: 400, width: "100%", marginBottom: 10 }}
      />
      {/* Address field hidden from UI */}
      {/*
      <label>Address:</label>
      <input type="text" value={address || ""} readOnly style={{ width: "100%" }} />
      */}
    </div>
  );
}
