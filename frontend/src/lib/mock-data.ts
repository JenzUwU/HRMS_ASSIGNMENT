import type { RiskLevel } from "@/types";

export type JourneyStageKey =
  | "offer_accepted"
  | "welcome_sent"
  | "documentation"
  | "manager_intro"
  | "pre_joining"
  | "joined";

export const JOURNEY_STAGES: { key: JourneyStageKey; label: string }[] = [
  { key: "offer_accepted", label: "Offer Accepted" },
  { key: "welcome_sent", label: "Welcome Sent" },
  { key: "documentation", label: "Documentation" },
  { key: "manager_intro", label: "Manager Introduction" },
  { key: "pre_joining", label: "Pre-Joining Check-in" },
  { key: "joined", label: "Joined" },
];

export type StepStatus = "completed" | "in_progress" | "pending";

export interface Candidate {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  employmentType: string;
  location: string;
  source: string;
  recruiter: string;
  recruiterInitials: string;
  offerDate: string;
  joiningDate: string;
  joiningDaysLeft: number;
  stageIndex: number; // 0..5
  stageLabel: string;
  stageProgress: number; // x of 5
  lastInteraction: string;
  lastChannel: "Email" | "WhatsApp" | "SMS";
  riskLevel: RiskLevel;
  riskScore: number;
  nextAction: string;
  status: "Offer Accepted" | "Active" | "Joined";
  hrNote: string;
  hrNoteBy: string;
  hrNoteDate: string;
}

