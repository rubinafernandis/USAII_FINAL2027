// Shared domain model for the USAII Intuitive LMS.
// Used by both the Express API (server/) and the React client (src/).

export type Role = 'learner' | 'instructor';

export interface LearningGoal {
  statement: string; // "What do I want to be able to do?" (heutagogy: learner-defined)
  why: string; // personal relevance (andragogy)
  minutesPerDay: number;
  daysPerWeek: number;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  active: boolean;
  createdAt: string;
  onboarded: boolean;
  mustChangePassword: boolean;
  goal?: LearningGoal;
  learnMode?: LearnMode;
  /** Set while an instructor has suspended this learner (then `active` is false). */
  suspension?: Suspension;
}

/** Who suspended a learner, when, and an optional note that only instructors see. */
export interface Suspension {
  at: string;
  byId: string;
  byName: string;
  reason?: string;
}

export interface UserRecord extends PublicUser {
  passwordHash: string;
  salt: string;
  /** When the password last changed. Sign-in tokens issued before this are rejected. */
  passwordChangedAt?: string;
}

export type LearnMode = 'read' | 'watch' | 'listen' | 'do';

/* ---------------- Course content ---------------- */

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'text'
  | 'video'
  | 'audio'
  | 'image'
  | 'quote'
  | 'list'
  | 'link';

export interface ContentBlock {
  id: string;
  type: BlockType;
  text?: string; // heading / paragraph / text / quote / caption
  level?: 2 | 3; // heading level
  tone?: 'info' | 'tip'; // text callout tone (calm by design)
  url?: string; // media / link / image
  label?: string; // link label, media title
  attribution?: string; // quote
  items?: string[]; // list
  ordered?: boolean; // list
  transcript?: string; // video / audio transcript
}

/**
 * What a question measures (Comprehension evidence):
 * - knowledge: concepts, principles, terminology, and appropriate choices
 * - scenario:  a judgment in a short workplace situation (for example, the safest or most effective use of AI)
 */
export type QuestionKind = 'knowledge' | 'scenario';

export interface CheckQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  rationale: string;
  /** What the question measures. Missing means 'knowledge'. */
  kind?: QuestionKind;
  /**
   * Final assessment only: the lesson whose learning objective this question assesses.
   * Lesson check questions always belong to their own lesson. Missing means "the whole course".
   */
  objectiveId?: string;
}

/** One observable criterion an applied activity is scored against (Mastery evidence). */
export interface RubricCriterion {
  id: string;
  label: string;
  /** What "Met" looks like, so every reviewer scores the same way. */
  description?: string;
}

export interface ActivityField {
  id: string;
  label: string;
  hint?: string;
  multiline?: boolean;
  placeholder?: string;
}

/** The rubric an instructor uploads as a PDF. Every submission of the activity is evaluated against it. */
export interface RubricDocument {
  url: string;
  name: string;
  /** Total points the rubric awards (for example 20 or 100). The instructor's score is out of this. */
  maxPoints: number;
}

/** Block types allowed inside activity instructions (written content and pictures, no media players). */
export const INSTRUCTION_BLOCK_TYPES = ['heading', 'paragraph', 'text', 'list', 'image', 'link'] as const;

export interface LessonActivity {
  title: string;
  /**
   * Plain-text instructions from older courses. Shown as ordinary paragraphs (never numbered).
   * Ignored when `instructionBlocks` has content.
   */
  instructions: string[];
  /** Rich instructions written in Course Builder: paragraphs, headings, bullet lists, notes, links, and images. */
  instructionBlocks?: ContentBlock[];
  fields: ActivityField[];
  allowFile: boolean;
  /** The rubric PDF the instructor uploads. With it, the activity is rubric-scored and counts toward Mastery. */
  rubricPdf?: RubricDocument;
  /**
   * Legacy (before 5.6): criteria typed one by one in Course Builder. Still scored if an older
   * activity has them and no rubric PDF; new activities use `rubricPdf` instead.
   */
  rubric?: RubricCriterion[];
}

export interface CheckSettings {
  mode: 'practice' | 'quiz'; // practice = retakes + instant feedback; quiz = timed, limited attempts
  timeLimitMin: number; // 0 = untimed
  attemptsAllowed: number; // 0 = unlimited
}

export interface Lesson {
  id: string;
  title: string;
  topic: string; // the concept / skill this lesson builds (its learning objective)
  estimatedMinutes: number;
  summary: string;
  blocks: ContentBlock[];
  check: CheckQuestion[];
  checkSettings: CheckSettings;
  activity?: LessonActivity;
}

