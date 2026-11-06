import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface GoogleTrackingMapProps {
  customerCoords: [number, number];
  technicianCoords: [number, number];
  onRouteCalculated?: (coords: [number, number][], timeInSeconds: number) => void;
  className?: string;
}

// Estilo Minimalista estilo Uber / Snazzy Maps
const UBER_MINIMAL_STYLE: google.maps.MapTypeStyle[] = [
  {
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }]
  },
  {
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }]
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }]
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f5f5f5" }]
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }]
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e8f5e9" }]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dadada" }]
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }]
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }]
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }]
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#dbeafe" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }]
  }
];

// Decodificar Polyline de Google Routes
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// Helper para calcular rumbo (bearing) entre dos puntos geográficos
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

export default function GoogleTrackingMap({
  customerCoords,
  technicianCoords,
  onRouteCalculated,
  className = 'h-full w-full'
}: GoogleTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const routeBgPolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeMainPolylineRef = useRef<google.maps.Polyline | null>(null);
  const destMarkerRef = useRef<google.maps.OverlayView | null>(null);
  const techMarkerRef = useRef<google.maps.OverlayView | null>(null);
  const animationRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    'AIzaSyA9aYa76-YBAGlanLejHQ55ipqUxX4vkd8';

  // 1. Inicializar el mapa de Google Maps con tema minimalista
  useEffect(() => {
    if (!mapRef.current) return;

    let isMounted = true;

    async function initMap() {
      try {
        setOptions({
          key: apiKey,
          v: 'weekly'
        });

        const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary;
        await importLibrary('geometry');

        if (!isMounted || !mapRef.current) return;

        const map = new Map(mapRef.current, {
          center: { lat: customerCoords[0], lng: customerCoords[1] },
          zoom: 15,
          styles: UBER_MINIMAL_STYLE,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy'
        });

        mapInstanceRef.current = map;
        setMapLoaded(true);
      } catch (err) {
        console.error('Error cargando Google Maps API:', err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  // 2. Crear / Actualizar Marcadores Personalizados y Ruta
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google) return;

    const google = window.google;
    const map = mapInstanceRef.current;

    // Helper para crear OverlayView (Marcadores HTML personalizados sin bordes)
    class HTMLMarkerOverlay extends google.maps.OverlayView {
      private position: google.maps.LatLng;
      private content: HTMLElement;
      private anchor: 'center' | 'bottom';
      private rotation: number;

      constructor(position: google.maps.LatLng, content: HTMLElement, anchor: 'center' | 'bottom' = 'center') {
        super();
        this.position = position;
        this.content = content;
        this.anchor = anchor;
        this.rotation = 0;
      }

      onAdd() {
        const panes = this.getPanes();
        if (panes && panes.overlayMouseTarget) {
          panes.overlayMouseTarget.appendChild(this.content);
        }
      }

      draw() {
        const projection = this.getProjection();
        if (!projection) return;
        const point = projection.fromLatLngToDivPixel(this.position);
        if (point) {
          this.content.style.position = 'absolute';
          this.content.style.left = `${point.x}px`;
          this.content.style.top = `${point.y}px`;
          const translate = this.anchor === 'bottom' ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)';
          this.content.style.transform = `${translate} rotate(${this.rotation}deg)`;
          this.content.style.transformOrigin = 'center center';
          this.content.style.zIndex = '10';
        }
      }

      onRemove() {
        if (this.content.parentElement) {
          this.content.parentElement.removeChild(this.content);
        }
      }

      setPosition(newPos: google.maps.LatLng, rotationDeg?: number) {
        this.position = newPos;
        if (typeof rotationDeg === 'number') {
          this.rotation = rotationDeg;
        }
        this.draw();
      }
    }

    // --- Marcador de Casa / Destino (Pin oficial Figma con Rayo WIN) ---
    if (!destMarkerRef.current) {
      const destDiv = document.createElement('div');
      destDiv.className = 'custom-google-dest-pin';
      destDiv.innerHTML = `
        <div style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35)); cursor: pointer;">
          <svg width="34" height="46" viewBox="26 403 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="43" cy="420" r="11.5" fill="white"/>
            <path d="M42.9979 403.874C33.7312 403.874 26.2188 411.387 26.2188 420.653C26.2188 434.307 42.9979 448.125 42.9979 448.125C42.9979 448.125 59.7771 434.307 59.7771 420.653C59.7771 411.387 52.2646 403.874 42.9979 403.874ZM31.3595 419.913C31.3595 413.508 36.5516 408.316 42.9567 408.316C43.7933 408.316 44.6081 408.406 45.3947 408.574L34.6979 423.161H42.4762L39.9484 431.114C35.0021 429.789 31.3595 425.278 31.3595 419.913V419.913ZM42.9567 431.51C42.5211 431.51 42.0914 431.484 41.6683 431.437L51.6951 418.263H43.9169L46.5354 408.881C51.1887 410.389 54.5544 414.756 54.5544 419.912C54.5544 426.318 49.3623 431.51 42.9572 431.51L42.9567 431.51Z" fill="#FF5A0A"/>
          </svg>
        </div>
      `;
      const destOverlay = new HTMLMarkerOverlay(
        new google.maps.LatLng(customerCoords[0], customerCoords[1]),
        destDiv,
        'bottom'
      );
      destOverlay.setMap(map);
      destMarkerRef.current = destOverlay;
    } else {
      (destMarkerRef.current as any).setPosition(
        new google.maps.LatLng(customerCoords[0], customerCoords[1])
      );
    }

    // --- Marcador de Camión del Técnico (Camioneta 3D oficial Figma) ---
    if (!techMarkerRef.current) {
      const techDiv = document.createElement('div');
      techDiv.className = 'custom-google-tech-pin';
      techDiv.innerHTML = `
        <div style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3)); cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <img src="/Vehiculo_nuevo_win.png" width="58" height="35" alt="Técnico WIN" style="object-fit: contain; pointer-events: none;" />
        </div>
      `;
      const techOverlay = new HTMLMarkerOverlay(
        new google.maps.LatLng(technicianCoords[0], technicianCoords[1]),
        techDiv,
        'center'
      );
      techOverlay.setMap(map);
      techMarkerRef.current = techOverlay;
    } else {
      (techMarkerRef.current as any).setPosition(
        new google.maps.LatLng(technicianCoords[0], technicianCoords[1])
      );
    }

    // --- Consultar y Dibujar Ruta con Tráfico ---
    let isCancelled = false;

    const fetchRoute = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start: technicianCoords, end: customerCoords })
        });

        const result = await response.json();

        if (result.success && !isCancelled && result.polyline) {
          const pathPoints = decodePolyline(result.polyline);
          const googlePath = pathPoints.map(p => ({ lat: p[0], lng: p[1] }));

          // 1. Línea Base (borde sutil blanco de contraste)
          if (routeBgPolylineRef.current) routeBgPolylineRef.current.setMap(null);
          routeBgPolylineRef.current = new google.maps.Polyline({
            path: googlePath,
            geodesic: true,
            strokeColor: '#FFFFFF',
            strokeOpacity: 0.85,
            strokeWeight: 6,
            map: map,
            zIndex: 1
          });

          // 2. Línea Principal Naranja Oficial WIN (Figma Step 33)
          if (routeMainPolylineRef.current) routeMainPolylineRef.current.setMap(null);
          routeMainPolylineRef.current = new google.maps.Polyline({
            path: googlePath,
            geodesic: true,
            strokeColor: '#FF5A0A',
            strokeOpacity: 1.0,
            strokeWeight: 4,
            map: map,
            zIndex: 2
          });

          // 3. Ajustar Encuadre (fitBounds) con espacio inferior para el Bottom Sheet
          const bounds = new google.maps.LatLngBounds();
          googlePath.forEach(pt => bounds.extend(pt));
          map.fitBounds(bounds, {
            top: 70,
            left: 40,
            right: 40,
            bottom: 240
          });

          if (onRouteCalculated) {
            onRouteCalculated(pathPoints, result.durationSeconds || 0);
          }

          // 4. Animación suave del vehículo a lo largo de la ruta
          if (result.durationSeconds && result.durationSeconds > 0) {
            const startPt = pathPoints[0];
            const endPt = pathPoints[pathPoints.length - 1];
            const routeKey = `route_time_${startPt[0]}_${startPt[1]}_${endPt[0]}_${endPt[1]}`;
            const savedTime = localStorage.getItem(routeKey);
            const now = Date.now();
            let startTime = now;

            if (savedTime) {
              const parsed = parseInt(savedTime, 10);
              if (now - parsed < result.durationSeconds * 1000) {
                startTime = parsed;
              } else {
                localStorage.setItem(routeKey, now.toString());
              }
            } else {
              localStorage.setItem(routeKey, now.toString());
            }

            const totalDurationMs = result.durationSeconds * 1000;

            const animateStep = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / totalDurationMs, 1);

              if (pathPoints.length > 1) {
                const totalIndex = (pathPoints.length - 1) * progress;
                const idx = Math.floor(totalIndex);
                const remainder = totalIndex - idx;

                if (idx < pathPoints.length - 1) {
                  const p1 = pathPoints[idx];
                  const p2 = pathPoints[idx + 1];
                  const curLat = p1[0] + (p2[0] - p1[0]) * remainder;
                  const curLng = p1[1] + (p2[1] - p1[1]) * remainder;

                  // Rumbo de desplazamiento y corrección de orientación del carro
                  // La van original apunta a 270° (Oeste). Al sumar 90°, 0° apunta al Norte real.
                  const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
                  const rotationDeg = (bearing + 90) % 360;

                  if (techMarkerRef.current) {
                    (techMarkerRef.current as any).setPosition(
                      new google.maps.LatLng(curLat, curLng),
                      rotationDeg
                    );
                  }

                  // Limpiar la línea que va quedando atrás (mostrar solo el trayecto restante)
                  const remainingPath = [
                    { lat: curLat, lng: curLng },
                    ...googlePath.slice(idx + 1)
                  ];
                  if (routeMainPolylineRef.current) {
                    routeMainPolylineRef.current.setPath(remainingPath);
                  }
                  if (routeBgPolylineRef.current) {
                    routeBgPolylineRef.current.setPath(remainingPath);
                  }
                } else if (pathPoints.length > 0) {
                  const last = pathPoints[pathPoints.length - 1];
                  const prev = pathPoints[pathPoints.length - 2] || last;
                  const bearing = calculateBearing(prev[0], prev[1], last[0], last[1]);
                  const rotationDeg = (bearing + 90) % 360;

                  if (techMarkerRef.current) {
                    (techMarkerRef.current as any).setPosition(
                      new google.maps.LatLng(last[0], last[1]),
                      rotationDeg
                    );
                  }
                  if (routeMainPolylineRef.current) {
                    routeMainPolylineRef.current.setPath([{ lat: last[0], lng: last[1] }]);
                  }
                  if (routeBgPolylineRef.current) {
                    routeBgPolylineRef.current.setPath([{ lat: last[0], lng: last[1] }]);
                  }
                }
              }

              if (progress < 1) {
                animationRef.current = requestAnimationFrame(animateStep);
              }
            };

            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            animationRef.current = requestAnimationFrame(animateStep);
          }
        }
      } catch (err) {
        console.error('Error calculando ruta en Google Maps:', err);
      }
    };

    fetchRoute();

    return () => {
      isCancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mapLoaded, customerCoords[0], customerCoords[1], technicianCoords[0], technicianCoords[1]]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="h-full w-full" />
    </div>
  );
}
