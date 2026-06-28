import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  GoogleAuthProvider,
  type User as FirebaseUser,
  verifyPasswordResetCode,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  limit
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import type { UserDetails } from '../types';
import { EducationalLevel } from '../types';
import { initializeUsage } from '../lib/usageManager';
import { globalFeedbackService } from './globalFeedbackService';

const SESSION_TOKEN_KEY = 'sessionToken';
const GOOGLE_REDIRECT_PENDING_KEY = 'eb_google_redirect_pending';
const USER_KEY_PREFIX = 'eb_u_data_';
const DB_NAME = 'EduBlayDB';
const STORE_NAME = 'kv_store';

// --- Native IndexedDB Wrapper ---
const idb = {
    getStore: async (mode: IDBTransactionMode) => {
        return new Promise<IDBObjectStore>((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('IndexedDB is not available'));
                return;
            }
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction(STORE_NAME, mode);
                resolve(tx.objectStore(STORE_NAME));
            };
            request.onerror = () => reject(request.error);
        });
    },
    set: async (key: string, value: any) => {
        const store = await idb.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const req = store.put(value, key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    },
    get: async <T>(key: string): Promise<T | null> => {
        const store = await idb.getStore('readonly');
        return new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },
    remove: async (key: string) => {
        const store = await idb.getStore('readwrite');
        return new Promise((resolve) => {
            const req = store.delete(key);
            req.onsuccess = () => resolve(true);
        });
    },
    clear: async () => {
        const store = await idb.getStore('readwrite');
        return new Promise((resolve) => {
            const req = store.clear();
            req.onsuccess = () => resolve(true);
        });
    }
};

const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore);
    }

    // Preserve Date objects
    if (obj instanceof Date) return obj;

    // Preserve Firestore FieldValues
    if (obj.constructor && obj.constructor.name === 'FieldValue') return obj;

    const newObj: any = {};
    Object.keys(obj).forEach((key) => {
        const value = obj[key];
        if (value !== undefined) {
            newObj[key] = sanitizeForFirestore(value);
        }
    });
    return newObj;
};

