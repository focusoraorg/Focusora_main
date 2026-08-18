export type PlanType = 'free' | 'pro_monthly' | 'pro_yearly' | 'institution';
export type UserRole = 'user' | 'admin' | 'institution_admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  plan: PlanType;
  role: UserRole;
  xp: number;
  coins: number;
  level: number;
  streak: number;
  longestStreak: number;
  dailyGoalMinutes: number;
  notionConnected: boolean;
  notionDatabaseId?: string;
  notionWorkspaceName?: string;
  createdAt: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'suspended';
}

export interface FocusSession {
  id: string;
  userId: string;
  taskId?: string;
  taskTitle?: string;
  duration: number; // in seconds
  mode: 'pomodoro' | 'short_break' | 'long_break';
  completed: boolean;
  distractionAttempts: number;
  xpEarned: number;
  coinsEarned: number;
  postureScore?: number; // 0 - 100
  notes?: string;
  timestamp: string;
}

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'completed';
  source: 'manual' | 'notion' | 'ai';
  estimatedMinutes: number;
  dueToday?: boolean;
  notionPageId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface BlockerRule {
  id: string;
  userId: string;
  domain: string;
  category: 'Social Media' | 'Video & Streaming' | 'Gaming' | 'News' | 'Custom';
  enabled: boolean;
  attemptsBlocked: number;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  plan: string;
  planType: 'monthly' | 'yearly' | 'b2b';
  amount: number;
  currency: string;
  status: 'active' | 'cancelled' | 'refunded' | 'past_due';
  paymentId: string;
  createdAt: string;
}

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'theme' | 'soundscape' | 'badge' | 'ai_boost' | 'discount';
  icon: string;
  badge?: string;
  previewColor?: string;
}

export interface UserRedemption {
  id: string;
  userId: string;
  itemId: string;
  itemName: string;
  coinsSpent: number;
  redeemedAt: string;
}

export interface AILog {
  id: string;
  userId: string;
  type: 'daily_planner' | 'task_breakdown' | 'reflection' | 'recommendation';
  prompt: string;
  response: string;
  tokensUsed: number;
  estimatedCostUsd: number;
  createdAt: string;
}

export interface B2BInquiry {
  id: string;
  institutionName: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  seats: number;
  status: 'pending' | 'contacted' | 'active';
  message?: string;
  createdAt: string;
}

export interface AdminMetrics {
  totalUsers: number;
  activeUsersMonth: number;
  b2bClients: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  totalFocusHours: number;
  totalSessionsCompleted: number;
  aiTokensTotal: number;
  aiEstimatedCost: number;
  notionConnectedUsers: number;
  blockerAttemptsToday: number;
}
