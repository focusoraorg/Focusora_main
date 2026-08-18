import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  DocumentData,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * EXACT FOCUSORA FIRESTORE SCHEMA
 */
export interface GamificationMap {
  achievements?: string[];
  coins: number;
  currentStreakDays: number;
  lastActiveDateISO?: string;
  level: number;
  longestStreakDays: number;
  totalTasksCompleted: number;
  xp: number;
}

export interface DailyLogEntry {
  distractionAttempts: number;
  focusMinutes: number;
  sessionsCompleted: number;
  tasksCompleted: number;
}

export interface InsightsMap {
  dailyLog?: Record<string, DailyLogEntry>;
}

export interface SettingsMap {
  allowList?: string[];
  blockList?: string[];
  blockOutsideFocus?: boolean;
  dailyGoalMinutes?: number;
  focusMinutes?: number;
  longBreakMinutes?: number;
  notificationsEnabled?: boolean;
  sessionsUntilLongBreak?: number;
  shortBreakMinutes?: number;
  soundscapeId?: string;
  soundscapeVolume?: number;
}

export interface FocusoraUserDoc {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  plan: 'free' | 'pro' | 'pro_monthly' | 'pro_yearly' | 'institution' | string;
  lastLoginAt?: any; // Firestore Timestamp or string
  lastSyncedAt?: any;
  gamification?: GamificationMap;
  insights?: InsightsMap;
  settings?: SettingsMap;
  // Computed / UI helper properties
  totalFocusMinutesCalculated?: number;
  totalDistractionsCalculated?: number;
  totalSessionsCalculated?: number;
}

export type AdminUserDoc = FocusoraUserDoc;

export interface SubscriptionDoc {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  plan?: string;
  amount?: number;
  currency?: string;
  status?: 'active' | 'cancelled' | 'refunded' | 'past_due';
  paymentId?: string;
  createdAt?: string;
}

export interface B2BInquiryDoc {
  id: string;
  institutionName: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  seats?: number;
  status?: 'pending' | 'contacted' | 'approved';
  message?: string;
  createdAt?: string;
}

export interface RealPlatformMetrics {
  totalUsers: number;
  proUsersCount: number;
  freeUsersCount: number;
  totalFocusMinutes: number;
  totalFocusHours: number;
  totalSessionsCount: number;
  totalDistractionsBlocked: number;
  totalTasksCompleted: number;
  b2bInquiriesCount: number;
  totalRevenueINR: number;
}

/**
 * Normalizes Firestore document according to Focusora Schema
 */
