

export type Theme = 'light' | 'dark' | 'system';

export enum DayOfWeek {
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
  Saturday = 'Saturday',
  Sunday = 'Sunday',
}

export enum EducationalLevel {
  HIGH_SCHOOL = 'High School',
  UNDERGRADUATE = 'Undergraduate',
  POSTGRADUATE = 'Postgraduate',
  DOCTORATE = 'Doctorate',
  OTHER = 'Other',
}

export interface UserDetails {
  name: string;
  educationalLevel: EducationalLevel;
  institution?: string;
  country?: string;
  email?: string;
  profilePicture?: string;
  biography?: string;
  institutionLogo?: string;
  programmeOfStudy?: string;
  institutionAbbreviation?: string;
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

export type DayPlan = {
  day: DayOfWeek;
  slots: PlanSlot[];
};

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
    data: string;
    mimeType: string;
};
}

export interface CourseCodeMap {
  [code: string]: string;
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface ActiveSession {
  startTime: number;
  endTime: number;
  subject: string;
  type: 'study' | 'break';
  fromSlot: PlanSlot;
  nextSlot: PlanSlot | null;
  isUntracked?: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  subject: string;
  createdAt: string;
  isFavourite: boolean;
}

export interface UploadedFile {
    name: string;
    type: string;
    size: number;
    base64: string;
    context: string;
}

export type AnalysisMode = 'none' | 'summarize' | 'explain' | 'read' | 'chat';

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

export enum QuizType {
  MCQ = 'Multiple Choice',
  CONCEPTUAL = 'Conceptual',
  THEORY = 'Theory-based',
}

export interface QuizQuestion {
  question: string;
  options?: string[]; // Only for MCQ
  correctAnswer: string;
  explanation: string;
  topic: string;
  type: QuizType;
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
export interface ChatTurn {
    user: string;
    blay: string;
}

export interface TrackedSession {
    subject: string;
    durationMinutes: number;
    date: string; // YYYY-MM-DD
}

export interface NotificationSettings {
    status: 'unconfigured' | 'configured';
    enabled: boolean;
    reminders: boolean;
    reminderTime: 5 | 10 | 15;
    sessionStart: boolean;
    breakStartEnd: boolean;
}

export interface ConflictInfo {
    plannedSubject: string;
    uploadedSubject: string;
}