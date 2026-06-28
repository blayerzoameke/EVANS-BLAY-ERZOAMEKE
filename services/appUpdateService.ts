import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

const CURRENT_VERSION = '2.0.0'; // Local version of the client

export interface AppVersionData {
  currentVersion: string;
  forceUpdate?: boolean;
  releaseNotes?: string;
  lastUpdated?: number;
}

export const appUpdateService = {
  getCurrentLocalVersion: () => CURRENT_VERSION,

  /**
   * Subscribe to real-time changes in the Firestore app configuration.
   */
  subscribeToAppVersion: (callback: (versionData: AppVersionData) => void) => {
    const path = 'feedback_stats/summary';
    const docRef = doc(db, 'feedback_stats', 'summary');
    return onSnapshot(docRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data.currentVersion) {
          callback({
            currentVersion: data.currentVersion,
            forceUpdate: data.forceUpdate ?? false,
            releaseNotes: data.releaseNotes || '',
            lastUpdated: data.lastUpdated,
          });
        } else {
          // If version fields aren't there yet, initialize them gracefully without overwriting other metrics
          try {
            await setDoc(docRef, {
              currentVersion: CURRENT_VERSION,
              forceUpdate: false,
              releaseNotes: 'Initial release with real-time app update detection.',
            }, { merge: true });
          } catch (e) {
            console.warn('[Update] Could not bootstrap version fields in feedback_stats/summary:', e);
          }
          callback({ currentVersion: CURRENT_VERSION });
        }
      } else {
        // Document does not exist in Firestore, bootstrap it.
        try {
          await setDoc(docRef, {
            currentVersion: CURRENT_VERSION,
            forceUpdate: false,
            releaseNotes: 'Initial release with real-time app update detection.',
          }, { merge: true });
        } catch (e) {
          console.warn('[Update] Could not bootstrap feedback_stats/summary:', e);
        }
        callback({ currentVersion: CURRENT_VERSION });
      }
    }, (error) => {
      console.error('[Update] Error listening to app version control:', error);
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  /**
   * For testing or admin control: trigger a new version update in Firestore.
   */
  triggerUpdateInFirestore: async (newVersion: string, releaseNotes: string = '', force: boolean = false) => {
    const path = 'feedback_stats/summary';
    try {
      const docRef = doc(db, 'feedback_stats', 'summary');
      await setDoc(docRef, {
        currentVersion: newVersion,
        forceUpdate: force,
        releaseNotes,
        lastUpdatedVersion: Date.now(),
      }, { merge: true });
      console.log(`[Update] Triggered update in Firestore to version ${newVersion}`);
      return true;
    } catch (e) {
      console.error('[Update] Failed to trigger update in Firestore:', e);
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }
};