const isStorageAvailable = (storage: Storage | undefined): storage is Storage => {
    if (!storage) return false;
    try {
        const testKey = '__edublay_storage_test__';
        storage.setItem(testKey, '1');
        storage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
};

const safeLocalStorage = (): Storage | undefined => {
    try { return window.localStorage; } catch { return undefined; }
};

const safeSessionStorage = (): Storage | undefined => {
    try { return window.sessionStorage; } catch { return undefined; }
};

const getUserDataKey = (user: Pick<UserDetails, 'id' | 'email'>): string => `${USER_KEY_PREFIX}${user.id || user.email || 'anonymous'}`;

const normalizeUserDetails = (firebaseUser: FirebaseUser, existing?: any): UserDetails => {
    const stored = existing?.userDetails || existing || {};
    const email = firebaseUser.email || stored.email || '';
    return {
        ...stored,
        id: firebaseUser.uid,
        name: stored.name || firebaseUser.displayName || email.split('@')[0] || 'Student',
        email,
        educationalLevel: stored.educationalLevel || EducationalLevel.OTHER,
        hasConfirmedDetails: stored.hasConfirmedDetails ?? false,
        usage: { ...initializeUsage(), ...(stored.usage || {}) },
        profilePicture: stored.profilePicture || firebaseUser.photoURL || undefined,
    };
};

const getOrCreateUserDetails = async (firebaseUser: FirebaseUser): Promise<UserDetails> => {
    const cloudData = await storageService.loadUserData(firebaseUser.uid);
    const userDetails = normalizeUserDetails(firebaseUser, cloudData);

    if (!cloudData?.userDetails) {
        globalFeedbackService.registerUser(firebaseUser.uid, userDetails.name, userDetails.email || '').catch(console.error);
        storageService.saveUserData(firebaseUser.uid, { ...(cloudData || {}), userDetails })?.catch(console.error);
    }

    await Promise.all([
        storageService.saveItem(getUserDataKey(userDetails), { ...(cloudData || {}), userDetails }),
        storageService.saveItem(SESSION_TOKEN_KEY, createToken(userDetails))
    ]);
    return userDetails;
};

export const storageService = {
    saveItem: async (key: string, value: any) => {
        const serialized = JSON.stringify(value);
        try {
            await idb.set(key, value);
        } catch (idbError) {
            try {
                const local = safeLocalStorage();
                if (isStorageAvailable(local)) local.setItem(key, serialized);
            } catch (localError: any) {
                console.error(`Storage failed for "${key}":`, localError || idbError);
            }
        }
    },
    loadItem: async <T,>(key: string): Promise<T | null> => {
        try {
            const idbValue = await idb.get<T>(key);
            if (idbValue !== null) return idbValue;
        } catch {}

        try {
            const local = safeLocalStorage();
            const localValue = local?.getItem(key);
            if (localValue) return JSON.parse(localValue) as T;
        } catch {}

        try {
            const session = safeSessionStorage();
            const sessionValue = session?.getItem(key);
            if (sessionValue) return JSON.parse(sessionValue) as T;
        } catch {}

        return null;
    },
    removeItem: async (key: string) => {
        try { safeLocalStorage()?.removeItem(key); } catch {}
        try { safeSessionStorage()?.removeItem(key); } catch {}
        try { await idb.remove(key); } catch {}
    },
    clear: async () => {
        try { safeLocalStorage()?.clear(); } catch {}
        try { safeSessionStorage()?.clear(); } catch {}
        try { await idb.clear(); } catch {}
    },
    clearAllData: async () => {
        try { safeLocalStorage()?.clear(); } catch {}
        try { safeSessionStorage()?.clear(); } catch {}
        try { await idb.clear(); } catch {}
    },
    setRedirectPending: async () => {
        // Write to ALL storage layers for maximum cross-browser compatibility
        try { safeSessionStorage()?.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1'); } catch {}
        try { safeLocalStorage()?.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1'); } catch {}
        try { await idb.set(GOOGLE_REDIRECT_PENDING_KEY, '1'); } catch {}
    },
    consumeRedirectPending: async (): Promise<boolean> => {
        // Check all storage layers — clear immediately to prevent double-consume
        let fromSession = null;
        let fromLocal = null;
        try { fromSession = safeSessionStorage()?.getItem(GOOGLE_REDIRECT_PENDING_KEY); } catch {}
        try { fromLocal = safeLocalStorage()?.getItem(GOOGLE_REDIRECT_PENDING_KEY); } catch {}
        let   fromIdb     = false;
        try {
            const idbVal = await idb.get<string>(GOOGLE_REDIRECT_PENDING_KEY);
            fromIdb = idbVal === '1';
        } catch {}

        // Clear from all stores immediately (single-use)
        try { safeSessionStorage()?.removeItem(GOOGLE_REDIRECT_PENDING_KEY); } catch {}
        try { safeLocalStorage()?.removeItem(GOOGLE_REDIRECT_PENDING_KEY); } catch {}
        try { await idb.remove(GOOGLE_REDIRECT_PENDING_KEY); } catch {}

        return fromSession === '1' || fromLocal === '1' || fromIdb;
    },
    clearRedirectPending: async () => {
        try { safeSessionStorage()?.removeItem(GOOGLE_REDIRECT_PENDING_KEY); } catch {}
        try { safeLocalStorage()?.removeItem(GOOGLE_REDIRECT_PENDING_KEY); } catch {}
    },
    removeUserLocalData: async (user: Pick<UserDetails, 'id' | 'email'>) => {
        await storageService.removeItem(getUserDataKey(user));
        if (user.email) await storageService.removeItem(`${USER_KEY_PREFIX}${user.email}`);
    },
    migrateEmailDataToUserId: async (user: UserDetails): Promise<any | null> => {
        if (!user.email) return null;
        const emailKey = `${USER_KEY_PREFIX}${user.email}`;
        const idKey = getUserDataKey(user);
        const [idData, emailData] = await Promise.all([
            storageService.loadItem<any>(idKey),
            storageService.loadItem<any>(emailKey),
        ]);
        if (idData || !emailData) return idData || null;
        await storageService.saveItem(idKey, emailData);
        return emailData;
    },
    exportAllData: async () => {
        const data: { [key: string]: any } = {};
        try {
            const local = safeLocalStorage();
            for (let i = 0; local && i < local.length; i++) {
                const key = local.key(i);
                if (key) {
                    const item = local.getItem(key);
                    try { data[key] = JSON.parse(item!); } catch { data[key] = item; }
                }
            }
        } catch {
            return null;
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edublay_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    saveUserData: async (userId: string, data: any): Promise<void> => {
        if (!userId) return;
        if (!auth.currentUser || auth.currentUser.uid !== userId) {
            console.warn("Skipping cloud sync: user not authenticated or ID mismatch.");
            return;
        }
        try {
            const safeData = sanitizeForFirestore(data);
            const userRef = doc(db, 'users', userId);
            // Return promise so callers can await if needed, but errors are caught
            return setDoc(userRef, safeData, { merge: true }).catch(err => {
                console.error('Cloud sync background write failed:', err.message);
            });
        } catch (error: any) {
            console.error('Cloud sync failed:', error.message);
        }
    },
    syncUserToCloud: async (userId: string, data: any): Promise<void> => {
        return storageService.saveUserData(userId, data);
    },
    loadUserData: async (userId: string): Promise<any | null> => {
        if (!userId) return null;
        if (!auth.currentUser || auth.currentUser.uid !== userId) {
            console.warn("Skipping cloud load: user not authenticated or ID mismatch.");
            return null;
        }
        try {
            const userRef = doc(db, 'users', userId);
            const docSnap = await getDoc(userRef);
            return docSnap.exists() ? docSnap.data() : null;
        } catch (error: any) {
            console.error('Cloud load failed:', error.message);
            return null;
        }
    },
    importAllData: async (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    for (const key of Object.keys(data)) {
                        await storageService.saveItem(key, data[key]);
                    }
                    resolve();
                } catch { reject(new Error("Failed to parse import file.")); }
            };
            reader.readAsText(file);
        });
    }
};

const createToken = (user: UserDetails): string => btoa(encodeURIComponent(JSON.stringify(user)));
const decodeToken = (token: string): UserDetails | null => {
    try { return JSON.parse(decodeURIComponent(atob(token))); } catch { return null; }
};

export const signUp = async (name: string, email: string, password_param: string, recoveryQuestion: string, recoveryAnswer: string): Promise<UserDetails> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password_param);
    const user = userCredential.user;
    await updateProfile(user, { displayName: name });
    const newUser: UserDetails = {
        id: user.uid,
        name,
        email,
        educationalLevel: EducationalLevel.OTHER, 
        hasConfirmedDetails: false, // Strictly force confirmation
        usage: initializeUsage(),
        recoveryQuestion,
        recoveryAnswer
    };
    
    // Register user for feedback global counts (fire and forget)
    globalFeedbackService.registerUser(user.uid, name, email).catch(console.error);

    // Save local data in parallel, fire and forget for cloud
    storageService.saveUserData(user.uid, { userDetails: newUser })?.catch(console.error);
    await Promise.all([
        storageService.saveItem(getUserDataKey(newUser), { userDetails: newUser }),
        storageService.saveItem(SESSION_TOKEN_KEY, createToken(newUser))
    ]);

    return newUser;
};

