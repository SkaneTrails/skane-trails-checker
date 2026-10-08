import { auth } from '@/lib/firebase';

/** The signed-in user's ID; keeps one user's local trail copy away from the next user's. */
export function currentUserId(): string {
  return auth?.currentUser?.uid ?? 'anonymous';
}
