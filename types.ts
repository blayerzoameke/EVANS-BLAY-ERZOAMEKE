

// FIX: Resolve circular dependency and export errors by defining DayOfWeek enum here.
export enum DayOfWeek {
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
  Saturday = 'Saturday',
  Sunday = 'Sunday',
}

// FIX: Defined enums directly in this file to resolve import and circular dependency errors.
export enum EducationalLevel {
  HIGH_SCHOOL = 'High School',
  UNDERGRADUATE = 'Undergraduate',
  POSTGRADUATE = 'Postgraduate',
  PHD = 'PhD Student',
  OTHER = 'Other',
}

export enum ActivityType {
  LECTURE = 'lecture',
  STUDY = 'study',
  AGENDA = 'agenda',
  BREAK = 'break',
  FREE = 'free',
}

export enum QuizType {
  MCQ = 'MCQ',
  CONCEPTUAL = 'Conceptual',
  THEORY = 'Theory',
}


export interface UserDetails {
  name: string;
  educationalLevel: EducationalLevel;
  country: string;
  institution: string;
  email?: string;
  profilePicture?: string | null;
  institutionLogo?: string | null;
  biography?: string;
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

export interface ImagePart {
  inlineData: {
    data: string; // base64 encoded string
    mimeType: string;
  };
}

export interface AppSettings {
}

export interface CourseCodeMap {
    [code: string]: string;
}

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface UploadedFile {
    name: string;
    type: string;
    size: number;
    base64: string;
    context: string;
}

export interface ChatTurn {
    user: string;
    blay: string;
}

export type AnalysisMode = 'none' | 'summarize' | 'explain' | 'chat' | 'read';

export interface LearningHubState {
    file: UploadedFile | null;
    analysisMode: AnalysisMode;
    analysisResults: {
        summarize: string | null;
        explain: string | null;
        read: string | null;
    };
    chatHistory: ChatTurn[];
}

export interface QuizQuestion {
    type: QuizType;
    question: string;
    options?: string[]; // Only for MCQ
    correctAnswer: string;
    explanation: string;
    topic: string;
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
    reminderTime: 5 | 10 | 15;
    sessionStart: boolean;
    breakStartEnd: boolean;
}

export interface ActiveSession {
    startTime: number;
    endTime?: number;
    subject: string;
    type: 'study' | 'break' | 'postBreakView';
    fromSlot: PlanSlot;
    nextSlot: PlanSlot | null;
    isLearningHubSession?: boolean;
    isUntracked?: boolean;
    originalStudySubject?: string;
}

export type Theme = 'light' | 'dark' | 'system';

export interface TrackedSession {
    subject: string;
    durationMinutes: number;
    date: string; // YYYY-MM-DD
}

export interface ConflictInfo {
    plannedSubject: string;
    uploadedSubject: string;
    slot: PlanSlot;
    day: DayOfWeek;
}