import { initializeApp } from "firebase/app";
import {
    initializeFirestore,
    memoryLocalCache,
    persistentLocalCache,
    persistentMultipleTabManager,
    setLogLevel
} from "firebase/firestore";
import {
    browserLocalPersistence,
    browserPopupRedirectResolver,
    browserSessionPersistence,
    getAuth,
    indexedDBLocalPersistence,
    initializeAuth,
    inMemoryPersistence,
} from "firebase/auth";

// ── CRITICAL: authDomain must be firebaseapp.com for Google popup to work ──
// Using your Cloud Run domain as authDomain breaks Google OAuth because
// Google's auth servers only redirect to domains registered in the
// Firebase project's OAuth credentials. firebaseapp.com is always registered.
//
// The "opening another EduBlay page" bug was caused by setting authDomain
// to your Cloud Run URL — Firebase then tried to do a redirect to your app
// as if it were the OAuth handler, creating a loop.
const firebaseConfig = {
    apiKey: "AIzaSyDpOBBeFe6BhsdRdo0YtdwNjXT0JO4ZVj0",
    authDomain: "gen-lang-client-0620675983.firebaseapp.com",  // ← MUST stay as firebaseapp.com
    projectId: "gen-lang-client-0620675983",
    storageBucket: "gen-lang-client-0620675983.appspot.com",
    messagingSenderId: "116620127648",
    appId: "1:116620127648:web:a455edea4d7ece65e2c8c5"
};

const app = initializeApp(firebaseConfig);

// Clear cached installations to prevent 403 errors on Safari/private browsing
if (typeof window !== 'undefined' && window.indexedDB) {
    try {
        window.indexedDB.deleteDatabase('firebase-installations-database');
        window.indexedDB.deleteDatabase('firebase-installations-store');
    } catch {
        // Safari private browsing blocks IndexedDB — safe to ignore
    }
}

setLogLevel('silent');

// ── Firestore with fallback for Safari private browsing ───────────────────
export const db = (() => {
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({}),
        });
    } catch {
        // Fallback: persistent cache unavailable (Safari private, some Firefox configs)
        return initializeFirestore(app, {
            localCache: memoryLocalCache(),
        });
    }
})();

// ── Auth with multi-layer persistence for all browsers ────────────────────
// Order matters: indexedDB > localStorage > sessionStorage > memory
// This ensures auth state persists even in browsers with restricted storage
export const auth = (() => {
    try {
        return initializeAuth(app, {
            persistence: [
                indexedDBLocalPersistence,
                browserLocalPersistence,
                browserSessionPersistence,
                inMemoryPersistence,
            ],
            popupRedirectResolver: browserPopupRedirectResolver,
        });
    } catch {
        return getAuth(app);
    }
})();

// Analytics disabled — prevents 403 config-fetch errors in Cloud Run
export const analytics = undefined;

export enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

export interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
        userId: string | undefined;
        email: string | undefined;
        emailVerified: boolean | undefined;
        isAnonymous: boolean | undefined;
        tenantId: string | undefined;
        providerInfo: {
            providerId: string;
            displayName: string | null;
            email: string | null;
            photoUrl: string | null;
        }[];
    }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email || undefined,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId || undefined,
            providerInfo: auth.currentUser?.providerData.map(provider => ({
                providerId: provider.providerId,
                displayName: provider.displayName,
                email: provider.email,
                photoUrl: provider.photoURL
            })) || []
        },
        operationType,
        path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
}

export default app;