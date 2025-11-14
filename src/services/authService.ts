import type { UserDetails } from '../../types.ts';
import { EducationalLevel } from '../../types.ts';
import { globalFeedbackService } from './globalFeedbackService';
import { initializeUsage } from '../../lib/usageManager';

// --- Centralized Storage Service ---

const STORAGE_KEYS = [
    'users',
    'sessionToken',
    'usersData', // New key for storing all user-specific data
    'tutorialVideoUrl',
    'welcomeComplete',
    'eduBlay_feedbackData',
    // Old keys for migration/cleanup
    'userDetails',
    'savedTimetables',
    'notes',
    'smartPlan',
    'notificationSettings',
    'trackedData',
    'quizProgress',
    'currentUser',
    'language',
    'theme',
    'colorTheme'
];

export const storageService = {
    saveItem: (key: string, value: any) => {
        if (!STORAGE_KEYS.includes(key)) {
            console.warn(`Attempted to save to an unknown storage key: ${key}`);
            return;
        }
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Failed to save item "${key}" to localStorage`, error);
        }
    },

    loadItem: <T,>(key: string): T | null => {
        if (!STORAGE_KEYS.includes(key)) {
            console.warn(`Attempted to load from an unknown storage key: ${key}`);
            return null;
        }
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Failed to load item "${key}" from localStorage`, error);
            return null;
        }
    },

    loadAllData: (): { [key: string]: any } => {
        const data: { [key: string]: any } = {};
        STORAGE_KEYS.forEach(key => {
            try {
                const item = localStorage.getItem(key);
                if (item) {
                    data[key] = JSON.parse(item);
                }
            } catch (error) {
                console.error(`Failed to load and parse item "${key}" from localStorage`, error);
            }
        });
        return data;
    },

    saveAllData: (data: { [key: string]: any }) => {
        Object.keys(data).forEach(key => {
            if (STORAGE_KEYS.includes(key) && data[key] !== undefined) {
                try {
                    localStorage.setItem(key, JSON.stringify(data[key]));
                } catch (error) {
                    console.error(`Failed to save item "${key}" to localStorage`, error);
                }
            }
        });
    },

    removeItem: (key: string) => {
        if (!STORAGE_KEYS.includes(key)) {
            console.warn(`Attempted to remove an unknown storage key: ${key}`);
            return;
        }
        localStorage.removeItem(key);
    },

    exportAllData: () => {
        const data: { [key: string]: any } = {};
        STORAGE_KEYS.forEach(key => {
            const item = localStorage.getItem(key);
            if (item) {
                try {
                    data[key] = JSON.parse(item);
                } catch {
                    data[key] = item; // Store as raw string if not JSON
                }
            }
        });
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

    importAllData: (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    Object.keys(data).forEach(key => {
                        if (STORAGE_KEYS.includes(key)) {
                            storageService.saveItem(key, data[key]);
                        }
                    });
                    resolve();
                } catch (error) {
                    reject(new Error("Failed to parse import file. It may be corrupted."));
                }
            };
            reader.onerror = () => reject(new Error("Failed to read the import file."));
            reader.readAsText(file);
        });
    },

    clearAllData: () => {
        STORAGE_KEYS.forEach(key => {
            localStorage.removeItem(key);
        });
    }
};

// --- Authentication Logic using Storage Service ---

const SESSION_TOKEN_KEY = 'sessionToken';

type UserRecord = UserDetails & { id: string; password?: string };

const getUsers = (): UserRecord[] => {
    return storageService.loadItem<UserRecord[]>('users') || [];
};

const saveUsers = (users: UserRecord[]) => {
    storageService.saveItem('users', users);
};

const createToken = (user: UserDetails): string => {
    try {
        return btoa(JSON.stringify(user));
    } catch (e) {
        const jsonStr = JSON.stringify(user);
        const uint8Array = new TextEncoder().encode(jsonStr);
        let binaryString = '';
        uint8Array.forEach((byte) => {
            binaryString += String.fromCharCode(byte);
        });
        return btoa(binaryString);
    }
};

const decodeToken = (token: string): UserDetails | null => {
    try {
        return JSON.parse(atob(token));
    } catch (e) {
        try {
            const binaryString = atob(token);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }
            const jsonStr = new TextDecoder().decode(uint8Array);
            return JSON.parse(jsonStr);
        } catch (err) {
            console.error("Failed to decode token:", err);
            return null;
        }
    }
};