export const candidates: Candidate[] = [
  {
    id: "priya-sharma",
    name: "Priya Sharma",
    initials: "PS",
    email: "priya.sharma@email.com",
    phone: "+91 98765 43210",
    role: "Product Analyst",
    department: "Product",
    employmentType: "Full-time",
    location: "Bengaluru, Karnataka",
    source: "LinkedIn",
    recruiter: "Sneha Kapoor",
    recruiterInitials: "SK",
    offerDate: "20 May 2025",
    joiningDate: "05 Jun 2025",
    joiningDaysLeft: 8,
    stageIndex: 2,
    stageLabel: "Documentation",
    stageProgress: 3,
    lastInteraction: "2 days ago",
    lastChannel: "Email",
    riskLevel: "High",
    riskScore: 78,
    nextAction: "Follow up for document submission",
    status: "Offer Accepted",
    hrNote:
      "Priya is keen to join and has shown great enthusiasm during calls. Waiting on a few documents. Follow up for smooth onboarding.",
    hrNoteBy: "Sneha Kapoor",
    hrNoteDate: "28 May 2025",
  },
  {
    id: "arjun-reddy",
    name: "Arjun Reddy",
    initials: "AR",
    email: "arjun.reddy@email.com",
    phone: "+91 90123 45678",
    role: "Software Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    location: "Hyderabad, Telangana",
    source: "Referral",
    recruiter: "Rahul Kumar",
    recruiterInitials: "RK",
    offerDate: "18 May 2025",
    joiningDate: "07 Jun 2025",
    joiningDaysLeft: 10,
    stageIndex: 3,
    stageLabel: "Manager Introduction",
    stageProgress: 4,
    lastInteraction: "1 day ago",
    lastChannel: "WhatsApp",
    riskLevel: "Medium",
    riskScore: 54,
    nextAction: "Schedule manager introduction",
    status: "Active",
    hrNote:
      "Responsive on WhatsApp. Manager introduction pending, coordinate calendars this week.",
    hrNoteBy: "Rahul Kumar",
    hrNoteDate: "27 May 2025",
  },
  {
    id: "neha-kapoor",
    name: "Neha Kapoor",
    initials: "NK",
    email: "neha.kapoor@email.com",
    phone: "+91 99887 66554",
    role: "Data Engineer",
    department: "Data",
    employmentType: "Full-time",
    location: "Bengaluru, Karnataka",
    source: "Naukri",
    recruiter: "Sneha Kapoor",
    recruiterInitials: "SK",
    offerDate: "15 May 2025",
    joiningDate: "10 Jun 2025",
    joiningDaysLeft: 13,
    stageIndex: 4,
    stageLabel: "Pre-Joining Check-in",
    stageProgress: 5,
    lastInteraction: "5 days ago",
    lastChannel: "Email",
    riskLevel: "High",
    riskScore: 81,
    nextAction: "Nudge for pre-joining check-in",
    status: "Active",
    hrNote:
      "Has gone quiet over the last week. Counter offer risk flagged by recruiter. Priority outreach.",
    hrNoteBy: "Sneha Kapoor",
    hrNoteDate: "26 May 2025",
  },
  {
    id: "vikram-desai",
    name: "Vikram Desai",
    initials: "VD",
    email: "vikram.desai@email.com",
    phone: "+91 98111 22333",
    role: "Product Manager",
    department: "Product",
    employmentType: "Full-time",
    location: "Mumbai, Maharashtra",
    source: "LinkedIn",
    recruiter: "Aman Singh",
    recruiterInitials: "AS",
    offerDate: "12 May 2025",
    joiningDate: "12 Jun 2025",
    joiningDaysLeft: 15,
    stageIndex: 1,
    stageLabel: "Welcome Sent",
    stageProgress: 2,
    lastInteraction: "7 days ago",
    lastChannel: "Email",
    riskLevel: "Low",
    riskScore: 28,
    nextAction: "Share onboarding resources",
    status: "Active",
    hrNote: "Steady engagement. Welcome pack sent, awaiting document upload.",
    hrNoteBy: "Aman Singh",
    hrNoteDate: "24 May 2025",
  },
  {
    id: "ria-singh",
    name: "Ria Singh",
    initials: "RS",
    email: "ria.singh@email.com",
    phone: "+91 97000 11122",
    role: "UX Designer",
    department: "Design",
    employmentType: "Full-time",
    location: "Pune, Maharashtra",
    source: "Referral",
    recruiter: "Rahul Kumar",
    recruiterInitials: "RK",
    offerDate: "21 May 2025",
    joiningDate: "15 Jun 2025",
    joiningDaysLeft: 18,
    stageIndex: 2,
    stageLabel: "Documentation",
    stageProgress: 3,
    lastInteraction: "2 days ago",
    lastChannel: "WhatsApp",
    riskLevel: "Medium",
    riskScore: 49,
    nextAction: "Follow up for document submission",
    status: "Active",
    hrNote: "Positive calls. Needs a reminder for the address proof upload.",
    hrNoteBy: "Rahul Kumar",
    hrNoteDate: "25 May 2025",
  },
  {
    id: "manav-yadav",
    name: "Manav Yadav",
    initials: "MY",
    email: "manav.yadav@email.com",
    phone: "+91 96500 33445",
    role: "Software Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    location: "Noida, Uttar Pradesh",
    source: "Naukri",
    recruiter: "Aman Singh",
    recruiterInitials: "AS",
    offerDate: "16 May 2025",
    joiningDate: "18 Jun 2025",
    joiningDaysLeft: 21,
    stageIndex: 0,
    stageLabel: "Offer Accepted",
    stageProgress: 1,
    lastInteraction: "10 days ago",
    lastChannel: "Email",
    riskLevel: "Low",
    riskScore: 22,
    nextAction: "Send welcome email",
    status: "Offer Accepted",
    hrNote: "Just accepted. Kick off the welcome sequence.",
    hrNoteBy: "Aman Singh",
    hrNoteDate: "23 May 2025",
  },
  {
    id: "ananya-pillai",
    name: "Ananya Pillai",
    initials: "AP",
    email: "ananya.pillai@email.com",
    phone: "+91 95400 55667",
    role: "Data Analyst",
    department: "Data",
    employmentType: "Full-time",
    location: "Bengaluru, Karnataka",
    source: "LinkedIn",
    recruiter: "Sneha Kapoor",
    recruiterInitials: "SK",
    offerDate: "17 May 2025",
    joiningDate: "20 Jun 2025",
    joiningDaysLeft: 23,
    stageIndex: 3,
    stageLabel: "Manager Introduction",
    stageProgress: 4,
    lastInteraction: "3 days ago",
    lastChannel: "Email",
    riskLevel: "High",
    riskScore: 72,
    nextAction: "Schedule manager introduction",
    status: "Active",
    hrNote:
      "Mentioned another interview in progress. Keep engagement high, involve hiring manager early.",
    hrNoteBy: "Sneha Kapoor",
    hrNoteDate: "25 May 2025",
  },
  {
    id: "karan-jha",
    name: "Karan Jha",
    initials: "KJ",
    email: "karan.jha@email.com",
    phone: "+91 94300 77889",
    role: "Backend Developer",
    department: "Engineering",
    employmentType: "Full-time",
    location: "Hyderabad, Telangana",
    source: "Referral",
    recruiter: "Rahul Kumar",
    recruiterInitials: "RK",
    offerDate: "14 May 2025",
    joiningDate: "22 Jun 2025",
    joiningDaysLeft: 25,
    stageIndex: 1,
    stageLabel: "Welcome Sent",
    stageProgress: 2,
    lastInteraction: "6 days ago",
    lastChannel: "WhatsApp",
    riskLevel: "Low",
    riskScore: 31,
    nextAction: "Share onboarding resources",
    status: "Active",
    hrNote: "Comfortable and responsive. On track.",
    hrNoteBy: "Rahul Kumar",
    hrNoteDate: "22 May 2025",
  },
];

