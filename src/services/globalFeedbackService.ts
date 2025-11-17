// FIX: Changed imports to use the 'compat' path for Firebase v8 compatibility.
import { db } from './firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// ============================================
// ENHANCED INTERFACES
// ============================================

interface GlobalStats {
    totalRatings: number;
    totalRatingSum: number;
    totalComments: number;
    activeUsers: number; // NOW STORED IN FIREBASE!
    studyMaterials: number; // NOW STORED IN FIREBASE!
}

interface Comment {
    id: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: any;
    likes: number;
}

interface UserFeedbackData {
    rating: number;
    likedComments: string[];
}

interface UserProfile {
    id: string;
    name: string;
    email: string;
    joinedAt: any;
    lastActive: any;
    uploadedMaterials: number;
}

// ============================================
// UPGRADED GLOBAL FEEDBACK SERVICE
// TRUE WORLDWIDE STATISTICS
// ============================================

export const globalFeedbackService = {
    
    // ============================================
    // USER REGISTRATION & TRACKING (GLOBAL)
    // ============================================
    
    /**
     * Register a new user globally (ALL users counted in Firebase)
     * Call this when user signs up or first logs in
     */
    registerUser: async (userId: string, userName: string, email: string): Promise<void> => {
        try {
            const userRef = db.collection("users").doc(userId);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                // New user - add to Firebase
                await userRef.set({
                    id: userId,
                    name: userName,
                    email: email,
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                    uploadedMaterials: 0
                });
                
                // Increment global active users count
                const statsRef = db.collection("feedback_stats").doc("summary");
                await statsRef.update({
                    activeUsers: firebase.firestore.FieldValue.increment(1)
                });
                
                console.log('✅ New user registered globally:', userName);
            } else {
                // Existing user - update last active
                await userRef.update({
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('✅ User activity updated:', userName);
            }
        } catch (error) {
            console.error('Error registering user:', error);
            throw error;
        }
    },
    
    /**
     * Track when user uploads study material (increments global count)
     */
    trackMaterialUpload: async (userId: string): Promise<void> => {
        try {
            // Update user's material count
            const userRef = db.collection("users").doc(userId);
            await userRef.update({
                uploadedMaterials: firebase.firestore.FieldValue.increment(1),
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Increment global study materials count
            const statsRef = db.collection("feedback_stats").doc("summary");
            await statsRef.update({
                studyMaterials: firebase.firestore.FieldValue.increment(1)
            });
            
            console.log('✅ Material upload tracked globally');
        } catch (error) {
            console.error('Error tracking material upload:', error);
            throw error;
        }
    },
    
    // ============================================
    // GET GLOBAL STATS (REAL-TIME FROM FIREBASE)
    // ============================================
    
    /**
     * Subscribe to real-time global stats updates
     * Updates automatically when ANY user worldwide changes data
     */
    subscribeToGlobalStats: (callback: (stats: any) => void): (() => void) => {
        const statsRef = db.collection("feedback_stats").doc("summary");
        
        const unsubscribe = statsRef.onSnapshot((doc) => {
            if (doc.exists) {
                const stats = doc.data() as GlobalStats;
                const averageRating = stats.totalRatings > 0 
                    ? stats.totalRatingSum / stats.totalRatings 
                    : 0;
                
                callback({
                    activeUsers: stats.activeUsers || 0,
                    studyMaterials: stats.studyMaterials || 0,
                    totalRatings: stats.totalRatings || 0,
                    averageRating: parseFloat(averageRating.toFixed(1)),
                    satisfaction: averageRating > 0 
                        ? Math.round((averageRating / 5) * 100) 
                        : 0,
                    totalComments: stats.totalComments || 0
                });
            }
        }, (error) => {
            console.error('Error subscribing to global stats:', error);
        });
        
        return unsubscribe;
    },
    
    // ============================================
    // COMMENTS (VISIBLE TO ALL USERS)
    // ============================================
    
    /**
     * Subscribe to all public comments (real-time updates)
     */
    subscribeToComments: (callback: (comments: Comment[]) => void): (() => void) => {
        const commentsQuery = db.collection("comments")
            .orderBy("timestamp", "desc")
            .limit(50); // Limit to latest 50 comments for performance
        
        const unsubscribe = commentsQuery.onSnapshot((snapshot) => {
            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Comment));
            callback(comments);
        }, (error) => {
            console.error('Error subscribing to comments:', error);
        });
        
        return unsubscribe;
    },
    
    /**
     * Post a new comment (visible to ALL users)
     */
    postComment: async (userId: string, userName: string, text: string): Promise<void> => {
        try {
            // Add comment to global collection
            await db.collection("comments").add({
                userId,
                userName,
                text,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0
            });

            // Increment global comment count
            const statsRef = db.collection("feedback_stats").doc("summary");
            await statsRef.update({
                totalComments: firebase.firestore.FieldValue.increment(1)
            });
            
            console.log('✅ Comment posted globally');
        } catch (error) {
            console.error('Error posting comment:', error);
            throw error;
        }
    },
    
    /**
     * Like/Unlike a comment
     */
    likeComment: async (userId: string, commentId: string): Promise<void> => {
        try {
            const userFeedbackRef = db.collection("users_feedback").doc(userId);
            const commentRef = db.collection("comments").doc(commentId);

            await db.runTransaction(async (transaction) => {
                const userFeedbackDoc = await transaction.get(userFeedbackRef);
                const commentDoc = await transaction.get(commentRef);

                if (!commentDoc.exists) {
                    throw new Error("Comment does not exist!");
                }

                const likedComments = userFeedbackDoc.exists 
                    ? userFeedbackDoc.data()?.likedComments || [] 
                    : [];
                const hasLiked = likedComments.includes(commentId);
                
                const currentLikes = commentDoc.data()?.likes || 0;

                if (hasLiked) {
                    // Unlike
                    transaction.update(commentRef, { 
                        likes: Math.max(0, currentLikes - 1) 
                    });
                    transaction.set(userFeedbackRef, { 
                        likedComments: firebase.firestore.FieldValue.arrayRemove(commentId) 
                    }, { merge: true });
                } else {
                    // Like
                    transaction.update(commentRef, { 
                        likes: currentLikes + 1 
                    });
                    transaction.set(userFeedbackRef, { 
                        likedComments: firebase.firestore.FieldValue.arrayUnion(commentId) 
                    }, { merge: true });
                }
            });
            
            console.log('✅ Comment like toggled');
        } catch (error) {
            console.error('Error liking comment:', error);
            throw error;
        }
    },
    
    // ============================================
    // RATINGS (GLOBAL)
    // ============================================
    
    /**
     * Subscribe to a user's feedback data in real-time.
     * Returns an unsubscribe function.
     */
    subscribeToUserFeedback: (userId: string, callback: (feedback: UserFeedbackData) => void): (() => void) => {
        const userFeedbackRef = db.collection("users_feedback").doc(userId);
        
        const unsubscribe = userFeedbackRef.onSnapshot((doc) => {
            if (doc.exists) {
                callback(doc.data() as UserFeedbackData);
            } else {
                // Document doesn't exist, so provide default empty state
                callback({ rating: 0, likedComments: [] });
            }
        }, (error) => {
            console.error("Error subscribing to user feedback:", error);
            // In case of error (like permissions), provide a default state
            callback({ rating: 0, likedComments: [] });
        });
        
        return unsubscribe;
    },

    /**
     * Submit a rating (affects global average)
     */
    submitRating: async (userId: string, rating: number): Promise<void> => {
        try {
            const statsRef = db.collection("feedback_stats").doc("summary");
            const userFeedbackRef = db.collection("users_feedback").doc(userId);

            await db.runTransaction(async (transaction) => {
                const userFeedbackDoc = await transaction.get(userFeedbackRef);
                
                // Prevent re-rating
                if (userFeedbackDoc.exists && userFeedbackDoc.data()?.rating > 0) {
                    throw new Error("You have already rated.");
                }

                const statsDoc = await transaction.get(statsRef);
                const currentStats = statsDoc.exists 
                    ? statsDoc.data() as GlobalStats
                    : { totalRatings: 0, totalRatingSum: 0, totalComments: 0, activeUsers: 0, studyMaterials: 0 };

                const newTotalRatings = currentStats.totalRatings + 1;
                const newTotalRatingSum = currentStats.totalRatingSum + rating;

                transaction.set(statsRef, {
                    ...currentStats,
                    totalRatings: newTotalRatings,
                    totalRatingSum: newTotalRatingSum
                }, { merge: true });

                if (userFeedbackDoc.exists) {
                    transaction.update(userFeedbackRef, { rating: rating });
                } else {
                    transaction.set(userFeedbackRef, { rating: rating, likedComments: [] });
                }
            });
            
            console.log('✅ Rating submitted globally');
        } catch (error) {
            console.error('Error submitting rating:', error);
            throw error;
        }
    },
};

console.log('✅ Upgraded Global Feedback Service initialized - TRUE worldwide statistics!');