export const normalizeFocusoraUser = (docId: string, data: Record<string, any>): FocusoraUserDoc => {
  const gamification: GamificationMap = {
    achievements: Array.isArray(data.gamification?.achievements) ? data.gamification.achievements : [],
    coins: typeof data.gamification?.coins === 'number' ? data.gamification.coins : (typeof data.coins === 'number' ? data.coins : 0),
    currentStreakDays: typeof data.gamification?.currentStreakDays === 'number' ? data.gamification.currentStreakDays : (typeof data.streak === 'number' ? data.streak : 0),
    lastActiveDateISO: data.gamification?.lastActiveDateISO || '',
    level: typeof data.gamification?.level === 'number' ? data.gamification.level : (typeof data.level === 'number' ? data.level : 1),
    longestStreakDays: typeof data.gamification?.longestStreakDays === 'number' ? data.gamification.longestStreakDays : (typeof data.longestStreak === 'number' ? data.longestStreak : 0),
    totalTasksCompleted: typeof data.gamification?.totalTasksCompleted === 'number' ? data.gamification.totalTasksCompleted : 0,
    xp: typeof data.gamification?.xp === 'number' ? data.gamification.xp : (typeof data.xp === 'number' ? data.xp : 0)
  };

  const insights: InsightsMap = {
    dailyLog: (data.insights && typeof data.insights.dailyLog === 'object' && data.insights.dailyLog !== null)
      ? data.insights.dailyLog
      : {}
  };

  const settings: SettingsMap = {
    allowList: Array.isArray(data.settings?.allowList) ? data.settings.allowList : [],
    blockList: Array.isArray(data.settings?.blockList) ? data.settings.blockList : [],
    blockOutsideFocus: Boolean(data.settings?.blockOutsideFocus),
    dailyGoalMinutes: typeof data.settings?.dailyGoalMinutes === 'number' ? data.settings.dailyGoalMinutes : 100,
    focusMinutes: typeof data.settings?.focusMinutes === 'number' ? data.settings.focusMinutes : 25,
    longBreakMinutes: typeof data.settings?.longBreakMinutes === 'number' ? data.settings.longBreakMinutes : 15,
    notificationsEnabled: data.settings?.notificationsEnabled !== false,
    sessionsUntilLongBreak: typeof data.settings?.sessionsUntilLongBreak === 'number' ? data.settings.sessionsUntilLongBreak : 4,
    shortBreakMinutes: typeof data.settings?.shortBreakMinutes === 'number' ? data.settings.shortBreakMinutes : 5,
    soundscapeId: data.settings?.soundscapeId || 'none',
    soundscapeVolume: typeof data.settings?.soundscapeVolume === 'number' ? data.settings.soundscapeVolume : 50
  };

  // Compute aggregated focus stats from insights.dailyLog
  let totalFocusMinutes = 0;
  let totalDistractions = 0;
  let totalSessions = 0;

  if (insights.dailyLog) {
    Object.values(insights.dailyLog).forEach((log: any) => {
      if (log) {
        if (typeof log.focusMinutes === 'number') totalFocusMinutes += log.focusMinutes;
        if (typeof log.distractionAttempts === 'number') totalDistractions += log.distractionAttempts;
        if (typeof log.sessionsCompleted === 'number') totalSessions += log.sessionsCompleted;
      }
    });
  }

  // Format timestamps
  const formatTimestamp = (ts: any): string => {
    if (!ts) return new Date().toISOString();
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toISOString();
    if (typeof ts === 'string') return ts;
    return new Date().toISOString();
  };

  return {
    uid: data.uid || docId,
    displayName: data.displayName || data.name || (data.email ? data.email.split('@')[0] : 'Focusora User'),
    email: data.email || 'No email provided',
    photoURL: data.photoURL || undefined,
    plan: data.plan || 'free',
    lastLoginAt: formatTimestamp(data.lastLoginAt),
    lastSyncedAt: formatTimestamp(data.lastSyncedAt),
    gamification,
    insights,
    settings,
    totalFocusMinutesCalculated: totalFocusMinutes,
    totalDistractionsCalculated: totalDistractions,
    totalSessionsCalculated: totalSessions
  };
};

/**
 * 1. REAL-TIME LISTENER FOR ALL USERS
 */
export const subscribeToRealUsers = (
  onUpdate: (users: FocusoraUserDoc[]) => void,
  onError: (error: Error) => void
) => {
  try {
    const usersCol = collection(db, 'users');
    return onSnapshot(
      usersCol,
      (snapshot) => {
        console.log(`[Firestore] users snapshot size: ${snapshot.size}`);
        const userList: FocusoraUserDoc[] = snapshot.docs.map((docSnap) =>
          normalizeFocusoraUser(docSnap.id, docSnap.data())
        );
        onUpdate(userList);
      },
      (err) => {
        console.error('[Firestore] Error in users snapshot:', err);
        onError(err);
      }
    );
  } catch (e: any) {
    console.error('[Firestore] subscribeToRealUsers error:', e);
    onError(e);
    return () => {};
  }
};

/**
 * Direct Manual Fetch for all users
 */
export const fetchAllUsersDirect = async (): Promise<FocusoraUserDoc[]> => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    console.log(`[Firestore Direct] Read ${snap.size} documents from 'users'`);
    return snap.docs.map((d) => normalizeFocusoraUser(d.id, d.data()));
  } catch (err) {
    console.error('[Firestore Direct Error]:', err);
    throw err;
  }
};

/**
 * 2. REAL-TIME SUBSCRIPTIONS
 */
export const subscribeToRealSubscriptions = (
  onUpdate: (subs: SubscriptionDoc[]) => void,
  onError: (error: Error) => void
) => {
  try {
    const subsCol = collection(db, 'subscriptions');
    return onSnapshot(
      subsCol,
      (snapshot) => {
        const subs: SubscriptionDoc[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId || data.uid,
            userName: data.userName || data.name || 'Subscriber',
            userEmail: data.userEmail || data.email || '',
            plan: data.plan || data.planName || 'Pro',
            amount: typeof data.amount === 'number' ? data.amount : 79,
            currency: data.currency || 'INR',
            status: data.status || 'active',
            paymentId: data.paymentId || data.razorpay_payment_id || d.id,
            createdAt: data.createdAt || data.date || new Date().toISOString()
          };
        });
        onUpdate(subs);
      },
      (err) => {
        console.error('[Firestore] Subscriptions snapshot note:', err);
        onError(err);
      }
    );
  } catch (e: any) {
    onError(e);
    return () => {};
  }
};

