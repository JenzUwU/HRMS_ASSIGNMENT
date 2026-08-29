/**
 * Typed API layer. One function per FastAPI endpoint, mirroring
 * backend/app/api/routes. Uses apiFetch from api-client.ts (which owns the
 * base URL and ApiError). Response shapes match the backend Pydantic models.
 */
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// shared shapes
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface RiskSummary {
  level: string;
  score: number;
  factors: string[];
  summary: string | null;
  source: string;
  model: string | null;
  updated_at: string | null;
}

export interface CandidateNote {
  id: string;
  candidate_id: string;
  author_recruiter_id: string | null;
  author_name: string | null;
  author_initials: string | null;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CandidateTask {
  id: string;
  candidate_id: string;
  assigned_recruiter_id: string | null;
  title: string;
  detail: string | null;
  related_stage: string | null;
  priority: string;
  status: string;
  source: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  doc_type: string;
  status: string;
  storage_path: string | null;
  notes: string | null;
  requested_at: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateListItem {
  id: string;
  slug: string;
  full_name: string;
  initials: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  location: string;
  location_city: string | null;
  source: string;
  recruiter_id: string;
  recruiter_name: string;
  recruiter_initials: string;
  offer_date: string;
  joining_date: string;
  joining_in_days: number;
  status: string;
  current_stage: string;
  risk_level: string;
  risk_score: number;
  engagement_score: number | null;
  last_interaction_at: string | null;
  last_interaction_channel: string | null;
  days_since_interaction: number | null;
  next_action: string | null;
  next_action_source: string | null;
  steps_completed: number;
  steps_total: number;
  open_tasks: number;
  unread_messages: number;
}

export interface CandidateDetail extends CandidateListItem {
  employment_type: string;
  declined_at_stage: string | null;
  risk: RiskSummary | null;
  latest_note: CandidateNote | null;
}

export interface JourneyStep {
  id: string | null;
  stage: string;
  label: string;
  status: string;
  position: number;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface EngagementEvent {
  id: string;
  event_type: string;
  stage: string | null;
  actor: string;
  channel: string | null;
  title: string;
  description: string | null;
  occurred_at: string;
}

export interface JourneyProgress {
  total_steps: number;
  completed: number;
  in_progress: number;
  pending: number;
  percent_complete: number;
}

export interface EngagementJourney {
  candidate_id: string;
  candidate_slug: string;
  current_stage: string;
  status: string;
  steps: JourneyStep[];
  progress: JourneyProgress;
  timeline: EngagementEvent[];
  risk: RiskSummary | null;
  upcoming_tasks: CandidateTask[];
  pending_documents: CandidateDocument[];
}

export interface Message {
  id: string;
  conversation_id: string;
  candidate_id: string;
  direction: string;
  channel: string;
  actor: string;
  sender_name: string;
  sender_recruiter_id: string | null;
  subject: string | null;
  body: string;
  status: string;
  is_ai_generated: boolean;
  is_internal_note: boolean;
  template_id: string | null;
  sent_at: string | null;
  scheduled_for: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  candidate_id: string;
  candidate_name: string | null;
  candidate_initials: string | null;
  candidate_slug: string | null;
  candidate_role: string | null;
  candidate_location_city: string | null;
  candidate_status: string | null;
  candidate_current_stage: string | null;
  channel: string;
  subject: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  is_online: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationThread extends Conversation {
  messages: Message[];
}

export interface CandidateCommunications {
  candidate_id: string;
  candidate_slug: string;
  conversations: ConversationThread[];
}

export interface Recruiter {
  id: string;
  full_name: string;
  initials: string;
  email: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  channel: string;
  subject: string | null;
  body: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsSummary {
  total_offered: number;
  joined: number;
  declined: number;
  in_progress: number;
  offer_to_join_conversion: number;
  resolved_conversion_rate: number;
  high_risk_candidates: number;
  joining_next_7_days: number;
  joining_next_15_days: number;
  joining_next_30_days: number;
  average_engagement_frequency: number;
}

export interface StageFunnelRow {
  stage: string;
  position: number;
  candidates_reached: number;
  declined_at_stage: number;
}

export interface RecruiterConversionRow {
  recruiter_id: string;
  recruiter_name: string;
  initials: string;
  offered: number;
  joined: number;
  declined: number;
  offer_to_join_rate: number | null;
}

export interface ConversionTrendPoint {
  week_start: string;
  week_end: string;
  offered_in_week: number;
  cumulative_offered: number;
  cumulative_joined: number;
  cumulative_conversion_rate: number | null;
}

// ---------------------------------------------------------------------------
// candidates
// ---------------------------------------------------------------------------

export interface CandidateListParams {
  joining_month?: string;
  recruiter_id?: string;
  role?: string;
  risk_level?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export function getCandidates(params: CandidateListParams = {}) {
  return apiFetch<Paginated<CandidateListItem>>("/candidates", {
    params: { ...params } as Record<string, string | number | undefined>,
  });
}

export function getCandidate(id: string) {
  return apiFetch<CandidateDetail>(`/candidates/${encodeURIComponent(id)}`);
}

export function getEngagement(id: string) {
  return apiFetch<EngagementJourney>(
    `/candidates/${encodeURIComponent(id)}/engagement`,
  );
}

export function getCandidateCommunications(id: string) {
  return apiFetch<CandidateCommunications>(
    `/candidates/${encodeURIComponent(id)}/communications`,
  );
}

export function getCandidateTasks(id: string) {
  return apiFetch<CandidateTask[]>(
    `/candidates/${encodeURIComponent(id)}/tasks`,
  );
}

export function getCandidateDocuments(id: string) {
  return apiFetch<CandidateDocument[]>(
    `/candidates/${encodeURIComponent(id)}/documents`,
  );
}

export function getCandidateNotes(id: string) {
  return apiFetch<CandidateNote[]>(
    `/candidates/${encodeURIComponent(id)}/notes`,
  );
}

// ---------------------------------------------------------------------------
// communications / reference / analytics
// ---------------------------------------------------------------------------

export function getConversations(page = 1, page_size = 20) {
  return apiFetch<Paginated<Conversation>>("/communications", {
    params: { page, page_size },
  });
}

export function getConversationThread(conversationId: string) {
  return apiFetch<ConversationThread>(
    `/communications/${encodeURIComponent(conversationId)}`,
  );
}

export function getRecruiters() {
  return apiFetch<Recruiter[]>("/recruiters");
}

export function getMessageTemplates() {
  return apiFetch<MessageTemplate[]>("/message-templates");
}

export function getAnalyticsSummary() {
  return apiFetch<AnalyticsSummary>("/analytics/summary");
}

export function getStageFunnel() {
  return apiFetch<StageFunnelRow[]>("/analytics/stage-funnel");
}

export function getRecruiterConversion() {
  return apiFetch<RecruiterConversionRow[]>("/analytics/recruiter-conversion");
}

export function getConversionTrend() {
  return apiFetch<ConversionTrendPoint[]>("/analytics/conversion-trend");
}

// ---------------------------------------------------------------------------
// mutations (write endpoints) — all go through apiFetch / ApiError
// ---------------------------------------------------------------------------

function cid(id: string) {
  return encodeURIComponent(id);
}

export type AiChannel = "email" | "whatsapp" | "sms";
export type CandidateStatus =
  | "offer_accepted"
  | "active"
  | "joined"
  | "declined";
export type JourneyStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

export interface CreateNoteBody {
  body: string;
  is_pinned?: boolean;
}

export function createCandidateNote(id: string, body: CreateNoteBody) {
  return apiFetch<CandidateNote>(`/candidates/${cid(id)}/notes`, {
    method: "POST",
    body,
  });
}

export interface UpdateCandidateBody {
  status?: CandidateStatus;
  preferred_channel?: AiChannel;
}

export function updateCandidate(id: string, body: UpdateCandidateBody) {
  return apiFetch<CandidateDetail>(`/candidates/${cid(id)}`, {
    method: "PATCH",
    body,
  });
}

export interface CreateMessageBody {
  channel: AiChannel;
  body: string;
  subject?: string | null;
  is_internal_note?: boolean;
  is_ai_generated?: boolean;
}

export function createCandidateMessage(id: string, body: CreateMessageBody) {
  return apiFetch<Message>(`/candidates/${cid(id)}/messages`, {
    method: "POST",
    body,
  });
}

export interface CreateTaskBody {
  title: string;
  detail?: string | null;
  priority?: "low" | "medium" | "high";
  related_stage?: string | null;
  due_date?: string | null;
}

export function createCandidateTask(id: string, body: CreateTaskBody) {
  return apiFetch<CandidateTask>(`/candidates/${cid(id)}/tasks`, {
    method: "POST",
    body,
  });
}

export function updateJourneyStep(
  id: string,
  stage: string,
  status: JourneyStepStatus,
) {
  return apiFetch<EngagementJourney>(
    `/candidates/${cid(id)}/journey/${encodeURIComponent(stage)}`,
    { method: "PATCH", body: { status } },
  );
}

// ---------------------------------------------------------------------------
// AI (Groq-backed) — generate + history + HR override
// ---------------------------------------------------------------------------

export interface AiMeta {
  model: string;
  persisted: boolean;
  record_id: string | null;
  corrections: string[];
}

export interface PersonalizedMessage {
  channel: AiChannel;
  subject: string | null;
  body: string;
  personalization_rationale: string | null;
}

export interface InteractionSummary {
  summary: string;
  key_concerns: string[];
  positive_signals: string[];
  unanswered_issues: string[];
}

export interface NextBestAction {
  action: string;
  rationale: string;
  suggested_channel: AiChannel;
  confidence: number;
}

export interface RiskClassification {
  level: "low" | "medium" | "high";
  score: number;
  factors: string[];
  summary: string;
  recommended_action: string;
}

export interface AiResult<T> {
  result: T;
  meta: AiMeta;
}

export interface AIRecommendationRecord {
  id: string;
  candidate_id: string;
  kind: string;
  status: string;
  model: string | null;
  payload: Record<string, unknown>;
  prompt_context: Record<string, unknown> | null;
  hr_override_text: string | null;
  is_current: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface RiskRecord {
  id: string;
  candidate_id: string;
  level: "low" | "medium" | "high";
  score: number;
  factors: string[];
  summary: string | null;
  source: string;
  model: string | null;
  is_current: boolean;
  created_at: string;
}

export function aiDraftMessage(
  id: string,
  body: { channel: AiChannel; purpose?: string | null },
) {
  return apiFetch<AiResult<PersonalizedMessage>>(
    `/candidates/${cid(id)}/ai/message`,
    { method: "POST", body },
  );
}

export function aiSummary(id: string) {
  return apiFetch<AiResult<InteractionSummary>>(
    `/candidates/${cid(id)}/ai/summary`,
    { method: "POST", body: {} },
  );
}

export function aiNextAction(id: string) {
  return apiFetch<AiResult<NextBestAction>>(
    `/candidates/${cid(id)}/ai/next-action`,
    { method: "POST", body: {} },
  );
}

export function aiRisk(id: string) {
  return apiFetch<AiResult<RiskClassification>>(
    `/candidates/${cid(id)}/ai/risk`,
    { method: "POST", body: {} },
  );
}

export function getAiRecommendations(
  id: string,
  params: { kind?: string; current_only?: boolean } = {},
) {
  return apiFetch<AIRecommendationRecord[]>(
    `/candidates/${cid(id)}/ai/recommendations`,
    { params: { ...params } as Record<string, string | number | boolean | undefined> },
  );
}

export function patchAiRecommendation(
  recommendationId: string,
  body: { action: "accept" | "dismiss" | "override"; override_text?: string | null },
) {
  return apiFetch<AIRecommendationRecord>(
    `/ai-recommendations/${cid(recommendationId)}`,
    { method: "PATCH", body },
  );
}

export function getRiskHistory(id: string) {
  return apiFetch<RiskRecord[]>(`/candidates/${cid(id)}/risk/history`);
}

export interface RiskOverrideResponse {
  result: RiskRecord;
  previous_ai_assessment: RiskRecord | null;
  note: string;
}

export function patchRiskAssessment(
  assessmentId: string,
  body: { level: "low" | "medium" | "high"; reason: string; score?: number | null },
) {
  return apiFetch<RiskOverrideResponse>(
    `/risk-assessments/${cid(assessmentId)}`,
    { method: "PATCH", body },
  );
}

// ---------------------------------------------------------------------------
// automation
// ---------------------------------------------------------------------------

export interface SweepCandidateResult {
  candidate_id: string;
  slug: string;
  full_name: string;
  joining_in_days: number | null;
  days_since_interaction: number | null;
  outcome: "processed" | "skipped" | "failed";
  reason: string | null;
  task_id: string | null;
  recommendation_id: string | null;
  event_id: string | null;
  message_channel: string | null;
}

export interface EngagementSweepResult {
  rule: string;
  dry_run: boolean;
  ran_at: string;
  scanned: number;
  eligible: number;
  processed: number;
  skipped: number;
  failed: number;
  results: SweepCandidateResult[];
}

export interface AutomationStatus {
  background_loop_enabled: boolean;
  interval_minutes: number;
  rule: string;
  joining_window_days: number;
  no_interaction_days: number;
  dedup_days: number;
  last_run: EngagementSweepResult | null;
}

export function getAutomationStatus() {
  return apiFetch<AutomationStatus>("/automation/status");
}

export function runEngagementSweep(
  body: { dry_run?: boolean; limit?: number } = {},
) {
  return apiFetch<EngagementSweepResult>("/automation/run-engagement-sweep", {
    method: "POST",
    body,
  });
}