export const dashboardStats = [
  { label: "Total Offered Candidates", value: "248", delta: "12.4%", deltaDir: "up", sub: "vs last month" },
  { label: "Joining in Next 7 Days", value: "36", delta: "", deltaDir: "flat", sub: "14.5% of total offered" },
  { label: "High-Risk Candidates", value: "28", delta: "", deltaDir: "flat", sub: "11.3% of total offered" },
  { label: "Pending Engagements", value: "132", delta: "8.7%", deltaDir: "up", sub: "vs last month" },
] as const;

export const funnelData = [
  { label: "Offer Accepted", value: 248, pct: 100 },
  { label: "Welcome Sent", value: 210, pct: 84.7 },
  { label: "Documentation Complete", value: 168, pct: 67.7 },
  { label: "Manager Introduction", value: 120, pct: 48.4 },
  { label: "Pre-Joining Check-in", value: 82, pct: 33.1 },
  { label: "Joined", value: 36, pct: 14.5 },
];

export const upcomingActions = [
  { id: "1", initials: "PS", name: "Priya Sharma", note: "Documents pending verification", date: "29 May" },
  { id: "2", initials: "AR", name: "Arjun Reddy", note: "Manager introduction pending", date: "29 May" },
  { id: "3", initials: "NK", name: "Neha Kapoor", note: "Pre-joining check-in due", date: "30 May" },
  { id: "4", initials: "VD", name: "Vikram Desai", note: "Welcome email not opened", date: "31 May" },
  { id: "5", initials: "RS", name: "Ria Singh", note: "Documents pending verification", date: "31 May" },
];

export const recentCommunications = [
  { id: "1", type: "email", title: "Welcome to the Team", to: "Priya Sharma", time: "2h ago" },
  { id: "2", type: "chat", title: "Document Submission Reminder", to: "Arjun Reddy", time: "1d ago" },
  { id: "3", type: "email", title: "Pre-Joining Check-in", to: "Neha Kapoor", time: "2d ago" },
  { id: "4", type: "chat", title: "Manager Introduction Update", to: "Vikram Desai", time: "2d ago" },
  { id: "5", type: "email", title: "Welcome to the Team", to: "Ria Singh", time: "3d ago" },
];

export interface TimelineEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  detail: string;
  tag: string;
  status: StepStatus;
}