export const login = async (email: string, password_param: string): Promise<UserDetails> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password_param);
    const user = userCredential.user;
    
    // load local and cloud data in parallel
    const tempUserForKeys = { id: user.uid, email: user.email || email };
    const [cloudData, localData] = await Promise.all([
        storageService.loadUserData(user.uid),
        storageService.migrateEmailDataToUserId(tempUserForKeys as UserDetails)
    ]);
    
    const userDetails = normalizeUserDetails(user, cloudData);
    const idKey = getUserDataKey(userDetails);
    const legacyEmailKey = `${USER_KEY_PREFIX}${email}`;
    
    let finalData = cloudData;
    if (localData && cloudData) {
        if (localData.learningHubState?.file?.base64 && !cloudData.learningHubState?.file?.base64) {
             finalData = {
                 ...cloudData,
                 learningHubState: {
                     ...cloudData.learningHubState,
                     file: {
                         ...cloudData.learningHubState?.file,
                         base64: localData.learningHubState.file.base64
                     }
                 }
             };
        }
    } else if (localData && !cloudData) {
        finalData = localData;
    }

    const finalUserDetails = normalizeUserDetails(user, finalData || { userDetails });
    const savedData = { ...(finalData || {}), userDetails: finalUserDetails };

    // Save local data and cloud data (fire and forget for cloud)
    storageService.saveUserData(user.uid, savedData).catch(console.error);
    await Promise.all([
        storageService.saveItem(idKey, savedData),
        storageService.saveItem(legacyEmailKey, savedData),
        storageService.saveItem(SESSION_TOKEN_KEY, createToken(finalUserDetails))
    ]);

    return finalUserDetails;
};

