// FIX: Replaced incorrect component definition with actual type definitions to resolve all import errors.

export type Language = string;
export type Theme = 'light' | 'dark' | 'system';

export enum EducationalLevel {
    HIGH_SCHOOL = 'highschool',
    UNDERGRADUATE = 'undergraduate',
    POSTGRADUATE = 'postgraduate',
    PHD = 'phd',
    OTHER = 'other',
}

export interface UserDetails {
    name: string;
    educationalLevel: EducationalLevel;
    institution?: string;
    country?: string;
    email?: string;
    profilePicture?: string | null;
    institutionLogo?: string | null;
    biography?: string;
}

export enum DayOfWeek {
    Monday = "Monday",
    Tuesday = "Tuesday",
    Wednesday = "Wednesday",
    Thursday = "Thursday",
    Friday = "Friday",
    Saturday = "Saturday",
    Sunday = "Sunday",
}

export enum ActivityType {
    LECTURE = 'lecture',
    STUDY = 'study',
    AGENDA = 'agenda',
    BREAK = 'break',
    FREE = 'free',
}

export interface PlanSlot {
    activity: string;
    startTime: string;
    endTime: string;
    type: ActivityType;
    link?: string;
    code?: string;
}

export interface DayPlan {
    day: DayOfWeek;
    slots: PlanSlot[];
}

export type SmartPlan = DayPlan[];

export interface StoredPlan {
    id: string;
    name: string;
    createdAt: string;
    plan: SmartPlan;
    isFavourite: boolean;
}

export interface Lecture {
    id: string;
    subject: string;
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    location?: string;
}

export interface StudyGoal {
    id: string;
    subject: string;
    hours: number;
    materials?: string;
}

export interface AgendaItem {
    id: string;
    title: string;
    day: DayOfWeek;
    startTime: string;
    endTime: string;
}

export interface Note {
    id: string;
    title: string;
    content: string;
    subject: string;
    createdAt: string;
    isFavourite: boolean;
}

export interface NotificationSettings {
    status: 'unconfigured' | 'configured';
    enabled: boolean;
    reminders: boolean;
    reminderTime: 5 | 10 | 15 | number;
    sessionStart: boolean;
    breakStartEnd: boolean;
}

export interface UploadedFile {
    file: File;
    name: string;
    size: number;
    type: string;
    base64: string;
    context?: string;
}

export interface ActiveSession {
    type: 'study' | 'break';
    subject: string;
    startTime: number;
    endTime: number;
    fromSlot: PlanSlot;
    studyModeFile?: UploadedFile;
    isUntracked?: boolean;
}

export interface TrackedSession {
    subject: string;
    durationMinutes: number;
    date: string;
}

export interface AppSettings {
    printButtonEnabled: boolean;
}

export interface Toast {
    id: number;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

export interface ImagePart {
    inlineData: {
        data: string;
        mimeType: string;
    };
}

export type CourseCodeMap = {
    [code: string]: string;
};

export enum QuizType {
    MCQ = 'MCQ',
    CONCEPTUAL = 'Conceptual',
    THEORY = 'Theory',
}

export interface QuizQuestion {
    question: string;
    options?: string[];
    type: QuizType;
    correctAnswer: string;
    explanation: string;
}

export interface AnswerFeedback {
    isCorrect: boolean;
    explanation: string;
}

export interface QuizSummary {
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
}