/**
 * 3. REAL-TIME B2B INQUIRIES
 */
export const subscribeToRealB2BInquiries = (
  onUpdate: (inquiries: B2BInquiryDoc[]) => void,
  onError: (error: Error) => void
) => {
  try {
    const inqCol = collection(db, 'b2b_inquiries');
    return onSnapshot(
      inqCol,
      (snapshot) => {
        const inquiries: B2BInquiryDoc[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            institutionName: data.institutionName || data.university || data.name || 'Institution',
            contactName: data.contactName || data.coordinator || 'Coordinator',
            contactEmail: data.contactEmail || data.email || '',
            phone: data.phone || data.mobile,
            seats: data.seats || 250,
            status: data.status || 'pending',
            message: data.message || data.notes || '',
            createdAt: data.createdAt || new Date().toISOString()
          };
        });
        onUpdate(inquiries);
      },
      (err) => {
        console.error('[Firestore] B2B snapshot note:', err);
        onError(err);
      }
    );
  } catch (e: any) {
    onError(e);
    return () => {};
  }
};

/**
 * 4. MUTATION ACTIONS FOR ADMIN
 */
export const updateRealUserDoc = async (uid: string, updates: Partial<FocusoraUserDoc>) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updates as DocumentData);
};

export const deleteRealUserDoc = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  await deleteDoc(userRef);
};

export const updateRealSubscriptionStatus = async (subId: string, status: 'active' | 'refunded' | 'cancelled') => {
  const subRef = doc(db, 'subscriptions', subId);
  await updateDoc(subRef, { status, updatedAt: new Date().toISOString() });
};

export const updateRealB2BInquiryStatus = async (inqId: string, status: 'pending' | 'contacted' | 'approved') => {
  const inqRef = doc(db, 'b2b_inquiries', inqId);
  await updateDoc(inqRef, { status, updatedAt: new Date().toISOString() });
};

/**
 * 5. CALCULATE LIVE AGGREGATED METRICS ACROSS ALL USERS
 */
export const calculateLivePlatformMetrics = (
  users: FocusoraUserDoc[],
  subs: SubscriptionDoc[],
  inqs: B2BInquiryDoc[]
): RealPlatformMetrics => {
  let proCount = 0;
  let freeCount = 0;
  let totalFocusMinutes = 0;
  let totalSessions = 0;
  let totalDistractions = 0;
  let totalTasksCompleted = 0;

  users.forEach((u) => {
    const plan = (u.plan || '').toLowerCase();
    if (plan.includes('pro') || plan.includes('yearly') || plan.includes('monthly') || plan.includes('institution')) {
      proCount++;
    } else {
      freeCount++;
    }

    // Add stats from gamification
    if (u.gamification) {
      totalTasksCompleted += u.gamification.totalTasksCompleted || 0;
    }

    // Add stats computed from insights.dailyLog
    if (u.totalFocusMinutesCalculated) totalFocusMinutes += u.totalFocusMinutesCalculated;
    if (u.totalDistractionsCalculated) totalDistractions += u.totalDistractionsCalculated;
    if (u.totalSessionsCalculated) totalSessions += u.totalSessionsCalculated;
  });

  const totalFocusHours = Number((totalFocusMinutes / 60).toFixed(1));

  let totalRevenue = 0;
  subs.forEach((s) => {
    if (s.status === 'active' && s.amount) {
      totalRevenue += Number(s.amount);
    }
  });

  return {
    totalUsers: users.length,
    proUsersCount: proCount,
    freeUsersCount: freeCount,
    totalFocusMinutes,
    totalFocusHours,
    totalSessionsCount: totalSessions,
    totalDistractionsBlocked: totalDistractions,
    totalTasksCompleted,
    b2bInquiriesCount: inqs.length,
    totalRevenueINR: totalRevenue
  };
};
