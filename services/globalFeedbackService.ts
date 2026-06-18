import { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    limit, 
    increment, 
    serverTimestamp, 
    updateDoc,
    arrayUnion,
    arrayRemove,
    runTransaction
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

interface GlobalStats {
    totalRatings: number;
    totalRatingSum: number;
    totalComments: number;
    activeUsers: number;
    studyMaterials: number;
    lastUpdated?: number;
}

export const globalFeedbackService = {
    /**
     * Registers a user and increments global user count atomically if they are new.
     */
    registerUser: async (userId: string, userName: string, email: string): Promise<void> => {
        if (!navigator.onLine) return;
        const effectiveUserId = auth.currentUser?.uid || userId;
        try {
            const userRef = doc(db, "users", effectiveUserId);
            const userDoc = await getDoc(userRef);
            
            // Only increment if the user document doesn't already exist in Firestore
            if (!userDoc.exists()) {
                const statsRef = doc(db, "feedback_stats", "summary");
                
                // 1. Create the user record
                await setDoc(userRef, {
                    id: effectiveUserId,
                    name: userName,
                    email: email,
                    joinedAt: serverTimestamp(),
                    uploadedMaterials: 0
                });
                
                // 2. Atomically increment the global active users counter
                await setDoc(statsRef, {
                    activeUsers: increment(1),
                    lastUpdated: Date.now()
                }, { merge: true });
                
                console.log('✅ New user registered globally. Active users incremented.');
            }
        } catch (error: any) {
            console.error('❌ GlobalFeedback Error (registerUser):', error);
        }
    },
    
    /**
     * Increments material count atomically.
     */
    trackMaterialUpload: async (userId: string): Promise<void> => {
        if (!navigator.onLine) return;
        const effectiveUserId = auth.currentUser?.uid || userId;
        try {
            const userRef = doc(db, "users", effectiveUserId);
            const statsRef = doc(db, "feedback_stats", "summary");
            
            // Update user specific count
            await setDoc(userRef, { 
                uploadedMaterials: increment(1) 
            }, { merge: true });
            
            // Update global count
            await setDoc(statsRef, { 
                studyMaterials: increment(1),
                lastUpdated: Date.now() 
            }, { merge: true });
        } catch (error: any) {
            console.error('❌ GlobalFeedback Error (trackMaterialUpload):', error);
        }
    },
    
    subscribeToGlobalStats: (callback: (stats: any) => void) => {
        const statsRef = doc(db, "feedback_stats", "summary");
        return onSnapshot(statsRef, (docSnap) => {
            if (docSnap.exists()) {
                const s = docSnap.data() as GlobalStats;
                const totalRatings = s.totalRatings || 0;
                const totalRatingSum = s.totalRatingSum || 0;
                const avg = totalRatings > 0 ? totalRatingSum / totalRatings : 0;
                
                callback({
                    activeUsers: s.activeUsers || 0,
                    studyMaterials: s.studyMaterials || 0,
                    totalRatings: totalRatings,
                    averageRating: parseFloat(avg.toFixed(1)),
                    satisfaction: totalRatings > 0 ? Math.round((avg / 5) * 100) : 0,
                    totalComments: s.totalComments || 0
                });
            } else {
                callback({ activeUsers: 0, studyMaterials: 0, totalRatings: 0, averageRating: 0, satisfaction: 0, totalComments: 0 });
            }
        }, (error) => {
            console.error("❌ GlobalFeedback Error (subscribeToGlobalStats):", error);
        });
    },
    
    subscribeToComments: (callback: (comments: any[]) => void) => {
        const q = query(collection(db, "comments"), orderBy("timestamp", "desc"), limit(50));
        return onSnapshot(q, (snap) => {
            callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => {
            console.error("❌ GlobalFeedback Error (subscribeToComments):", error);
        });
    },
    
    postComment: async (userId: string, userName: string, text: string) => {
        if (!navigator.onLine) throw new Error("Offline");
        const statsRef = doc(db, "feedback_stats", "summary");
        const newCommentRef = doc(collection(db, "comments"));
        
        try {
            await setDoc(newCommentRef, {
                userId,
                userName,
                text,
                timestamp: serverTimestamp(),
                likes: 0
            });
            
            await setDoc(statsRef, { totalComments: increment(1) }, { merge: true });
        } catch (error: any) {
            console.error("❌ GlobalFeedback Error (postComment):", error);
        }
    },

    submitRating: async (userId: string, rating: number) => {
        if (!navigator.onLine) throw new Error("Offline");
        const effectiveUserId = auth.currentUser?.uid || userId;
        const statsRef = doc(db, "feedback_stats", "summary");
        const userFeedbackRef = doc(db, "users_feedback", effectiveUserId);

        try {
            await runTransaction(db, async (transaction) => {
                const feedbackDoc = await transaction.get(userFeedbackRef);
                const oldRating = feedbackDoc.exists() ? feedbackDoc.data()?.rating || 0 : 0;
                
                if (oldRating > 0) {
                    if (oldRating !== rating) {
                        transaction.set(statsRef, {
                            totalRatingSum: increment(rating - oldRating),
                            lastUpdated: Date.now()
                        }, { merge: true });
                        transaction.set(userFeedbackRef, { rating }, { merge: true });
                    }
                    return; // silently succeed for already rated
                }
                
                transaction.set(statsRef, {
                    totalRatings: increment(1),
                    totalRatingSum: increment(rating),
                    lastUpdated: Date.now()
                }, { merge: true });
                transaction.set(userFeedbackRef, { rating }, { merge: true });
            });
        } catch (error: any) {
            console.error("❌ GlobalFeedback Error (submitRating):", error);
            throw error;
        }
    },

    subscribeToUserFeedback: (userId: string, callback: (feedback: any) => void) => {
        const effectiveUserId = auth.currentUser?.uid || userId;
        const userFeedbackRef = doc(db, "users_feedback", effectiveUserId);
        return onSnapshot(userFeedbackRef, (docSnap) => {
            callback(docSnap.exists() ? docSnap.data() : { rating: 0, likedComments: [] });
        }, (error) => {
            console.error("❌ GlobalFeedback Error (subscribeToUserFeedback):", error);
        });
    },

    likeComment: async (userId: string, commentId: string) => {
        if (!navigator.onLine) return;
        const effectiveUserId = auth.currentUser?.uid || userId;
        const userFeedbackRef = doc(db, "users_feedback", effectiveUserId);
        const commentRef = doc(db, "comments", commentId);

        try {
            await runTransaction(db, async (transaction) => {
                const fbDoc = await transaction.get(userFeedbackRef);
                const liked = fbDoc.exists() ? (fbDoc.data()?.likedComments || []).includes(commentId) : false;
                
                transaction.set(userFeedbackRef, {
                    likedComments: liked ? arrayRemove(commentId) : arrayUnion(commentId)
                }, { merge: true });
                
                transaction.update(commentRef, {
                    likes: increment(liked ? -1 : 1)
                });
            });
        } catch (error: any) {
            console.error("❌ GlobalFeedback Error (likeComment):", error);
        }
    }
};