/**
 * Web stub for tracking-service.
 *
 * The real tracking implementation lives in tracking-service.ts (native).
 * Metro resolves this .web.ts file on web, avoiding expo-task-manager
 * and expo-location imports that don't work in browser environments.
 */

import type { TrackingPoint } from '@/lib/track-to-trail';

type PointListener = (point: TrackingPoint) => void;

export async function startTracking(_onPoint: PointListener): Promise<void> {}
export async function resumeTracking(_onPoint: PointListener): Promise<void> {}
export async function pauseTracking(): Promise<void> {}
export async function stopTracking(): Promise<TrackingPoint[]> { return []; }
export async function clearBuffer(): Promise<void> {}
export async function isTracking(): Promise<boolean> { return false; }
export async function recoverPoints(): Promise<TrackingPoint[]> { return []; }