export const getUserRecoveryData = async (email: string): Promise<{ exists: boolean; recoveryQuestion?: string; recoveryAnswer?: string } | 'unknown'> => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('userDetails.email', '==', email), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
            // fallback: try top-level email field
            const q2 = query(usersRef, where('email', '==', email), limit(1));
            const snap2 = await getDocs(q2);
            if (snap2.empty) return { exists: false };
            const data = snap2.docs[0].data();
            const ud = data?.userDetails || data;
            return { exists: true, recoveryQuestion: ud?.recoveryQuestion, recoveryAnswer: ud?.recoveryAnswer };
        }
        const data = snap.docs[0].data();
        const ud = data?.userDetails || data;
        return { exists: true, recoveryQuestion: ud?.recoveryQuestion, recoveryAnswer: ud?.recoveryAnswer };
    } catch (error: any) {
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
            console.warn("⚠️ Account lookup restricted by security rules.");
            return 'unknown';
        }
        return 'unknown';
    }
};

export const findUserByEmail = async (email: string): Promise<boolean | 'unknown'> => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email), limit(1));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error: any) {
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
            console.warn("⚠️ Account lookup restricted. Proceeding with standard reset flow.");
            return 'unknown';
        }
        console.error("❌ Error finding user:", error);
        return 'unknown';
    }
};

export const logout = async () => {
    await signOut(auth);
    await storageService.removeItem(SESSION_TOKEN_KEY);
};

export const waitForAuthInit = (): Promise<void> => {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
        });
    });
};

export const getCurrentUser = async (): Promise<UserDetails | null> => {
    await waitForAuthInit();
    // NOTE: completeGoogleRedirect() is called ONCE in App.tsx init BEFORE
    // getCurrentUser. Do NOT call it again here — getRedirectResult() is
    // single-use and calling it twice causes the second call to return null,
    // which wipes the session and sends the user back to the welcome page.

    if (!auth.currentUser) {
        await storageService.removeItem(SESSION_TOKEN_KEY);
        return null;
    }

    const token = await storageService.loadItem<string>(SESSION_TOKEN_KEY);
    const decoded = token ? decodeToken(token) : null;
    if (decoded?.id === auth.currentUser.uid) return decoded;

    return getOrCreateUserDetails(auth.currentUser);
};

export const resetPassword = async (email: string): Promise<boolean> => {
    // Simplest & most reliable approach:
    // Firebase handles the reset form on its own page (firebaseapp.com/__/auth/action).
    // After reset completes, user is redirected back to your app via continueUrl.
    // handleCodeInApp:false = Firebase page handles reset (no custom route needed).
    // The continueUrl domain MUST be in Firebase Console → Auth → Authorized Domains.
    try {
        await sendPasswordResetEmail(auth, email, {
            url: 'https://edublay-study-hub-free-iii-116620127648.us-west1.run.app/',
            handleCodeInApp: false,
        });
        return true;
    } catch (error: any) {
        // If continueUrl domain isn't authorized, fall back to plain reset
        if (error.code === 'auth/unauthorized-continue-uri' ||
            error.code === 'auth/invalid-continue-uri') {
            await sendPasswordResetEmail(auth, email);
            return true;
        }
        throw error;
    }
};


