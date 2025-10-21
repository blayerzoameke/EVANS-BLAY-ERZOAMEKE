import { DayOfWeek } from '../types.ts';

/**
 * Returns the day of the week from a Date object as a DayOfWeek enum string.
 * @param date The date to get the day from.
 * @returns The day of the week (e.g., 'Monday').
 */
export const getDayOfWeek = (date: Date): DayOfWeek => {
    const dayIndex = date.getDay(); // Sunday - 0, Monday - 1, ...
    const days: DayOfWeek[] = [DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday];
    return days[dayIndex];
};

/**
 * Parses a time string (e.g., "09:00 AM") and returns a Date object for today with that time.
 * @param timeStr The time string to parse.
 * @param baseDate The date to use as the base (defaults to now).
 * @returns A Date object representing the time on the given base date.
 */
export const parseTimeToDate = (timeStr: string, baseDate: Date = new Date()): Date => {
    if (!timeStr) return baseDate;

    try {
        const timeLower = timeStr.toLowerCase().replace(/\s/g, '');
        const isPM = timeLower.includes('pm');
        const isAM = timeLower.includes('am');
        const timeOnly = timeLower.replace('am', '').replace('pm', '');
        
        const [hourStr, minuteStr] = timeOnly.split(':');
        
        let hours = parseInt(hourStr, 10);
        const minutes = parseInt(minuteStr || '0', 10);

        if (isNaN(hours) || isNaN(minutes)) {
            return baseDate;
        }

        if (isPM && hours < 12) {
            hours += 12;
        }
        if (isAM && hours === 12) { // Midnight case
            hours = 0;
        }
        
        const newDate = new Date(baseDate.getTime());
        newDate.setHours(hours, minutes, 0, 0);

        return newDate;

    } catch (e) {
        console.error("Failed to parse time string:", timeStr, e);
        return baseDate;
    }
};

/**
 * Converts a time string (e.g., "09:00 AM") into the total number of minutes from midnight.
 * @param time The time string to parse.
 * @returns The total number of minutes.
 */
export const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    try {
        const timeLower = time.toLowerCase().replace(/\s/g, '');
        const isPM = timeLower.includes('pm');
        const isAM = timeLower.includes('am');

        const timeOnly = timeLower.replace('am', '').replace('pm', '');
        
        let [hourStr, minuteStr] = timeOnly.split(':');
        
        if (!minuteStr) minuteStr = '0';

        let hours = parseInt(hourStr, 10);
        const minutes = parseInt(minuteStr || '0', 10);

        if (isNaN(hours) || isNaN(minutes)) {
            console.warn(`Could not parse time: ${time}`);
            return 0;
        }
        
        if (isPM && hours < 12) {
            hours += 12;
        }
        if (isAM && hours === 12) { // Midnight case
            hours = 0;
        }

        return hours * 60 + minutes;

    } catch (e) {
        console.error("Failed to parse time string:", time, e);
        return 0;
    }
};
