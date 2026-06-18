import { DayOfWeek } from '../types';

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

export const minutesToTime = (minutes: number): string => {
    let h = Math.floor(minutes / 60) % 24;
    let m = minutes % 60;
    const isPM = h >= 12;
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    return `${hStr}:${mStr} ${isPM ? 'PM' : 'AM'}`;
};

const dayNameToIndex: Record<DayOfWeek, number> = {
    [DayOfWeek.Sunday]: 0,
    [DayOfWeek.Monday]: 1,
    [DayOfWeek.Tuesday]: 2,
    [DayOfWeek.Wednesday]: 3,
    [DayOfWeek.Thursday]: 4,
    [DayOfWeek.Friday]: 5,
    [DayOfWeek.Saturday]: 6,
};

export const getNextDateForDay = (day: DayOfWeek, timeStr: string): Date => {
    const targetDayIndex = dayNameToIndex[day];
    const now = new Date();
    const currentDayIndex = now.getDay();
    let dayDifference = targetDayIndex - currentDayIndex;

    const timeInMinutes = timeToMinutes(timeStr);
    const nowInMinutes = now.getHours() * 60 + now.getMinutes();
    
    if (dayDifference === 0 && timeInMinutes <= nowInMinutes) {
        // If it's for today but the time has passed, schedule for next week
        dayDifference += 7;
    } else if (dayDifference < 0) {
        // If it's for a day that has passed this week, schedule for next week
        dayDifference += 7;
    }

    const targetDate = new Date();
    targetDate.setDate(now.getDate() + dayDifference);
    
    return parseTimeToDate(timeStr, targetDate);
};

export async function processAndResizeImage(
    file: File, 
    options: { maxWidth: number; maxHeight: number; quality: number } = { maxWidth: 1920, maxHeight: 1920, quality: 0.9 }
): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (!event.target?.result) return reject(new Error("FileReader error: result is null."));
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > options.maxWidth) {
                        height *= options.maxWidth / width;
                        width = options.maxWidth;
                    }
                } else {
                    if (height > options.maxHeight) {
                        width *= options.maxHeight / height;
                        height = options.maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Could not get canvas context for image resizing.'));
                
                ctx.drawImage(img, 0, 0, width, height);

                // Use JPEG for better compression, especially for photos.
                const dataUrl = canvas.toDataURL('image/jpeg', options.quality);
                const base64 = dataUrl.split(',')[1];
                resolve({ base64, mimeType: 'image/jpeg', dataUrl });
            };
            img.onerror = (e) => reject(new Error(`Image load error: ${e}`));
            img.src = event.target.result as string;
        };
        reader.onerror = (e) => reject(new Error(`FileReader error: ${e}`));
        reader.readAsDataURL(file);
    });
}