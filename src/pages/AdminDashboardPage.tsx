import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Users,
  Building,
  IndianRupee,
  Clock,
  Download,
  Search,
  Filter,
  Shield,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Sun,
  Moon,
  Eye,
  Check,
  X,
  ListTodo,
  Calendar,
  Zap,
  Activity,
  Layers,
  Database,
  Server,
  Flame,
  Award,
  Sliders,
  Volume2,
  Target
} from 'lucide-react';
import {
  subscribeToRealUsers,
  subscribeToRealSubscriptions,
  subscribeToRealB2BInquiries,
  fetchAllUsersDirect,
  updateRealUserDoc,
  deleteRealUserDoc,
  updateRealSubscriptionStatus,
  updateRealB2BInquiryStatus,
  calculateLivePlatformMetrics,
  FocusoraUserDoc,
  SubscriptionDoc,
  B2BInquiryDoc,
  RealPlatformMetrics
} from '../services/adminFirestoreService';

export const AdminDashboardPage: React.FC = () => {
  const { adminUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'subscriptions' | 'b2b' | 'export' | 'diagnostics'
  >('overview');

  // Live Firestore State
  const [users, setUsers] = useState<FocusoraUserDoc[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionDoc[]>([]);
  const [b2bInquiries, setB2BInquiries] = useState<B2BInquiryDoc[]>([]);
  const [metrics, setMetrics] = useState<RealPlatformMetrics>({
    totalUsers: 0,
    proUsersCount: 0,
    freeUsersCount: 0,
    totalFocusMinutes: 0,
    totalFocusHours: 0,
    totalSessionsCount: 0,
    totalDistractionsBlocked: 0,
    totalTasksCompleted: 0,
    b2bInquiriesCount: 0,
    totalRevenueINR: 0
  });

  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // User Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro' | 'institution'>('all');

  // Selected User for Deep Inspection Drawer
  const [inspectUser, setInspectUser] = useState<FocusoraUserDoc | null>(null);

  // User Edit Modal
  const [editingUser, setEditingUser] = useState<FocusoraUserDoc | null>(null);

  // Subscribe to real Firestore data
  useEffect(() => {
    setLoading(true);
    setFirestoreError(null);

    const unsubUsers = subscribeToRealUsers(
      (newUsers) => {
        setUsers(newUsers);
        setLoading(false);
      },
      (err) => {
        setFirestoreError(err.message);
        setLoading(false);
      }
    );

    const unsubSubs = subscribeToRealSubscriptions(
      (newSubs) => setSubscriptions(newSubs),
      (err) => console.warn('Subscriptions listener note:', err)
    );

    const unsubB2B = subscribeToRealB2BInquiries(
      (newInqs) => setB2BInquiries(newInqs),
      (err) => console.warn('B2B listener note:', err)
    );

    return () => {
      unsubUsers();
      unsubSubs();
      unsubB2B();
    };
  }, []);

  // Recalculate metrics whenever live datasets update
  useEffect(() => {
    const computed = calculateLivePlatformMetrics(users, subscriptions, b2bInquiries);
    setMetrics(computed);
  }, [users, subscriptions, b2bInquiries]);

  // Keep inspected user state fresh if users array updates
  useEffect(() => {
    if (inspectUser) {
      const refreshed = users.find((u) => u.uid === inspectUser.uid);
      if (refreshed) {
        setInspectUser(refreshed);
      }
    }
  }, [users]);

  // Manual Direct Reload
  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const directUsers = await fetchAllUsersDirect();
      setUsers(directUsers);
      setFirestoreError(null);
    } catch (e: any) {
      console.error('Manual refresh error:', e);
      setFirestoreError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // User Edit Handler
  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    try {
      await updateRealUserDoc(editingUser.uid, editingUser);
      setEditingUser(null);
    } catch (e: any) {
      alert(`Error updating user: ${e.message}`);
    }
  };

  // User Delete Handler
  const handleDeleteUser = async (uid: string, name?: string) => {
    if (confirm(`Are you sure you want to delete user "${name || uid}" from Firestore?`)) {
      try {
        await deleteRealUserDoc(uid);
        if (inspectUser?.uid === uid) setInspectUser(null);
      } catch (e: any) {
        alert(`Error deleting user: ${e.message}`);
      }
    }
  };

  // Subscription Status Handler
  const handleToggleSubStatus = async (subId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'active' ? 'refunded' : 'active';
    try {
      await updateRealSubscriptionStatus(subId, nextStatus);
    } catch (e: any) {
      alert(`Error updating subscription: ${e.message}`);
    }
  };

  // B2B Inquiry Status Handler
  const handleUpdateB2BStatus = async (inqId: string, status: 'pending' | 'contacted' | 'approved') => {
    try {
      await updateRealB2BInquiryStatus(inqId, status);
    } catch (e: any) {
      alert(`Error updating lead: ${e.message}`);
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.uid.toLowerCase().includes(searchQuery.toLowerCase());

    const plan = (u.plan || '').toLowerCase();
    const matchesPlan =
      planFilter === 'all' ||
      (planFilter === 'free' && (!plan || plan === 'free')) ||
      (planFilter === 'pro' && (plan.includes('pro') || plan.includes('yearly') || plan.includes('monthly'))) ||
      (planFilter === 'institution' && plan.includes('institution'));

    return matchesSearch && matchesPlan;
  });

  // CSV Exporters for Real Data
  const exportRealUsersCSV = () => {
    if (users.length === 0) {
      alert('No user records in Firestore to export.');
      return;
    }
    const headers = ['UID,DisplayName,Email,Plan,XP,Coins,Level,CurrentStreakDays,LongestStreakDays,TasksCompleted,TotalFocusMinutes,DistractionsBlocked,LastLoginAt\n'];
    const rows = users.map(
      (u) =>
        `"${u.uid}","${u.displayName}","${u.email}","${u.plan}",${u.gamification?.xp || 0},${u.gamification?.coins || 0},${u.gamification?.level || 1},${u.gamification?.currentStreakDays || 0},${u.gamification?.longestStreakDays || 0},${u.gamification?.totalTasksCompleted || 0},${u.totalFocusMinutesCalculated || 0},${u.totalDistractionsCalculated || 0},"${u.lastLoginAt || ''}"`
    );
    downloadCSV(headers.concat(rows).join('\n'), `focusora_users_${Date.now()}.csv`);
  };

  const exportRealSubscriptionsCSV = () => {
    if (subscriptions.length === 0) {
      alert('No subscription records in Firestore yet.');
      return;
    }
    const headers = ['SubscriptionID,UserName,UserEmail,Plan,Amount,Currency,Status,PaymentID,Date\n'];
    const rows = subscriptions.map(
      (s) =>
        `"${s.id}","${s.userName || ''}","${s.userEmail || ''}","${s.plan || ''}",${s.amount || 0},"${s.currency || 'INR'}","${s.status || 'active'}","${s.paymentId || ''}","${s.createdAt || ''}"`
    );
    downloadCSV(headers.concat(rows).join('\n'), `focusora_subscriptions_${Date.now()}.csv`);
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  return (
    <div className="admin-portal-root">
      {/* Top Bar */}
      <header className="admin-top-bar">
        <div className="admin-brand-wrap">
          <img
            src="/logo.png"
            alt="Focusora"
            className="admin-brand-logo"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'logo.png';
            }}
          />
          <div className="brand-badge-col">
            <span className="brand-title">Focusora Admin Console</span>
            <span className="live-db-pill">
              <span className="pulse-dot green"></span> Live Firestore (focusora-ca5a8)
            </span>
          </div>
        </div>

        <div className="admin-top-actions">
          {/* Quick Refresh */}
          <button
            onClick={handleManualRefresh}
            className="admin-icon-btn"
            title="Refresh from Firestore"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'admin-spinner' : ''} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="admin-icon-btn"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Admin User Info */}
          <div className="admin-user-pill">
            <div className="admin-avatar-circle">
              <Shield size={15} />
            </div>
            <div className="admin-user-text">
              <span className="admin-user-name">{adminUser?.displayName || 'Administrator'}</span>
              <span className="admin-user-email">{adminUser?.email || 'admin@focusora.app'}</span>
            </div>
          </div>

          {/* Logout */}
          <button onClick={logout} className="admin-logout-btn" title="Sign Out">
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Workspace with Sidebar */}
      <div className="admin-portal-body">
        {/* Sidebar Nav */}
        <aside className="admin-portal-sidebar">
          <nav className="admin-side-nav">
            <button
              className={`side-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Activity size={18} />
              <span>Platform Insights</span>
            </button>

            <button
              className={`side-nav-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={18} />
              <span>Users Directory</span>
              <span className="side-badge">{users.length}</span>
            </button>

            <button
              className={`side-nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
              onClick={() => setActiveTab('subscriptions')}
            >
              <IndianRupee size={18} />
              <span>Subscriptions</span>
              <span className="side-badge">{subscriptions.length}</span>
            </button>

            <button
              className={`side-nav-item ${activeTab === 'b2b' ? 'active' : ''}`}
              onClick={() => setActiveTab('b2b')}
            >
              <Building size={18} />
              <span>B2B Campus Leads</span>
              <span className="side-badge">{b2bInquiries.length}</span>
            </button>

            <button
              className={`side-nav-item ${activeTab === 'export' ? 'active' : ''}`}
              onClick={() => setActiveTab('export')}
            >
              <Download size={18} />
              <span>Data Export</span>
            </button>

            <button
              className={`side-nav-item ${activeTab === 'diagnostics' ? 'active' : ''}`}
              onClick={() => setActiveTab('diagnostics')}
            >
              <Database size={18} />
              <span>System Status</span>
            </button>
          </nav>

          <div className="sidebar-db-status">
            <div className="db-status-header">
              <Server size={14} color="#10b981" />
              <span>focusora-ca5a8</span>
            </div>
            <p>Database: (default) • Location: asia-south1</p>
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="admin-content-area">
          {firestoreError && (
            <div className="firestore-error-banner">
              <AlertTriangle size={18} />
              <div>
                <strong>Firestore Sync Notice:</strong> {firestoreError}
              </div>
            </div>
          )}

          {/* TAB 1: PLATFORM OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-pane-fade">
              <div className="pane-header-row">
                <div>
                  <h2>Platform Telemetry & Insights</h2>
                  <p className="pane-subtitle">Computed live across all {users.length} registered user documents in Firestore.</p>
                </div>
              </div>

              {/* Real-time KPI Metric Grid */}
              <div className="real-kpi-grid">
                <div className="real-kpi-card">
                  <div className="kpi-icon-box purple"><Users size={24} /></div>
                  <div className="kpi-data-col">
                    <h3>Registered Users</h3>
                    <p className="kpi-main-number">{metrics.totalUsers}</p>
                    <span className="kpi-detail">
                      {metrics.proUsersCount} Pro • {metrics.freeUsersCount} Free
                    </span>
                  </div>
                </div>

                <div className="real-kpi-card">
                  <div className="kpi-icon-box green"><Clock size={24} /></div>
                  <div className="kpi-data-col">
                    <h3>Total Focus Logged</h3>
                    <p className="kpi-main-number">{metrics.totalFocusMinutes} min</p>
                    <span className="kpi-detail">
                      {metrics.totalSessionsCount} focus blocks • {metrics.totalFocusHours} hrs
                    </span>
                  </div>
                </div>

                <div className="real-kpi-card">
                  <div className="kpi-icon-box amber"><Shield size={24} /></div>
                  <div className="kpi-data-col">
                    <h3>Distractions Shielded</h3>
                    <p className="kpi-main-number">{metrics.totalDistractionsBlocked}</p>
                    <span className="kpi-detail">Attempts avoided by active blockers</span>
                  </div>
                </div>

                <div className="real-kpi-card">
                  <div className="kpi-icon-box teal"><CheckCircle2 size={24} /></div>
                  <div className="kpi-data-col">
                    <h3>Tasks Completed</h3>
                    <p className="kpi-main-number">{metrics.totalTasksCompleted}</p>
                    <span className="kpi-detail">User productivity milestones</span>
                  </div>
                </div>
              </div>

              {/* Overview Users Grid */}
              <div className="overview-sections-grid">
                <div className="admin-panel-card">
                  <div className="card-top-bar">
                    <h3>Active Users ({users.length})</h3>
                    <button onClick={() => setActiveTab('users')} className="btn-text-link">
                      View All Directory →
                    </button>
                  </div>

                  {users.length === 0 ? (
                    <div className="empty-state-box">
                      <Users size={36} color="#94a3b8" />
                      <h4>No User Documents in Firestore</h4>
                      <p>When users sign into the extension, their document will appear here in real-time.</p>
                    </div>
                  ) : (
                    <div className="mini-users-table-wrap">
                      <table className="admin-data-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Plan</th>
                            <th>Level & XP</th>
                            <th>Streak</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.uid}>
                              <td>
                                <div className="user-table-cell">
                                  <div className="user-initials-avatar">
                                    {(u.displayName || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <strong className="user-name-text">{u.displayName}</strong>
                                    <span className="user-email-text">{u.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td><span className={`plan-pill ${u.plan}`}>{u.plan}</span></td>
                              <td>
                                <div className="xp-coins-stack">
                                  <strong>Level {u.gamification?.level || 1}</strong>
                                  <span className="coins-text">{u.gamification?.xp || 0} XP • 🪙 {u.gamification?.coins || 0}</span>
                                </div>
                              </td>
                              <td>
                                <span className="streak-tag">🔥 {u.gamification?.currentStreakDays || 0}d</span>
                              </td>
                              <td>
                                <button
                                  onClick={() => {
                                    setInspectUser(u);
                                    setActiveTab('users');
                                  }}
                                  className="btn-action-icon view"
                                  title="Inspect full insights & blocker settings"
                                >
                                  <Eye size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* B2B Institutional Inquiries Preview */}
                <div className="admin-panel-card">
                  <div className="card-top-bar">
                    <h3>B2B Campus Leads ({b2bInquiries.length})</h3>
                    <button onClick={() => setActiveTab('b2b')} className="btn-text-link">
                      Manage Leads →
                    </button>
                  </div>

                  {b2bInquiries.length === 0 ? (
                    <div className="empty-state-box">
                      <Building size={36} color="#94a3b8" />
                      <h4>No Campus Inquiries Yet</h4>
                      <p>Inquiries submitted will appear directly in this collection.</p>
                    </div>
                  ) : (
                    <div className="mini-leads-list">
                      {b2bInquiries.slice(0, 4).map((inq) => (
                        <div key={inq.id} className="lead-row-item">
                          <div>
                            <strong>{inq.institutionName}</strong>
                            <p className="lead-contact-sub">{inq.contactName} • {inq.contactEmail} • {inq.seats || 250} seats</p>
                          </div>
                          <span className={`status-tag ${inq.status || 'pending'}`}>{inq.status || 'pending'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS DIRECTORY & DEEP INSPECTION */}
          {activeTab === 'users' && (
            <div className="tab-pane-fade">
              <div className="pane-header-row">
                <div>
                  <h2>Users Directory ({filteredUsers.length})</h2>
                  <p className="pane-subtitle">Live inspection of Focusora user documents, gamification stats, and blocker configurations.</p>
                </div>
                <button onClick={exportRealUsersCSV} className="btn-admin-secondary">
                  <Download size={15} /> Export Users (CSV)
                </button>
              </div>

              {/* Filter & Search Bar */}
              <div className="table-filter-bar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by display name, email, or UID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value as any)}
                  className="filter-select"
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free Explorer</option>
                  <option value="pro">Pro</option>
                  <option value="institution">Institutional Seat</option>
                </select>
              </div>

              {/* Main Users Table */}
              <div className="admin-panel-card no-padding">
                {filteredUsers.length === 0 ? (
                  <div className="empty-state-box">
                    <Users size={36} color="#94a3b8" />
                    <h4>No Matching Users</h4>
                    <p>{searchQuery ? 'Try adjusting your search query.' : 'No users found in the `users` collection.'}</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="admin-data-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Plan</th>
                          <th>Gamification (Level / XP)</th>
                          <th>Streak</th>
                          <th>Tasks Done</th>
                          <th>Focus Logged</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.uid} className={inspectUser?.uid === u.uid ? 'row-selected' : ''}>
                            <td>
                              <div className="user-table-cell">
                                <div className="user-initials-avatar">
                                  {(u.displayName || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <strong className="user-name-text">{u.displayName}</strong>
                                  <span className="user-email-text">{u.email}</span>
                                  <span className="user-uid-text">UID: {u.uid}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`plan-pill ${u.plan}`}>{u.plan}</span>
                            </td>
                            <td>
                              <div className="xp-coins-stack">
                                <strong>Level {u.gamification?.level || 1} • {u.gamification?.xp || 0} XP</strong>
                                <span className="coins-text">🪙 {u.gamification?.coins || 0} Coins</span>
                              </div>
                            </td>
                            <td>
                              <span className="streak-tag">🔥 {u.gamification?.currentStreakDays || 0}d (best: {u.gamification?.longestStreakDays || 0}d)</span>
                            </td>
                            <td>
                              <strong>{u.gamification?.totalTasksCompleted || 0} tasks</strong>
                            </td>
                            <td>
                              <span className="duration-tag">{u.totalFocusMinutesCalculated || 0} min</span>
                              <div className="user-uid-text">{u.totalDistractionsCalculated || 0} shielded</div>
                            </td>
                            <td>
                              <div className="table-action-btns">
                                <button
                                  onClick={() => setInspectUser(inspectUser?.uid === u.uid ? null : u)}
                                  className="btn-action-icon view"
                                  title="Inspect Daily Log & Settings"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  onClick={() => setEditingUser(u)}
                                  className="btn-action-icon edit"
                                  title="Edit User Document"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.uid, u.displayName)}
                                  className="btn-action-icon delete"
                                  title="Delete User from Firestore"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* USER DEEP INSPECTION DRAWER */}
              {inspectUser && (
                <div className="inspection-drawer-card admin-panel-card" style={{ marginTop: '2rem' }}>
                  <div className="card-top-bar">
                    <div className="inspect-user-header">
                      <div className="user-initials-avatar large">
                        {(inspectUser.displayName || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3>User Insights & Configurations: {inspectUser.displayName}</h3>
                        <p className="pane-subtitle">{inspectUser.email} • UID: <code>{inspectUser.uid}</code></p>
                      </div>
                    </div>
                    <button onClick={() => setInspectUser(null)} className="btn-close-inspect">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="inspect-subcollections-grid">
                    {/* Block 1: Daily Focus Log (`insights.dailyLog`) */}
                    <div className="subcollection-box">
                      <h4>
                        <Calendar size={16} /> Daily Focus Log (`insights.dailyLog`)
                      </h4>
                      {(!inspectUser.insights?.dailyLog || Object.keys(inspectUser.insights.dailyLog).length === 0) ? (
                        <p className="no-sub-data">No daily log entries recorded yet.</p>
                      ) : (
                        <div className="sub-scroll-list">
                          {Object.entries(inspectUser.insights.dailyLog).map(([dateKey, log]) => (
                            <div key={dateKey} className="sub-item-card">
                              <div className="sub-item-top">
                                <strong>📅 {dateKey}</strong>
                                <span className="duration-tag">{log.focusMinutes || 0} min focus</span>
                              </div>
                              <div className="sub-item-meta">
                                <span>{log.sessionsCompleted || 0} sessions • {log.tasksCompleted || 0} tasks</span>
                                <span>🛡️ {log.distractionAttempts || 0} shielded</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Block 2: Distraction Block List (`settings.blockList`) */}
                    <div className="subcollection-box">
                      <h4>
                        <Shield size={16} /> Blocked Sites (`settings.blockList`) — {inspectUser.settings?.blockList?.length || 0}
                      </h4>
                      <div style={{ marginBottom: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Block outside focus: <strong>{inspectUser.settings?.blockOutsideFocus ? '🟢 Enabled' : '⚪ Disabled'}</strong>
                      </div>
                      {(!inspectUser.settings?.blockList || inspectUser.settings.blockList.length === 0) ? (
                        <p className="no-sub-data">No domains in blockList.</p>
                      ) : (
                        <div className="sub-scroll-list" style={{ maxHeight: '200px' }}>
                          {inspectUser.settings.blockList.map((domain, idx) => (
                            <div key={idx} className="sub-item-card" style={{ padding: '6px 10px' }}>
                              <div className="sub-item-top" style={{ marginBottom: 0 }}>
                                <strong style={{ fontSize: '0.82rem' }}>🚫 {domain}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Block 3: Settings & Timer Preferences */}
                    <div className="subcollection-box">
                      <h4>
                        <Sliders size={16} /> Timer & Work Preferences (`settings`)
                      </h4>
                      <div className="sub-item-card">
                        <div className="sub-item-meta" style={{ flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                          <div>⏱️ Focus Duration: <strong>{inspectUser.settings?.focusMinutes || 25} minutes</strong></div>
                          <div>🎯 Daily Goal: <strong>{inspectUser.settings?.dailyGoalMinutes || 100} minutes</strong></div>
                          <div>☕ Short Break: <strong>{inspectUser.settings?.shortBreakMinutes || 5} min</strong> • Long Break: <strong>{inspectUser.settings?.longBreakMinutes || 15} min</strong></div>
                          <div>🔔 Notifications: <strong>{inspectUser.settings?.notificationsEnabled ? 'Enabled' : 'Disabled'}</strong></div>
                          <div>🎧 Soundscape: <strong>{inspectUser.settings?.soundscapeId || 'none'}</strong> (Vol: {inspectUser.settings?.soundscapeVolume || 50}%)</div>
                        </div>
                      </div>

                      {/* Gamification Achievements */}
                      <h4 style={{ marginTop: '1rem' }}>
                        <Award size={16} /> Achievements ({inspectUser.gamification?.achievements?.length || 0})
                      </h4>
                      {(!inspectUser.gamification?.achievements || inspectUser.gamification.achievements.length === 0) ? (
                        <p className="no-sub-data">No achievements unlocked yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                          {inspectUser.gamification.achievements.map((ach, i) => (
                            <span key={i} className="plan-pill pro" style={{ fontSize: '0.7rem' }}>
                              🏆 {ach}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUBSCRIPTIONS & REVENUE */}
          {activeTab === 'subscriptions' && (
            <div className="tab-pane-fade">
              <div className="pane-header-row">
                <div>
                  <h2>Live Subscriptions & Billing</h2>
                  <p className="pane-subtitle">Live Razorpay and subscription records stored in `subscriptions`.</p>
                </div>
                <button onClick={exportRealSubscriptionsCSV} className="btn-admin-secondary">
                  <Download size={15} /> Export Transactions (CSV)
                </button>
              </div>

              <div className="admin-panel-card no-padding">
                {subscriptions.length === 0 ? (
                  <div className="empty-state-box">
                    <IndianRupee size={36} color="#94a3b8" />
                    <h4>No Subscriptions Recorded in Firestore Yet</h4>
                    <p>When users upgrade to Pro, payment records in `subscriptions` will appear here.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="admin-data-table">
                      <thead>
                        <tr>
                          <th>User / Email</th>
                          <th>Plan Type</th>
                          <th>Amount</th>
                          <th>Payment Reference</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <strong>{s.userName || 'Subscriber'}</strong>
                              <p className="user-email-text">{s.userEmail}</p>
                            </td>
                            <td><span className="plan-pill pro">{s.plan || 'Pro'}</span></td>
                            <td><strong>₹{s.amount || 0} {s.currency || 'INR'}</strong></td>
                            <td><span className="payment-id-text">{s.paymentId || s.id}</span></td>
                            <td>
                              <span className={`status-tag ${s.status === 'active' ? 'active' : 'inactive'}`}>
                                {s.status || 'active'}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => handleToggleSubStatus(s.id, s.status)}
                                className="btn-toggle-refund"
                              >
                                {s.status === 'active' ? 'Mark Refunded' : 'Reactivate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: B2B INSTITUTIONAL LEADS */}
          {activeTab === 'b2b' && (
            <div className="tab-pane-fade">
              <div className="pane-header-row">
                <div>
                  <h2>Institutional Campus Inquiries ({b2bInquiries.length})</h2>
                  <p className="pane-subtitle">Inbound leads from universities, colleges, and training institutions.</p>
                </div>
              </div>

              <div className="admin-panel-card no-padding">
                {b2bInquiries.length === 0 ? (
                  <div className="empty-state-box">
                    <Building size={36} color="#94a3b8" />
                    <h4>No Institutional Inquiries Yet</h4>
                    <p>Submissions to `b2b_inquiries` will stream live into this table.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="admin-data-table">
                      <thead>
                        <tr>
                          <th>Institution</th>
                          <th>Coordinator Contact</th>
                          <th>Target Seats</th>
                          <th>Notes / Requirements</th>
                          <th>Status</th>
                          <th>Update Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b2bInquiries.map((inq) => (
                          <tr key={inq.id}>
                            <td><strong>{inq.institutionName}</strong></td>
                            <td>
                              <div>{inq.contactName}</div>
                              <span className="user-email-text">{inq.contactEmail}</span>
                              {inq.phone && <div className="time-text">📞 {inq.phone}</div>}
                            </td>
                            <td><strong>{inq.seats || 250} Seats</strong></td>
                            <td>
                              <p className="message-cell">{inq.message || 'No additional notes'}</p>
                            </td>
                            <td>
                              <span className={`status-tag ${inq.status || 'pending'}`}>
                                {inq.status || 'pending'}
                              </span>
                            </td>
                            <td>
                              <div className="status-button-group">
                                <button
                                  onClick={() => handleUpdateB2BStatus(inq.id, 'contacted')}
                                  className="btn-status-pill contacted"
                                >
                                  Contacted
                                </button>
                                <button
                                  onClick={() => handleUpdateB2BStatus(inq.id, 'approved')}
                                  className="btn-status-pill approved"
                                >
                                  Approve Pilot
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DATA EXPORT */}
          {activeTab === 'export' && (
            <div className="tab-pane-fade">
              <div className="pane-header-row">
                <div>
                  <h2>Data Export Center</h2>
                  <p className="pane-subtitle">Download live CSV data snapshots directly from your Firestore instance.</p>
                </div>
              </div>

              <div className="export-cards-grid">
                <div className="export-action-card">
                  <div className="export-icon-circle purple"><Users size={28} /></div>
                  <h3>Users Directory CSV</h3>
                  <p>Exports all {users.length} registered user profiles including UID, plan, gamification stats, focus minutes, and timestamps.</p>
                  <button onClick={exportRealUsersCSV} className="submit-button" style={{ marginTop: 'auto' }}>
                    <Download size={16} /> Download Users CSV
                  </button>
                </div>

                <div className="export-action-card">
                  <div className="export-icon-circle green"><IndianRupee size={28} /></div>
                  <h3>Subscriptions & Billing CSV</h3>
                  <p>Exports all {subscriptions.length} subscription documents, payment references, and amounts.</p>
                  <button onClick={exportRealSubscriptionsCSV} className="submit-button" style={{ marginTop: 'auto' }}>
                    <Download size={16} /> Download Subscriptions CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SYSTEM DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="tab-pane-fade">
              <div className="pane-header-row">
                <div>
                  <h2>Firebase Connection & System Status</h2>
                  <p className="pane-subtitle">Health status of your Firestore backend setup.</p>
                </div>
              </div>

              <div className="admin-panel-card">
                <div className="diagnostics-list">
                  <div className="diag-item">
                    <div className="diag-icon-status success"><CheckCircle2 size={20} /></div>
                    <div className="diag-info">
                      <h4>Firebase Initialization</h4>
                      <p>Project ID: <code>focusora-ca5a8</code> • Database: <code>(default)</code> • Region: <code>asia-south1</code></p>
                    </div>
                  </div>

                  <div className="diag-item">
                    <div className="diag-icon-status success"><CheckCircle2 size={20} /></div>
                    <div className="diag-info">
                      <h4>Active Firestore Listeners</h4>
                      <p>Streaming <code>users</code> ({users.length} docs), <code>subscriptions</code> ({subscriptions.length} docs), and <code>b2b_inquiries</code> ({b2bInquiries.length} docs).</p>
                    </div>
                  </div>

                  <div className="diag-item">
                    <div className="diag-icon-status info"><Shield size={20} /></div>
                    <div className="diag-info">
                      <h4>Schema Adapter</h4>
                      <p>Mapped to Focusora schema with <code>gamification</code>, <code>insights.dailyLog</code>, and <code>settings.blockList</code>.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* User Edit Modal */}
      {editingUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog">
            <div className="modal-header">
              <h3>Edit User: {editingUser.displayName}</h3>
              <button onClick={() => setEditingUser(null)} className="btn-modal-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label>Display Name:</label>
                <input
                  type="text"
                  value={editingUser.displayName || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Plan Tier:</label>
                <select
                  value={editingUser.plan || 'free'}
                  onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value as any })}
                >
                  <option value="free">Free</option>
                  <option value="pro_monthly">Pro Monthly (₹79)</option>
                  <option value="pro_yearly">Pro Yearly (₹699)</option>
                  <option value="institution">Institutional Seat</option>
                </select>
              </div>

              <div className="form-field">
                <label>XP Points:</label>
                <input
                  type="number"
                  value={editingUser.gamification?.xp || 0}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      gamification: {
                        ...editingUser.gamification,
                        coins: editingUser.gamification?.coins || 0,
                        currentStreakDays: editingUser.gamification?.currentStreakDays || 0,
                        level: editingUser.gamification?.level || 1,
                        longestStreakDays: editingUser.gamification?.longestStreakDays || 0,
                        totalTasksCompleted: editingUser.gamification?.totalTasksCompleted || 0,
                        xp: Number(e.target.value)
                      }
                    })
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setEditingUser(null)} className="btn-admin-secondary">
                Cancel
              </button>
              <button onClick={handleSaveUserEdit} className="submit-button">
                Save Changes in Firestore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
