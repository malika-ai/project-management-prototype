
export enum ClientStatus {
  Onboarding = "Onboarding",
  WaitingForData = "Waiting for data",
  Training1 = "Training #1",
  WaitingForFeedback1 = "Waiting for Feedback #1",
  Training2 = "Training #2",
  WaitingForFeedback2 = "Waiting for Feedback #2",
  Training3 = "Training #3",
  Integration = "Integration",
  Active = "Active", // Maintenance phase
  Drop = "Drop"
}

export enum Division {
  Sales = "Sales",
  Support = "Support",
  Trainer = "Trainer",
  IT = "IT",
  QC = "QC"
}

export type Role = "Manager" | "Leader" | "Sales" | "Support" | "Trainer" | "IT" | "Developer" | "QA";

// Mapped to columns: Urgent, High, Regular, Low
export type TaskPriority = 'Urgent' | 'High' | 'Regular' | 'Low';

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
  completedAt?: string; // Added timestamp
}

export interface Client {
  id: string;
  name: string;
  businessName: string;
  package: string;
  description: string;
  email: string;
  whatsapp: string;
  businessField: string;
  status: ClientStatus;
  joinedDate: string;
  totalTimeSpent: number; // in seconds
  requirements: string[]; // Stored for Training #1 generation
  addons: string[]; // Stored for Integration/Addon generation
}

export interface Project {
  id: string;
  name: string;
  clientId?: string; // Optional: Project might not belong to a client (Internal)
  description?: string;
  status: 'Active' | 'Completed' | 'On Hold' | 'Archived';
}

export interface Task {
  id: string;
  title: string;
  projectId: string; // Links to Project (which links to Client)
  division: Division;
  assignees: string[]; // UPDATED: Array of Team Member IDs
  isCompleted: boolean;
  completedAt?: string; // Added timestamp
  timeSpent: number; // in seconds (Total cumulative man-seconds)
  activeUserIds: string[]; // UPDATED: Array of Team Member IDs currently running the timer
  deadline: string; // ISO Date string
  priority: TaskPriority;
  completionPercentage: number; // 0 - 100
  lastProgressNote?: string;
  subtasks: Subtask[];
  createdAt: string; // ISO Date string for Priority Escalation
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  password: string; // Added password field
  role: Role;
  avatar: string;
}

export interface AppSettings {
  theme: 'light' | 'dark'; // Prepared for future use
  compactView: boolean;
  sidebarCollapsed: boolean;
  workflowDeadlines: Record<string, number>; // Key: Task Title, Value: Days to escalate/complete
}

export interface AppState {
  currentUser: TeamMember | null;
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  team: TeamMember[];
  settings: AppSettings;
}