export const signUp = async (
    name: string,
    email: string,
    password_param: string,
    recoveryQuestion: string,
    recoveryAnswer: string
): Promise<UserDetails> => {
    return new Promise((resolve, reject) => {
        setTimeout(async () => { // Make async
            try {
                const users = getUsers();
                if (users.some(user => user.email === email)) {
                    reject(new Error('Email already registered'));
                    return;
                }
                
                const userId = Date.now().toString(); // Use a consistent ID
                // FIX: Added missing 'usage' property to initialize UserDetails correctly.
                const newUser: UserRecord = {
                    id: userId,
                    name,
                    email,
                    password: password_param,
                    recoveryQuestion,
                    recoveryAnswer,
                    educationalLevel: EducationalLevel.UNDERGRADUATE,
                    // FIX: Initialize subscription tier for new users.
                    subscriptionTier: 'free',
                    subscriptionStatus: 'active',
                    usage: initializeUsage(),
                };
                
                users.push(newUser);
                saveUsers(users);

                // FIX: Register user in the global feedback system to increment the count
                await globalFeedbackService.registerUser(userId, name, email);

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { password, ...userSession } = newUser;
                const token = createToken(userSession as UserDetails);
                storageService.saveItem(SESSION_TOKEN_KEY, token);

                resolve(userSession as UserDetails);
            } catch (error) {
                reject(error);
            }
        }, 500);
    });
};

export const login = async (email: string, password_param: string): Promise<UserDetails> => {
     return new Promise((resolve, reject) => {
        setTimeout(async () => { // Make async
            try {
                const users = getUsers();
                const user = users.find(u => u.email === email && u.password === password_param);
                
                if (!user) {
                    reject(new Error('Invalid email or password'));
                    return;
                }

                // FIX: Update activity in the global feedback system (idempotent)
                if(user.id && user.name && user.email) {
                    await globalFeedbackService.registerUser(user.id, user.name, user.email);
                }

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { password, ...userSession } = user;

                // FIX: Ensure subscription tier exists for older users for backward compatibility.
                if (!userSession.subscriptionTier) {
                    userSession.subscriptionTier = 'free';
                    userSession.subscriptionStatus = 'active';
                }

                const token = createToken(userSession as UserDetails);
                storageService.saveItem(SESSION_TOKEN_KEY, token);

                resolve(userSession as UserDetails);
            } catch (error) {
                reject(error);
            }
        }, 500);
    });
};

export const findUserByEmail = async (email: string): Promise<boolean> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const users = getUsers();
            resolve(users.some(u => u.email === email));
        }, 300);
    });
};

export const verifyRecoveryAnswer = async (email: string, question: string, answer: string): Promise<boolean> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const users = getUsers();
            const user = users.find(u => u.email === email);
            if (user && user.recoveryQuestion === question && user.recoveryAnswer?.toLowerCase() === answer.toLowerCase()) {
                resolve(true);
            } else {
                resolve(false);
            }
        }, 300);
    });
};

export const resetPassword = async (email: string, newPassword: string): Promise<boolean> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const users = getUsers();
            const userIndex = users.findIndex(u => u.email === email);
            if (userIndex !== -1) {
                users[userIndex].password = newPassword;
                saveUsers(users);
                resolve(true);
            } else {
                resolve(false);
            }
        }, 300);
    });
}

export const socialLogin = async (provider: string): Promise<UserDetails> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // FIX: Added missing 'usage' property to initialize UserDetails correctly.
            const user: UserDetails = {
                name: `Alex Doe`,
                email: `alex.doe@example.com`,
                educationalLevel: EducationalLevel.UNDERGRADUATE,
                profilePicture: `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzc1NzU3NSI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==`,
                subscriptionTier: 'free',
                subscriptionStatus: 'active',
                usage: initializeUsage(),
            };
            
            const token = createToken(user);
            storageService.saveItem(SESSION_TOKEN_KEY, token);
            
            resolve(user);
        }, 1000); 
    });
};


export const logout = () => {
    storageService.removeItem(SESSION_TOKEN_KEY);
};

export const getCurrentUser = (): UserDetails | null => {
    const token = storageService.loadItem<string>(SESSION_TOKEN_KEY);

    if (token) {
        const user = decodeToken(token);
        if (user) return user;
    }
    
    // Legacy migration from before token system
    const oldUser = storageService.loadItem<UserDetails>('currentUser');
    if (oldUser) {
        const userWithTier = { ...oldUser, subscriptionTier: oldUser.subscriptionTier || 'free' } as UserDetails;
        const newToken = createToken(userWithTier);
        storageService.saveItem(SESSION_TOKEN_KEY, newToken);
        storageService.removeItem('currentUser');
        return userWithTier;
    }
    
    return null;
};
