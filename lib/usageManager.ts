import type { UserUsage, FeatureName, UsageLimit, UsageRecord } from '../types';

// Define limits for each feature for the FREE TIER
const FEATURE_LIMITS: Record<FeatureName, UsageLimit> = {
  timetables: { limit: 5, period: 'month' },
  uploads: { limit: 5, period: 'month' },
  quizzes: { limit: 5, period: 'month' },
  solves: { limit: 5, period: 'day' },
};

/**
 * Initializes the usage object for a new user.
 */
export const initializeUsage = (): UserUsage => {
    const now = new Date().toISOString();
    return {
        timetables: { count: 0, lastReset: now },
        uploads: { count: 0, lastReset: now },
        quizzes: { count: 0, lastReset: now },
        solves: { count: 0, lastReset: now },
        rewards: {},
    };
};

/**
 * Checks if a user's usage needs to be reset based on the feature's period.
 * Returns a new, reset usage record if needed, otherwise returns the original.
 */
const getNormalizedUsage = (record: UsageRecord, limit: UsageLimit): UsageRecord => {
    const now = new Date();
    const lastReset = new Date(record.lastReset);

    let shouldReset = false;

    if (limit.period === 'day') {
        if (now.toDateString() !== lastReset.toDateString()) {
            shouldReset = true;
        }
    } else if (limit.period === 'month') {
        if (now.getFullYear() > lastReset.getFullYear() || now.getMonth() > lastReset.getMonth()) {
            shouldReset = true;
        }
    }

    if (shouldReset) {
        return { count: 0, lastReset: now.toISOString() };
    }
    return record;
};

/**
 * Checks if a user can use a specific feature and returns their current usage status.
 */
export const checkUsage = (usage: UserUsage, feature: FeatureName): { canUse: boolean; used: number; limit: number; period: 'day' | 'month' | 'total' } => {
    const limitDef = FEATURE_LIMITS[feature];
    const currentRecord = getNormalizedUsage(usage[feature], limitDef);
    const bonusUses = usage.rewards?.[feature] || 0;
    const totalLimit = limitDef.limit + bonusUses;
    
    return {
        canUse: currentRecord.count < totalLimit,
        used: currentRecord.count,
        limit: totalLimit,
        period: limitDef.period,
    };
};

/**
 * Increments the usage count for a feature.
 * Returns the updated UserUsage object.
 */
export const incrementUsage = (usage: UserUsage, feature: FeatureName): UserUsage => {
    const limitDef = FEATURE_LIMITS[feature];
    const currentRecord = getNormalizedUsage(usage[feature], limitDef);
    
    return {
        ...usage,
        [feature]: {
            ...currentRecord,
            count: currentRecord.count + 1,
        },
    };
};

/**
 * Grants a reward (bonus uses) for a specific feature.
 * Returns the updated UserUsage object.
 */
export const grantReward = (usage: UserUsage, feature: FeatureName, amount: number): UserUsage => {
    const currentRewards = usage.rewards?.[feature] || 0;
    return {
        ...usage,
        rewards: {
            ...usage.rewards,
            [feature]: currentRewards + amount,
        },
    };
};