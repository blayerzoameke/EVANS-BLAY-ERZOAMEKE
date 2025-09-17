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
  LECTURE = "lecture",
  STUDY = "study",
  AGENDA = "agenda",
  BREAK = "break",
  FREE = "free",
}

export interface UserDetails {
  name: string;
  educationalLevel: string;
  institution?: string;
  country?: string;
  institutionLogo?: string;
  email?: string;
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

export interface BreakPreference {
  id: string;
  activity: string;
  link?: string;
}

export interface ImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export interface PlanSlot {
  activity: string;
  startTime: string;
  endTime: string;
  type: ActivityType;
  link?: string;
}

export interface DayPlan {
  day: DayOfWeek;
  slots: PlanSlot[];
}

export type SmartPlan = DayPlan[];

export enum QuizType {
  MCQ = "MCQ",
  CONCEPTUAL = "Conceptual",
  THEORY = "Theory",
}

export interface QuizQuestion {
  question: string;
  options?: string[];
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

export interface TrackedSession {
  subject: string;
  durationMinutes: number;
  date: string; // YYYY-MM-DD
}

export interface TimetableData {
  userDetails: UserDetails;
  lectures: Lecture[];
  studyGoals: StudyGoal[];
  agendaItems: AgendaItem[];
  breakPreferences: BreakPreference[];
  generalGoals: string;
}

export interface StoredPlan {
  id: string;
  name: string;
  createdAt: string;
  plan: SmartPlan;
  isFavourite: boolean;
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
  file: File;
  name: string;
  size: number;
  type: string;
  base64: string;
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
  type: 'study' | 'break';
  subject: string;
  startTime: number;
  endTime: number;
  fromSlot: PlanSlot;
}