export const journeyTimeline: TimelineEvent[] = [
  { id: "1", date: "20 May", time: "02:35 PM", title: "Offer Accepted", detail: "Priya accepted the offer.", tag: "Completed by Candidate", status: "completed" },
  { id: "2", date: "20 May", time: "03:10 PM", title: "Welcome Email Sent", detail: "Welcome email with next steps and resources sent.", tag: "Completed", status: "completed" },
  { id: "3", date: "22 May", time: "11:20 AM", title: "Document Submission Reminder Sent", detail: "Reminder sent for pending documents.", tag: "Action by HR", status: "completed" },
  { id: "4", date: "24 May", time: "04:45 PM", title: "PAN Card Uploaded by Candidate", detail: "PAN card uploaded.", tag: "Completed by Candidate", status: "completed" },
  { id: "5", date: "Upcoming", time: "", title: "Manager Introduction", detail: "Introduction call with hiring manager.", tag: "Pending", status: "pending" },
];

export const pendingActions = [
  { id: "1", title: "Verify pending documents", detail: "Aadhaar Card, Address Proof", date: "29 May", done: false },
  { id: "2", title: "Manager introduction", detail: "Schedule intro with hiring manager", date: "30 May", done: false },
  { id: "3", title: "Pre-joining check-in call", detail: "Check comfort, answer queries", date: "02 Jun", done: false },
  { id: "4", title: "Share pre-joining resources", detail: "Team info, onboarding plan", date: "03 Jun", done: false },
];

export const pendingDocuments = [
  { id: "1", name: "Aadhaar Card", status: "Pending" as const },
  { id: "2", name: "Address Proof", status: "Pending" as const },
  { id: "3", name: "Bank Details", status: "Submitted" as const },
];

export const riskFactors = [
  "Documents pending for more than 3 days",
  "No response to last reminder",
  "Manager introduction not scheduled yet",
];

export interface Conversation {
  id: string;
  candidateId: string;
  name: string;
  initials: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  online: boolean;
}

export const conversations: Conversation[] = [
  { id: "c1", candidateId: "priya-sharma", name: "Priya Sharma", initials: "PS", subject: "Document Submission Reminder", preview: "Thanks, I will upload it today.", time: "2m ago", unread: true, online: true },
  { id: "c2", candidateId: "arjun-reddy", name: "Arjun Reddy", initials: "AR", subject: "Pre-Joining Check-in", preview: "Yes, sounds good.", time: "1h ago", unread: true, online: false },
  { id: "c3", candidateId: "neha-kapoor", name: "Neha Kapoor", initials: "NK", subject: "Manager Introduction", preview: "Looking forward to it.", time: "3h ago", unread: false, online: true },
  { id: "c4", candidateId: "vikram-desai", name: "Vikram Desai", initials: "VD", subject: "Welcome to the Team", preview: "Thank you!", time: "1d ago", unread: false, online: false },
  { id: "c5", candidateId: "ria-singh", name: "Ria Singh", initials: "RS", subject: "Document Submission Reminder", preview: "Will do it by tomorrow.", time: "2d ago", unread: false, online: true },
  { id: "c6", candidateId: "manav-yadav", name: "Manav Yadav", initials: "MY", subject: "Offer Accepted", preview: "Great!", time: "3d ago", unread: false, online: true },
  { id: "c7", candidateId: "ananya-pillai", name: "Ananya Pillai", initials: "AP", subject: "Pre-Joining Resources", preview: "Received, thank you.", time: "3d ago", unread: false, online: false },
];

export interface ChatMessage {
  id: string;
  from: "hr" | "candidate";
  author: string;
  time: string;
  dateLabel: string;
  body: string;
}

export const chatThread: ChatMessage[] = [
  { id: "m1", from: "hr", author: "HR Admin", time: "10:30 AM", dateLabel: "20 May 2025", body: "Hi Priya, congratulations on your offer. Please review and upload the below documents at your earliest convenience: Aadhaar Card, PAN Card, Address Proof. You can upload them from the candidate portal." },
  { id: "m2", from: "candidate", author: "Priya Sharma", time: "10:42 AM", dateLabel: "20 May 2025", body: "Hi, thank you so much. I will upload the documents today." },
  { id: "m3", from: "hr", author: "HR Admin", time: "11:25 AM", dateLabel: "Today", body: "Great, let us know once done. We are excited to have you join the team." },
  { id: "m4", from: "candidate", author: "Priya Sharma", time: "11:40 AM", dateLabel: "Today", body: "Thanks, I will upload it today." },
];