export interface CourseModule {
  id: string;
  title: string;
  summary: string;
  lessons: Lesson[];
}

export interface FinalExam {
  questions: CheckQuestion[];
  timeLimitMin: number;
  attemptsAllowed: number;
}

export interface GradingWeights {
  checks: number; // % (Check Your Understanding / module quizzes)
  activities: number; // %
  finalExam: number; // %
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  credentialName: string;
  durationLabel: string;
  level: string;
  price: number; // USD; micro-credentials stay under $50
  /** True once the instructor has set the price (0 = free is a valid, deliberate choice). A course cannot be published until this is true. */
  priceSet?: boolean;
  access: 'open' | 'invite';
  status: 'draft' | 'published';
  accent: 'blue' | 'purple' | 'pink' | 'green';
  coverImage?: string;
  /** A PDF the instructor uploads so learners can read the plan for the course. */
  studyPlan?: { url: string; name: string };
  passMark: number; // %
  grading: GradingWeights;
  modules: CourseModule[];
  finalExam?: FinalExam;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------------- Learner records ---------------- */

export type LessonStatus = 'not_started' | 'in_progress' | 'done';

/** One graded answer, recorded with what the question measured at the moment it was answered. */
export interface AttemptItem {
  qid: string;
  kind: QuestionKind;
  /** Lesson id of the learning objective, or undefined for a course-wide final assessment question. */
  objectiveId?: string;
  correct: boolean;
}

export interface CheckAttempt {
  at: string;
  score: number; // %
  answers: number[];
  kind: 'check' | 'review';
  /** Per-question results (recorded since 5.3). Older attempts are read from `answers`. */
  items?: AttemptItem[];
}

/** The instructor's decision on an activity. No decision yet means "awaiting review". */
export type ActivityReview = 'approved' | 'not_approved' | 'resubmit';

/** Rubric level for one criterion: 0 Not met, 1 Partially met, 2 Met. */
export type RubricLevel = 0 | 1 | 2;

/**
 * The scored rubric for one submitted version of an activity. The criteria are copied in
 * at scoring time, so later edits to the rubric in Course Builder never change a past score.
 */
export interface RubricResult {
  /** Per-criterion levels (legacy typed criteria). Empty when the activity was scored against a rubric PDF. */
  scores: { id: string; label: string; level: RubricLevel }[];
  /** Rubric PDF scoring: points awarded and the rubric's total, copied at scoring time. */
  points?: number;
  maxPoints?: number;
  /** File name of the rubric PDF used, so a later replacement never changes what this score meant. */
  rubricName?: string;
  percent: number; // 0-100
  scoredBy: string;
  scoredAt: string;
}
export interface ActivitySubmission {
  fields: Record<string, string>;
  review?: ActivityReview;
  reviewedBy?: string;
  reviewedAt?: string;
  /** When the learner resubmits, the review of the earlier version is kept here for context. */
  previous?: { review?: ActivityReview; feedback?: string; by?: string; at?: string; submittedAt: string; rubric?: RubricResult };
  /** The instructor's rubric scores for this version (Mastery evidence). */
  rubric?: RubricResult;
  fileUrl?: string;
  fileName?: string;
  submittedAt: string;
  feedback?: string;
  feedbackBy?: string;
  feedbackAt?: string;
}

export interface LessonProgress {
  status: LessonStatus;
  startedAt?: string;
  completedAt?: string;
  activeSeconds: number;
  attempts: CheckAttempt[];
  activity?: ActivitySubmission;
  selfConfidence?: number; // 1-5, learner's own estimate (calibration)
  reflection?: string; // double-loop reflection (heutagogy)
  lastReviewedAt?: string;
  quizStartedAt?: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: string;
  grantedBy?: string;
  lessons: Record<string, LessonProgress>;
  finalExam?: { attempts: CheckAttempt[]; startedAt?: string };
  certificateId?: string;
  certificateIssuedAt?: string;
  targetDate?: string; // learner-chosen finish date
  /** Personal guidance written by the instructor who owns this course. */
  guidance?: InstructorGuidance;
  /** Forecast vs. actual result at each final assessment attempt, so forecast accuracy can be calibrated. */
  forecastLog?: ForecastLogEntry[];
}

/** A short, personal note from the instructor: what to do next, and what to work on. */
export interface InstructorGuidance {
  nextStep: string;
  workOn: string;
  byName: string;
  byId: string;
  updatedAt: string;
}

export type ActivityEventType =
  | 'login'
  | 'study'
  | 'check'
  | 'activity'
  | 'post'
  | 'reply'
  | 'final'
  | 'guide_view' // opened the Study Guide viewer
  | 'guide_download' // downloaded the Study Guide PDF
  | 'work_view' // opened View my work in Your Journey
  | 'work_download' // downloaded their own work (PDF) from that viewer
  | 'plan_view'; // opened the instructor's Study Plan viewer

export interface ActivityEvent {
  id: string;
  userId: string;
  courseId?: string;
  type: ActivityEventType;
  at: string;
  seconds?: number; // for 'study' heartbeats
}

/* ---------------- Community / support ---------------- */

export interface Reply {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  text: string;
  createdAt: string;
  likes: string[];
}

export interface Thread {
  id: string;
  courseId: string;
  lessonId?: string;
  lessonTitle?: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  audience: 'everyone' | 'instructor';
  title: string;
  body: string;
  createdAt: string;
  likes: string[];
  replies: Reply[];
  readBy: string[]; // users who have seen latest reply
}

export interface Notification {
  id: string;
  userId: string;
  key?: string; // de-duplication key for generated nudges
  kind: 'reply' | 'message' | 'nudge' | 'access' | 'feedback' | 'credential';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: { view: string; courseId?: string; lessonId?: string; threadId?: string };
}

export interface DirectMessage {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  subject: string;
  body: string;
  createdAt: string;
}

/**
 * Where a piece of learner feedback came from:
 * - course:    "Rate My Course" on Give Feedback (stars and comment for one course)
 * - platform:  "Rate the USAII® LMS" on Give Feedback (stars and comment)
 * - recommend: "Would you recommend USAII® Courses to others?" on Give Feedback (Yes or No)
 * - pulse:     the quick check-in on My Learning ("Would you recommend this course?" and
 *              "How easy is it to know your next step?")
 */
export type FeedbackKind = 'course' | 'platform' | 'recommend' | 'pulse';

export interface FeedbackEntry {
  id: string;
  userId: string;
  recommend: boolean; // Yes / No where asked; for star ratings, 4 stars or more
  ease: number; // 1-5 "how easy is it to know your next step?" (pulse only; 0 when not asked)
  comment: string;
  createdAt: string;
  kind?: FeedbackKind; // missing on entries saved before 5.3, which are treated as 'pulse'
  /** Rate the USAII® LMS only: "Would you recommend USAII® to others?" Yes or No. */
  recommendUsaii?: boolean;
  courseId?: string;
  stars?: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  role: Role;
  action: string;
  details: string;
}

export interface Database {
  version: number;
  users: UserRecord[];
  courses: Course[];
  enrollments: Enrollment[];
  events: ActivityEvent[];
  threads: Thread[];
  notifications: Notification[];
  messages: DirectMessage[];
  feedback: FeedbackEntry[];
  audit: AuditEntry[];
  /** Portal-wide settings managed by instructors. Optional, so older databases need no migration. */
  settings?: SiteSettings;
  /**
   * Machine translations of video transcripts, shared by every learner. Key: `${blockId}:${lang}:${sourceHash}`,
   * so editing a transcript automatically invalidates its old translations.
   */
  transcriptTranslations?: Record<string, TranscriptTranslation>;
}

export interface TranscriptTranslation {
  text: string;
  lang: string;
  at: string;
  engine: 'anthropic' | 'gemini';
}

/**
 * The "How to Navigate the USAII® LMS?" video. Instructors upload, replace, or remove it
 * from their portal; every learner sees the current one behind the ? button.
 */
export interface NavVideo {
  /** Served from /uploads/…; a new upload always gets a new file name, so caches never show an old video. */
  url: string;
  name: string;
  size: number;
  mime: string;
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
}

export interface SiteSettings {
  navVideo?: NavVideo | null;
}

/* ---------------- Computed analytics ---------------- */

/**
 * Per-lesson study status, used for next steps and reviews. It is not the Comprehension or
 * Mastery metric: those two words are reserved for the course-level metrics below.
 */
export type TopicState = 'Not started' | 'Seen' | 'Practicing' | 'Developing' | 'Solid' | 'Strong';

export interface TopicStatus {
  lessonId: string;
  moduleId: string;
  lessonTitle: string;
  topic: string;
  score: number; // 0-100
  state: TopicState;
  bestCheck: number | null;
  firstCheck: number | null;
  selfConfidence?: number;
  calibration?: 'accurate' | 'over' | 'under';
  reviewDue: boolean;
}

export interface EngagementMetrics {
  loginsLast7: number;
  loginDaysLast7: number;
  activeDaysLast7: number;
  activeMinutesLast7: number;
  avgSessionMinutes: number;
  totalActiveMinutes: number;
  daily: { date: string; minutes: number; login: boolean }[]; // last 14 days
  checksTaken: number;
  activitiesSubmitted: number;
  posts: number;
  engagementScore: number; // 0-100
  streak: number;
}

export interface GradePrediction {
  currentGrade: number | null; // % from completed graded work
  predictedGrade: number; // %
  predictedLetter: string;
  passConfidence: number; // %
  avgCheckScore: number | null;
  avgQuizFirstAttempt: number | null;
  firstAttemptAvg: number | null; // average first-attempt check score (not the Comprehension metric)
  finalExamScore: number | null;
  evidence: 'none' | 'early' | 'solid'; // how much graded evidence backs the prediction
  /** Likely final-grade range. Wide with little evidence, narrow once most work is graded. */
  range: { low: number; high: number };
  /** Plain-language statement of how much evidence backs this estimate. */
  evidenceNote: string;
  breakdown: { label: string; weight: number; score: number | null }[];
}

export interface CompletionEstimate {
  lessonsDone: number;
  lessonsTotal: number;
  percent: number;
  minutesRemaining: number;
  minutesPerWeek: number; // observed or planned pace
  paceSource: 'observed' | 'goal' | 'default';
  weeksRemaining: number;
  estimatedDate: string | null; // ISO date
  finalExamDone: boolean;
}

export interface Recommendation {
  id: string;
  priority: 'now' | 'soon' | 'later';
  /** What is the issue. */
  title: string;
  /** What to do now. */
  detail: string;
  /** Why it matters, in one sentence. */
  why: string;
  minutes: number;
  action: NextAction;
}

export interface NextAction {
  kind: 'lesson' | 'review' | 'check' | 'activity' | 'final' | 'credential' | 'thread' | 'browse';
  courseId?: string;
  lessonId?: string;
  threadId?: string;
}

export interface NextStep {
  title: string;
  reason: string;
  minutes: number;
  label: string;
  action: NextAction;
  where: string; // "Module 2 · Lesson 3"
}

export interface RiskFactor {
  label: string;
  severity: 'low' | 'medium' | 'high';
  /** The practical next step for this risk (every risk signal connects to an action). */
  advice: string;
}

/** The forecast as it stood when the learner submitted a final assessment attempt (for calibration). */
export interface ForecastLogEntry {
  at: string;
  predictedGrade: number;
  low: number;
  high: number;
  passConfidence: number;
  evidence: 'none' | 'early' | 'solid';
  comprehension: number | null;
  mastery: number | null;
  /** The final assessment score that followed. */
  finalScore: number;
}

export interface LearnerSnapshot {
  courseId: string;
  engagement: EngagementMetrics;
  prediction: GradePrediction;
  completion: CompletionEstimate;
  topics: TopicStatus[];
  weakAreas: TopicStatus[];
  /** Comprehension and Mastery: the two course-level learning metrics. */
  metrics: LearningMetrics;
  recommendations: Recommendation[];
  nextStep: NextStep;
  risk: { needsSupport: boolean; factors: RiskFactor[] };
  eligibleForFinal: boolean;
  credentialEarned: boolean;
}

/* ---------------- Comprehension and Mastery ---------------- */

export type EvidenceKey = 'knowledgeChecks' | 'scenarioJudgment' | 'finalKnowledge' | 'comprehension' | 'appliedActivities' | 'finalScenario';

/** One evidence source behind a metric, at course level (the mean of its learning objectives). */
export interface EvidencePart {
  key: EvidenceKey;
  label: string;
  weight: number; // recommended weight, %
  score: number | null; // null = no evidence yet
  objectives: number; // learning objectives with evidence of this kind
}

/** Both metrics for one learning objective (one lesson; or the whole course for untagged final questions). */
export interface ObjectiveMetric {
  objectiveId: string; // lesson id, or COURSE_OBJECTIVE
  title: string;
  moduleId: string | null;
  comprehension: number | null;
  mastery: number | null;
  parts: Partial<Record<EvidenceKey, number | null>>;
}

export interface LearningMetrics {
  /** Null until measured. Show "Not measured yet". */
  comprehension: number | null;
  /** Null until measured. Show "Building evidence". */
  mastery: number | null;
  scoredCheckpoints: number;
  checkpointsNeeded: number;
  comprehensionParts: EvidencePart[];
  masteryParts: EvidencePart[];
  objectives: ObjectiveMetric[];
  /** Submitted activities with rubric criteria that the instructor has not scored yet. */
  awaitingScore: number;
}