export const verifyResetCode = (code: string): Promise<string> => verifyPasswordResetCode(auth, code);
export const confirmPasswordReset = (code: string, newPassword: string): Promise<void> => firebaseConfirmPasswordReset(auth, code, newPassword);

// Redirect is ONLY correct for the Android INSTALLED app (standalone display),
// where a popup would open the system browser and never return to the app.
// We do NOT use redirect in mobile browsers: this project's auth domain
// (*.firebaseapp.com) is a DIFFERENT site from the app (*.run.app), and iOS
// blocks the cross-site storage the redirect handshake needs — so on iPhone the
// redirect never completes and the sign-in page LOOPS. A popup delivers the
// credential straight back to the open page, so it works on mobile browsers too.
const isAndroidInstalledApp = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = (navigator.userAgent || '').toLowerCase();
    const isStandalone =
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        (navigator as any).standalone === true;
    return isStandalone && /android/i.test(ua);
};

export const signInWithGoogle = async (): Promise<UserDetails | null> => {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) ||
        (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    const isStandalone = typeof window !== 'undefined' &&
        (window.matchMedia?.('(display-mode: standalone)')?.matches || (navigator as any).standalone === true);

    // ── iOS or Android INSTALLED app: must use redirect ──────────────────────
    if (isStandalone && (isIOS || isAndroidInstalledApp())) {
        await storageService.setRedirectPending();
        try {
            await signInWithRedirect(auth, provider);
        } catch (err) {
            await storageService.clearRedirectPending();
            throw err;
        }
        // Page is navigating away — keep the caller in its loading state so it
        // doesn't re-render or call onLogin (which looked like a "refresh").
        return new Promise<UserDetails | null>(() => {});
    }

    // ── All browsers (mobile + desktop) → POPUP ──────────────────────────────
    try {
        const result = await signInWithPopup(auth, provider);
        return getOrCreateUserDetails(result.user);
    } catch (err: any) {
        const code = (err?.code || '').toLowerCase();

        // User cancelled — bubble up silently.
        if (
            code.includes('popup-closed-by-user') ||
            code.includes('cancelled-popup-request') ||
            code.includes('user-cancelled')
        ) {
            throw err;
        }

        // Popup blocked. On DESKTOP we can safely fall back to redirect; on MOBILE
        // we must NOT (redirect loops on iOS) — guide the user instead.
        if (code.includes('popup-blocked')) {
            const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua) || isIOS;
            if (isMobile) {
                throw new Error(
                    'Your browser blocked the Google sign-in window. Please allow pop-ups for this site and try again, or sign in with your email and password.'
                );
            }
            await storageService.setRedirectPending();
            try {
                await signInWithRedirect(auth, provider);
            } catch (redirectErr) {
                await storageService.clearRedirectPending();
                throw redirectErr;
            }
            return new Promise<UserDetails | null>(() => {});
        }

        // In-app browsers (Instagram / TikTok / Facebook) can't do Google OAuth.
        if (code.includes('operation-not-supported') || code.includes('web-storage-unsupported')) {
            throw new Error(
                "Google Sign-In isn't supported in this browser. Please open EduBlay in Chrome, Safari, or Firefox — or sign in with your email and password."
            );
        }

        throw err;
    }
};


export const completeGoogleRedirect = async (): Promise<UserDetails | null> => {
    // ── CRITICAL: only call getRedirectResult when we KNOW a redirect happened ──
    // Calling getRedirectResult() on every page load (even after popup sign-in
    // or normal email login) can return stale data or interfere with the current
    // auth state — breaking sign-in on ALL devices including desktop.
    // We only call it when setRedirectPending() was explicitly called first.
    const isPending = await storageService.consumeRedirectPending();
    if (!isPending) return null;

    try {
        const result = await getRedirectResult(auth);
        if (result?.user) return getOrCreateUserDetails(result.user);
        // Redirect completed but result missing — check if Firebase already
        // restored the session via onAuthStateChanged
        if (auth.currentUser) return getOrCreateUserDetails(auth.currentUser);
        return null;
    } catch {
        return null;
    }
};