export const messageTemplates = [
  { id: "t1", name: "Welcome to the Team", channel: "Email", usage: 128, updated: "12 May 2025" },
  { id: "t2", name: "Document Submission Reminder", channel: "Email", usage: 96, updated: "10 May 2025" },
  { id: "t3", name: "Pre-Joining Check-in", channel: "WhatsApp", usage: 74, updated: "08 May 2025" },
  { id: "t4", name: "Manager Introduction", channel: "Email", usage: 61, updated: "05 May 2025" },
  { id: "t5", name: "Joining Day Instructions", channel: "Email", usage: 52, updated: "02 May 2025" },
];

export const analyticsStats = [
  { label: "Total Offered Candidates", value: "248", delta: "18%", deltaDir: "up", sub: "vs 20 Apr to 19 May" },
  { label: "Offer-to-Join Conversion", value: "62.5%", delta: "5.6 pp", deltaDir: "up", sub: "vs 20 Apr to 19 May" },
  { label: "High-Risk Candidates", value: "32", delta: "8%", deltaDir: "down", sub: "vs 20 Apr to 19 May" },
  { label: "Average Engagement Frequency", value: "6.4", delta: "0.8", deltaDir: "up", sub: "vs 20 Apr to 19 May" },
] as const;

export const joiningWindow = [
  { window: "7 Days", value: 18, delta: "12%" },
  { window: "15 Days", value: 37, delta: "15%" },
  { window: "30 Days", value: 68, delta: "20%" },
];

export const stageDropoffs = [
  { stage: "Offer Accepted", candidates: 248, dropoff: 0, dropoffPct: 0, retained: 100 },
  { stage: "Welcome Sent", candidates: 232, dropoff: 16, dropoffPct: 6.5, retained: 93.5 },
  { stage: "Documentation", candidates: 186, dropoff: 46, dropoffPct: 19.8, retained: 75.0 },
  { stage: "Manager Introduction", candidates: 148, dropoff: 38, dropoffPct: 20.4, retained: 59.7 },
  { stage: "Pre-Joining Check-in", candidates: 112, dropoff: 36, dropoffPct: 24.3, retained: 45.2 },
  { stage: "Joining", candidates: 102, dropoff: 10, dropoffPct: 8.9, retained: 41.1 },
];

export const recruiterRates = [
  { recruiter: "Sneha Kapoor", initials: "SK", offered: 48, joined: 32, rate: 66.7 },
  { recruiter: "Arjun Reddy", initials: "AR", offered: 42, joined: 26, rate: 61.9 },
  { recruiter: "Neha Kapoor", initials: "NK", offered: 39, joined: 22, rate: 56.4 },
  { recruiter: "Vikram Desai", initials: "VD", offered: 36, joined: 21, rate: 58.3 },
  { recruiter: "Ria Singh", initials: "RS", offered: 30, joined: 17, rate: 56.7 },
  { recruiter: "Ananya Pillai", initials: "AP", offered: 25, joined: 16, rate: 64.0 },
];

export const conversionTrend = [
  { week: "23 Mar", value: 48.2 },
  { week: "30 Mar", value: 50.1 },
  { week: "06 Apr", value: 52.3 },
  { week: "13 Apr", value: 56.8 },
  { week: "20 Apr", value: 58.3 },
  { week: "27 Apr", value: 59.6 },
  { week: "04 May", value: 60.2 },
  { week: "11 May", value: 61.0 },
  { week: "18 May", value: 61.1 },
  { week: "25 May", value: 62.4 },
  { week: "01 Jun", value: 62.4 },
  { week: "08 Jun", value: 62.0 },
  { week: "15 Jun", value: 62.5 },
];

export function getCandidate(id: string): Candidate | undefined {
  return candidates.find((c) => c.id === id);
}
