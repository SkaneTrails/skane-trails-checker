import type { ForagingSpot, ForagingType, ImagePin, Place, Trail } from '@/lib/types';
import type { TrackingPoint } from '@/lib/track-to-trail';
import type { MapOverlay } from '@/lib/map-overlays';

export interface MapLayers {
  trails: boolean;
  foraging: boolean;
  places: boolean;
  images: boolean;
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
  imagePins?: ImagePin[];
  imageOverlays?: MapOverlay[];
  editingOverlayId?: string | null;
  onTrailSelect?: (trail: Trail) => void;
  onSpotSelect?: (spot: ForagingSpot) => void;
  onPlaceSelect?: (place: Place) => void;
  onImagePinSelect?: (trailId: string) => void;
  onOverlayCornersChange?: (id: string, corners: MapOverlay['corners']) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onLongPress?: (lat: number, lng: number) => void;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

export function UnifiedMap(props: UnifiedMapProps): JSX.Element;
