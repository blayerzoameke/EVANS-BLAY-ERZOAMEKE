
// FIX: Export DayOfWeek enum and remove circular import from constants.ts
export enum DayOfWeek {
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
  Saturday = 'Saturday',
  Sunday = 'Sunday',
}

export type View =
  | 'dashboard'
  | 'profile'
  | 'mytimetables'
  | 'progression'
  | 'notes'
  | 'uploadslides'
  | 'examprep'
  | 'language'
  | 'theme'
  | 'settings'
  | 'report'
  | 'feedback'
  | 'help'
  | 'about'
  | 'library'
  | 'terms'
  | 'tutorial'
  | 'notification'
  | 'pricing'
  | 'collaborative'
  | 'history';

export type Theme = 'light' | 'dark' | 'system';

export type SubscriptionTier = 'free' | 'premium' | 'institution';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trialing';

export enum EducationalLevel {
  HIGH_SCHOOL = 'High School',
  UNDERGRADUATE = 'Undergraduate',
  POSTGRADUATE = 'Postgraduate',
  DOCTORATE = 'Doctorate',
  OTHER = 'Other',
}

// --- Usage Tracking Types ---
export type FeatureName = 'timetables' | 'uploads' | 'quizzes' | 'solves' | 'collaboration';

export interface UsageRecord {
    count: number;
    lastReset: string; // ISO string date
}

export interface UserUsage {
    timetables: UsageRecord;
    uploads: UsageRecord;
    quizzes: UsageRecord;
    solves: UsageRecord;
    rewards: {
        [key in FeatureName]?: number; // Bonus uses granted
    };
}

export interface UsageLimit {
    limit: number;
    period: 'day' | 'month' | 'total';
}


export interface UserDetails {
  id?: string;
  name: string;
  educationalLevel: EducationalLevel;
  hasConfirmedDetails?: boolean; // New field to strictly enforce confirmation step
  institution?: string;
  country?: string;
  email?: string;
  profilePicture?: string;
  biography?: string;
  institutionLogo?: string;
  programmeOfStudy?: string;
  institutionAbbreviation?: string;
  recoveryQuestion?: string;
  recoveryAnswer?: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  usage: UserUsage;
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
  location?: string;
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
  isLocked?: boolean;
  durationMinutes?: number;
  location?: string;
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
  durationMinutes?: number;
  breakPlacement?: 'during' | 'after';
  breakStartsAt?: number;
  day?: DayOfWeek;
  postBreakView?: View;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  subject: string;
  createdAt: string;
  isFavourite: boolean;
}

// FIX: Add missing NotificationSettings type
export interface NotificationSettings {
    status: 'unconfigured' | 'configured';
    enabled: boolean;
    reminders: boolean;
    reminderTime: number; // in minutes
    sessionStart: boolean;
    breakStartEnd: boolean;
}

export interface UploadedFile {
    name: string;
    type: string;
    size: number;
    base64: string;
    context: string;
}

export interface UploadedMaterialInfo {
    name: string;
    type: string;
    size: number;
    context: string;
    uploadedAt: string;
}

export type AnalysisMode = 'none' | 'summarize' | 'explain' | 'read' | 'deep' | 'chat' | 'read-focus' | 'actions';

export interface LearningHubState {
    file: UploadedFile | null;
    analysisMode: AnalysisMode;
    analysisResults: {
        summarize: string | null;
        explain: string | null;
        read: string | null;
        deep: string | null;
    };
    chatHistory: ChatTurn[];
    isProcessing: boolean;
    processingMessage?: string;
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
  hint?: string; // Socratic nudge — does not reveal the answer
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
export type HistoryEntryType = 'chat' | 'quiz';

export interface HistoryEntry {
    id: string;
    type: HistoryEntryType;
    title: string;               // AI-generated title like Claude
    createdAt: string;           // ISO date string
    updatedAt: string;           // ISO date string — for sorting by most recent
    // Chat history fields
    chatHistory?: ChatTurn[];
    documentName?: string;       // name of the uploaded file
    documentContext?: string;    // subject/context extracted from file
    // Quiz history fields
    quiz?: QuizQuestion[];
    userAnswers?: any[];
    quizSummary?: QuizSummary | null;
    quizType?: string;
    focusArea?: string;
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

export interface ConflictInfo {
    plannedSubject: string;
    uploadedSubject: string;
}

export interface GenerationState {
    isLoading: boolean;
    message: string;
    error: string | null;
    source: 'dashboard' | 'quiz' | 'solve' | 'hub' | null;
}

export interface QuizState {
    quiz: QuizQuestion[];
    currentQuestionIndex: number;
    userAnswers: any[];
    feedback: AnswerFeedback | null;
    summary: QuizSummary | null;
    timerSeconds: number | null; // null = no timer
}

export interface Flashcard {
    front: string;
    back: string;
    topic: string;
    hint?: string;
}

export interface FlashcardState {
    cards: Flashcard[];
    currentIndex: number;
    flipped: boolean;
    known: number[];
    unknown: number[];
    sessionDone: boolean;
}

export interface DashboardInputState {
    lectures: Lecture[];
    studyGoals: StudyGoal[];
    agendaItems: AgendaItem[];
    generalGoals: string;
    imageFile: File | null;
    imagePreview: string | null;
    step: 1 | 2;
    isManualPlan: boolean;
    isEditing: boolean;
}

export interface ExamPrepState {
    mode: 'quiz' | 'solve' | 'flashcard';
    // Quiz generation
    topic: string;
    numQuestions: number;
    quizType: QuizType;
    uploadedFiles: File[];
    focusArea: string;
    isVerifying: boolean;
    quizTimerMinutes: number; // 0 = no timer
    numFlashcards: number;
    quizDifficulty: 'easy' | 'moderate' | 'hard';
    flashcardFiles: File[];
    flashcardDifficulty: 'easy' | 'moderate' | 'hard';
    // Problem solving
    questionImage: string | null; // base64 data url
    questionText: string;
    solution: string | null;
    outputFormat: 'steps' | 'latex' | 'code' | 'graph';
    programmingLanguage: string;
    graphInterval: string;
    graphYInterval: string;
    graphConfig?: any | null; // Added to persist graph state
}


export interface ProfileEditState {
    isEditing: boolean;
    details: UserDetails | null;
}

export interface NotesViewState {
    currentNoteId: string | null;
    searchTerm: string;
}

export interface ReportDraft {
    category: string;
    description: string;
    attachment: File | null;
    contactEmail: string;

    contactWhatsApp: string;
}