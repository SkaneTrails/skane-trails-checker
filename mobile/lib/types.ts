// Coordinate type used for trail tracks
export interface Coordinate {
  lat: number;
  lng: number;
  elevation?: number;
}

// Trail bounds as returned by the API
export interface TrailBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Trail summary returned from list endpoint
export interface Trail {
  trail_id: string;
  name: string;
  status: 'To Explore' | 'Explored!';
  source: string;
  length_km: number;
  difficulty: string;
  coordinates_map: Coordinate[];
  bounds: TrailBounds;
  center: Coordinate;
  last_updated: string;
  created_at?: string | null;
  modified_at?: string | null;
  activity_date?: string | null;
  activity_type?: string | null;
  elevation_gain?: number | null;
  elevation_loss?: number | null;
  duration_minutes?: number | null;
  avg_inclination_deg?: number | null;
  max_inclination_deg?: number | null;
}

// Full trail details with all coordinates and elevation
export interface TrailDetails {
  trail_id: string;
  coordinates_full: Coordinate[];
  elevation_profile?: number[] | null;
  waypoints?: Record<string, unknown>[] | null;
  statistics?: Record<string, unknown> | null;
}

// Trail update payload
export interface TrailUpdate {
  name?: string;
  status?: 'To Explore' | 'Explored!';
  difficulty?: string;
  activity_date?: string;
  activity_type?: string;
}

// Sync metadata for delta trail fetching
export interface SyncMetadata {
  count: number;
  last_modified: string | null;
}

// Foraging spot
export interface ForagingSpot {
  id: string;
  type: string;
  lat: number;
  lng: number;
  notes: string;
  month: string;
  date?: string;
  created_at?: string;
  last_updated?: string;
}

// Create foraging spot payload
export interface ForagingSpotCreate {
  type: string;
  lat: number;
  lng: number;
  notes: string;
  month: string;
}

// Foraging type definition
export interface ForagingType {
  name: string;
  icon: string;
  color?: string;
}

// Update foraging spot payload
export interface ForagingSpotUpdate {
  type?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  month?: string;
  date?: string;
}

// Update foraging type payload
export interface ForagingTypeUpdate {
  icon?: string;
  color?: string;
  swedish_name?: string;
  description?: string;
  season?: string;
  usage?: string;
  image_file?: string;
}

// Category info embedded in a place response
export interface PlaceCategoryItem {
  name: string;
  slug: string;
  icon: string;
}

// Place / Point of Interest
export interface Place {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  categories: PlaceCategoryItem[];
  address?: string;
  city?: string;
  weburl?: string;
  source?: string;
  last_updated?: string;
}

// Place category metadata (from /places/categories endpoint)
export interface PlaceCategory {
  name: string;
  icon: string;
}

// Hike group member
export interface HikeGroupMember {
  uid: string;
  email: string;
  name: string | null;
  role: 'owner' | 'member';
}

// Hike group
export interface HikeGroup {
  group_id: string;
  name: string;
  members: HikeGroupMember[];
  created_at: string;
  last_updated: string;
}

// Create hike group payload
export interface HikeGroupCreate {
  name: string;
}

// Add member payload
export interface AddMemberRequest {
  email: string;
}

// Current user info from GET /admin/me
export interface CurrentUser {
  uid: string;
  email: string;
  role: string;
  group_id: string | null;
  group_name: string | null;
}
