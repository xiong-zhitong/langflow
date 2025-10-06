import L from "leaflet";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const MAP_CONFIG = {
  DEFAULT_CENTER: [38.8, -84.5] as [number, number],
  DEFAULT_ZOOM: 9,
  ROI_COLOR: "#3B82F6", // Modern blue color
  ROI_OPACITY: 0.25,
  LINE_WIDTH: 2,
};

const MAP_LAYERS = [
  { id: "satellite", name: "Satellite" },
  { id: "streets", name: "Streets" },
  { id: "terrain", name: "Terrain" },
];

const LAYER_CONFIGS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
  },
  streets: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap",
  },
  terrain: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
  },
};

interface MapComponentProps {
  height?: string;
  onRegionSelect?: (coordinates: any) => void;
  className?: string;
}

const MapComponent = memo(
  ({ height = "300px", onRegionSelect, className = "" }: MapComponentProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const drawControl = useRef<L.Control.Draw | null>(null);
    const drawnItems = useRef<L.FeatureGroup | null>(null);
    const [activeLayer, setActiveLayer] = useState("satellite");
    const [currentLayer, setCurrentLayer] = useState<L.TileLayer | null>(null);
    // Keep a stable ref to the callback to avoid re-creating the map on each render
    const onRegionSelectRef = useRef<typeof onRegionSelect>(onRegionSelect);
    useEffect(() => {
      onRegionSelectRef.current = onRegionSelect;
    }, [onRegionSelect]);

    // Initialize map
    useEffect(() => {
      if (!mapContainer.current || map.current) return;

      // Create map
      map.current = L.map(mapContainer.current, {
        center: MAP_CONFIG.DEFAULT_CENTER,
        zoom: MAP_CONFIG.DEFAULT_ZOOM,
        zoomControl: true,
      });

      // Create drawn items layer
      drawnItems.current = new L.FeatureGroup();
      map.current.addLayer(drawnItems.current);

      // Initialize with satellite layer
      const satelliteLayer = L.tileLayer(LAYER_CONFIGS.satellite.url, {
        attribution: LAYER_CONFIGS.satellite.attribution,
      });
      satelliteLayer.addTo(map.current);
      setCurrentLayer(satelliteLayer);

      // Setup draw controls
      drawControl.current = new L.Control.Draw({
        edit: {
          featureGroup: drawnItems.current,
          remove: true,
        },
        draw: {
          polygon: {
            shapeOptions: {
              color: MAP_CONFIG.ROI_COLOR,
              fillOpacity: MAP_CONFIG.ROI_OPACITY,
              weight: MAP_CONFIG.LINE_WIDTH,
            },
          },
          rectangle: {
            shapeOptions: {
              color: MAP_CONFIG.ROI_COLOR,
              fillOpacity: MAP_CONFIG.ROI_OPACITY,
              weight: MAP_CONFIG.LINE_WIDTH,
            },
          },
          circle: false,
          circlemarker: false,
          marker: false,
          polyline: false,
        },
      });

      map.current.addControl(drawControl.current);

      // Handle draw events
      map.current.on(L.Draw.Event.CREATED, (event: any) => {
        const layer = event.layer;
        drawnItems.current?.addLayer(layer);

        // Get coordinates and call callback
        if (onRegionSelectRef.current) {
          let coordinates;
          if (layer.getLatLngs) {
            coordinates = layer.getLatLngs();
          } else if (layer.getBounds) {
            const bounds = layer.getBounds();
            coordinates = [
              [bounds.getNorth(), bounds.getWest()],
              [bounds.getNorth(), bounds.getEast()],
              [bounds.getSouth(), bounds.getEast()],
              [bounds.getSouth(), bounds.getWest()],
            ];
          }
          onRegionSelectRef.current?.(coordinates);
        }
      });

      map.current.on(L.Draw.Event.EDITED, (event: any) => {
        const layers = event.layers;
        layers.eachLayer((layer: any) => {
          if (onRegionSelectRef.current) {
            let coordinates;
            if (layer.getLatLngs) {
              coordinates = layer.getLatLngs();
            } else if (layer.getBounds) {
              const bounds = layer.getBounds();
              coordinates = [
                [bounds.getNorth(), bounds.getWest()],
                [bounds.getNorth(), bounds.getEast()],
                [bounds.getSouth(), bounds.getEast()],
                [bounds.getSouth(), bounds.getWest()],
              ];
            }
            onRegionSelectRef.current?.(coordinates);
          }
        });
      });

      map.current.on(L.Draw.Event.DELETED, () => {
        if (onRegionSelectRef.current) {
          onRegionSelectRef.current(null);
        }
      });

      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    }, []);

    // Handle map resize when height changes, preserving current center & zoom
    useEffect(() => {
      const m = map.current;
      if (m) {
        const center = m.getCenter();
        const zoom = m.getZoom();
        const timeoutId = setTimeout(() => {
          m.invalidateSize();
          // Explicitly restore view to avoid any zoom reset side-effects
          m.setView(center, zoom, { animate: false });
        }, 50);

        return () => clearTimeout(timeoutId);
      }
    }, [height]);

    // Handle map resize when container size changes (e.g., sidebar toggle)
    useEffect(() => {
      const container = mapContainer.current;
      const m = map.current;

      if (!container || !m) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Debounce the resize to avoid excessive calls
          const timeoutId = setTimeout(() => {
            const center = m.getCenter();
            const zoom = m.getZoom();
            m.invalidateSize();
            // Restore view to maintain user's current position
            m.setView(center, zoom, { animate: false });
          }, 100);

          // Store timeout ID for cleanup
          return () => clearTimeout(timeoutId);
        }
      });

      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    // Handle layer switching
    const switchLayer = useCallback(
      (layerId: string) => {
        if (!map.current || !currentLayer) return;

        const layerConfig =
          LAYER_CONFIGS[layerId as keyof typeof LAYER_CONFIGS];
        if (!layerConfig) return;

        // Remove current layer
        map.current.removeLayer(currentLayer);

        // Add new layer
        const newLayer = L.tileLayer(layerConfig.url, {
          attribution: layerConfig.attribution,
        });
        newLayer.addTo(map.current);
        setCurrentLayer(newLayer);
        setActiveLayer(layerId);
      },
      [currentLayer],
    );

    return (
      <div className={`relative ${className}`} style={{ height }}>
        {/* Layer selector */}
        <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-1.5 flex gap-1">
          {MAP_LAYERS.map((layer) => (
            <button
              key={layer.id}
              onClick={() => switchLayer(layer.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                activeLayer === layer.id
                  ? "bg-blue-500 text-white shadow-md"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {layer.name}
            </button>
          ))}
        </div>

        {/* Map container */}
        <div
          ref={mapContainer}
          className="w-full h-full rounded-lg overflow-hidden"
          style={{ cursor: "grab" }}
        />
      </div>
    );
  },
);

MapComponent.displayName = "MapComponent";

export default MapComponent;
