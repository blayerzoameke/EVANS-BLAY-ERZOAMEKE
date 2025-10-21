

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
  | 'preferences'
  | 'settings'
  | 'report'
  | 'feedback'
  | 'help'
  | 'about'
  | 'library'
  | 'terms'
  | 'tutorial';

export type Theme = 'light' | 'dark' | 'system';

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
  isLocked?: boolean;
  durationMinutes?: number;
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

export interface UploadedFile {
    name: string;
    type: string;
    size: number;
    base64: string;
    context: string;
}

export type AnalysisMode = 'none' | 'summarize' | 'explain' | 'read' | 'chat' | 'read-focus';

export interface LearningHubState {
    file: UploadedFile | null;
    analysisMode: AnalysisMode;
    analysisResults: {
        summarize: string | null;
        explain: string | null;
        read: string | null;
    };
    chatHistory: ChatTurn[];
    isProcessing: boolean;
    intendedStudyContext?: {
        subject: string;
        fromSlot: PlanSlot;
    } | null;
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
    reminderTime: number;
    sessionStart: boolean;
    breakStartEnd: boolean;
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
    userAnswers: string[];
    feedback: AnswerFeedback | null;
    summary: QuizSummary | null;
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
    mode: 'quiz' | 'solve';
    // Quiz generation
    topic: string;
    numQuestions: number;
    quizType: QuizType;
    uploadedFiles: File[];
    focusArea: string;
    isVerifying: boolean;
    // Problem solving
    questionImage: string | null; // base64 data url
    questionText: string;
    solution: string | null;
    outputFormat: 'steps' | 'latex' | 'code' | 'graph';
    programmingLanguage: string;
    graphInterval: string;
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

export interface FeedbackDraft {
    rating: number;
    category: string;
    comments: string;
    canUseAsTestimonial: boolean;
}