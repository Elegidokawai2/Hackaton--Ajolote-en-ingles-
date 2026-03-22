// ── User ──
export interface User {
  _id: string;
  email: string;
  role: 'freelancer' | 'recruiter' | 'admin';
  username: string;
  profile_image: string;
  bio: string;
  country: string;
  status: 'active' | 'suspended' | 'banned';
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface FreelancerProfile {
  _id: string;
  user_id: string;
  title: string;
  description: string;
  skills: string[];
  experience_level: 'junior' | 'mid' | 'senior';
  availability: string;
  portfolio_url: string;
  created_at: string;
  updated_at: string;
}

export interface RecruiterProfile {
  _id: string;
  user_id: string;
  company_description: string;
  website: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithProfile {
  user: User;
  profile: FreelancerProfile | RecruiterProfile | null;
}

// ── Category ──
export interface Category {
  _id: string;
  name: string;
  description: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Event ──
export interface Event {
  _id: string;
  recruiter_id: User | string;
  title: string;
  description: string;
  category_id: Category | string;
  prize_amount: number;
  max_winners: number;
  deadline_submission: string;
  deadline_selection: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  soroban_event_id?: string;
  created_at: string;
  updated_at: string;
}

export interface EventParticipant {
  _id: string;
  event_id: string;
  freelancer_id: string;
  status: 'applied' | 'submitted' | 'winner' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface EventSubmission {
  _id: string;
  event_id: string;
  freelancer_id: string;
  file_url: string;
  description: string;
  is_winner: boolean;
  submitted_at: string;
  updated_at: string;
}

// ── Project ──
export interface Project {
  _id: string;
  recruiter_id: User | string;
  freelancer_id: User | string;
  category_id: Category | string;
  title: string;
  description: string;
  amount: number;
  guarantee: number;
  deadline: string;
  status: 'proposed' | 'active' | 'review' | 'completed' | 'rejected' | 'disputed';
  soroban_project_id?: string;
  correction_used: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectDelivery {
  _id: string;
  project_id: string;
  file_url: string;
  description: string;
  submitted_at: string;
}

export interface ProjectStatusLog {
  _id: string;
  project_id: string;
  status: string;
  changed_by: string;
  created_at: string;
}

// ── Conversation & Message ──
export interface Conversation {
  _id: string;
  project_id: string | null;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  _id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  attachment_url?: string;
  read_at: string | null;
  created_at: string;
}

// ── Wallet ──
export interface Wallet {
  _id: string;
  user_id: string;
  stellar_address: string;
  balance_mxne: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  _id: string;
  user_id: string;
  type: 'deposit' | 'withdraw' | 'escrow' | 'release';
  amount_mxn: number;
  amount_mxne: number;
  status: 'pending' | 'completed' | 'failed';
  stellar_tx_hash?: string;
  created_at: string;
  updated_at: string;
}

// ── Reputation ──
export interface Reputation {
  _id: string;
  user_id: string;
  category_id: Category | string;
  score: number;
  level: string;
  created_at: string;
  updated_at: string;
}

export interface ReputationLog {
  _id: string;
  user_id: string;
  category_id: string;
  delta: number;
  reason: string;
  source_type: 'event' | 'project' | 'dispute';
  source_id: string;
  soroban_tx_hash?: string;
  created_at: string;
}

// ── Dispute ──
export interface Dispute {
  _id: string;
  project_id: string | Project;
  opened_by: string;
  reason: string;
  description: string;
  status: 'open' | 'reviewing' | 'resolved';
  resolution: 'freelancer' | 'recruiter' | 'none';
  resolved_by?: string;
  created_at: string;
  updated_at: string;
}

// ── Notification ──
export interface Notification {
  _id: string;
  user_id: string;
  type: 'event' | 'project' | 'payment' | 'system';
  title: string;
  message: string;
  reference_id?: string;
  read: boolean;
  created_at: string;
  updated_at: string;
}

// ── Search Index ──
export interface SearchFreelancer {
  _id: string;
  user_id: {
    _id: string;
    username: string;
    profile_image?: string;
    bio?: string;
    stellar_public_key?: string;
  };
  skills: string[];
  title: string;
  reputation_score: number;
  completed_projects: number;
  rating: number;
}
