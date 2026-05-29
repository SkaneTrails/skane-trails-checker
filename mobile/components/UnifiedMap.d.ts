import type { ForagingSpot, ForagingType, Place, Trail, TrailImage } from '@/lib/types';
import type { TrackingPoint } from '@/lib/track-to-trail';
import type { MapOverlay } from '@/lib/map-overlays';

export interface MapLayers {
  trails: boolean;
  foraging: boolean;
  places: boolean;
}

interface TrailImagePin {
  trailId: string;
  image: TrailImage;
}

interface UnifiedMapProps {
  trails: Trail[];
  foragingSpots: ForagingSpot[];
  foragingTypes: ForagingType[];
  places: Place[];
  layers: MapLayers;
  selectedTrailId?: string | null;
  focusBounds?: { north: number; south: number; east: number; west: number } | null;
  recordingPoints?: TrackingPoint[];
  imagePins?: TrailImagePin[];
  imageOverlays?: MapOverlay[];
  onTrailSelect?: (trail: Trail) => void;
  onSpotSelect?: (spot: ForagingSpot) => void;
  onPlaceSelect?: (place: Place) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onLongPress?: (lat: number, lng: number) => void;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

export function UnifiedMap(props: UnifiedMapProps): JSX.Element;
