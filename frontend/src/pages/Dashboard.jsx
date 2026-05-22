import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle, ListTodo,
  TrendingUp, Users, X, ArrowRight, FolderOpen,
} from 'lucide-react';

const PriorityBadge = ({ priority }) => {
  const cls = { Low: 'priority-low', Medium: 'priority-medium', High: 'priority-high' }[priority] || 'priority-medium';
  return <span className={`priority-badge ${cls}`}>{priority}</span>;
};
const isOverdue = (task) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(task.due_date) < today && task.status !== 'Done';
};
const StatusPill = ({ task }) => {
  if (isOverdue(task)) return <span className="status-pill status-overdue">Overdue</span>;
  const cls = { 'To Do': 'status-todo', 'In Progress': 'status-inprogress', Done: 'status-done' }[task.status] || 'status-todo';
  return <span className={`status-pill ${cls}`}>{task.status}</span>;
};

// ── Detail Drawer ─────────────────────────────────────────────────────────────
const DetailDrawer = ({ type, tasks, users, projectProgress, onClose, isAdmin }) => {
  const filtered = {
    total: tasks,
    in_progress: tasks.filter(t => t.status === 'In Progress'),
    done: tasks.filter(t => t.status === 'Done'),
    overdue: tasks.filter(isOverdue),
    members: users?.filter(u => u.role === 'member') || [],
    projects: projectProgress || [],
  }[type] || [];

  const titles = {
    total: '📋 All Tasks',
    in_progress: '🔵 In Progress Tasks',
    done: '✅ Completed Tasks',
    overdue: '🔴 Overdue Tasks',
    members: '👥 Team Members',
    projects: '📁 Project Progress',
  };

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">{titles[type]}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {type === 'members' ? (
            filtered.length === 0
              ? <p className="empty-state" style={{ padding: '2rem' }}>No members yet.</p>
              : (
                <div className="members-list">
                  {filtered.map(u => (
                    <div key={u.id} className="member-row">
                      <div className="user-avatar-sm">{u.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '.9rem' }}>{u.name}</p>
                        <p style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{u.email}</p>
                      </div>
                      <span className="role-badge role-member" style={{ marginLeft: 'auto' }}>Member</span>
                    </div>
                  ))}
                </div>
              )
          ) : type === 'projects' ? (
            filtered.length === 0
              ? <p className="empty-state" style={{ padding: '2rem' }}>No projects found.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  {filtered.map(proj => {
                    const pct = proj.total_tasks > 0 ? Math.round((proj.done_tasks / proj.total_tasks) * 100) : 0;
                    return (
                      <div key={proj.id} className="drawer-task-row">
                        <div className="drawer-task-main" style={{ flex: 1 }}>
                          <p className="drawer-task-title" style={{ marginBottom: '.4rem' }}>
                            <FolderOpen size={14} style={{ display: 'inline', marginRight: 4, color: 'var(--accent-blue)' }} />
                            {proj.name}
                          </p>
                          {proj.member_names && (
                            <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>
                              👤 {proj.member_names}
                            </p>
                          )}
                          <div className="progress-bar-wrapper">
                            <div className="progress-bar">
                              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="progress-label">{pct}%</span>
                          </div>
                          <p style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
                            {proj.done_tasks}/{proj.total_tasks} tasks done
                            {proj.overdue_tasks > 0 && <span style={{ color: 'var(--accent-red)', marginLeft: '.5rem' }}>• {proj.overdue_tasks} overdue</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
          ) : (
            filtered.length === 0
              ? <p className="empty-state" style={{ padding: '2rem' }}>No tasks in this category.</p>
              : (
                <div className="drawer-task-list">
                  {filtered.map(task => (
                    <div key={task.id} className={`drawer-task-row ${isOverdue(task) ? 'drawer-task-overdue' : ''}`}>
                      <div className="drawer-task-main">
                        <p className="drawer-task-title">{task.title}</p>
                        {task.description && (
                          <p className="drawer-task-desc">{task.description.substring(0, 80)}</p>
                        )}
                        <div className="drawer-task-meta">
                          <span className="project-tag">{task.project_name || '—'}</span>
                          <PriorityBadge priority={task.priority} />
                          <StatusPill task={task} />
                        </div>
                      </div>
                      <div className="drawer-task-side">
                        {isAdmin && (
                          <p style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                            → {task.assignee_name || 'Unassigned'}
                          </p>
                        )}
                        <p style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                          Due: {task.due_date
                            ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [projectProgress, setProjectProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, tasksRes] = await Promise.all([
          api.get('/tasks/stats'),
          api.get('/tasks'),
        ]);
        setStats(statsRes.data.stats);
        setRecentTasks(statsRes.data.recentTasks || []);
        setAllTasks(tasksRes.data.tasks || []);
        setProjectProgress(statsRes.data.projectProgress || []);

        if (isAdmin) {
          const usersRes = await api.get('/auth/users');
          setAllUsers(usersRes.data.users || []);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin]);

  const statCards = isAdmin
    ? [
        { key: 'total', label: 'Total Tasks', value: stats?.total || 0, icon: ListTodo, color: '#2563eb', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', tip: 'Click to see all tasks' },
        { key: 'members', label: 'Members', value: stats?.total_members || 0, icon: Users, color: '#7c3aed', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', tip: 'Click to see team members' },
        { key: 'done', label: 'Completed', value: stats?.done || 0, icon: CheckCircle2, color: '#16a34a', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', tip: 'Click to see completed tasks' },
        { key: 'overdue', label: 'Overdue', value: stats?.overdue || 0, icon: AlertTriangle, color: '#dc2626', bg: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', tip: 'Click to see overdue tasks' },
      ]
    : [
        { key: 'total', label: 'My Tasks', value: stats?.total || 0, icon: ListTodo, color: '#2563eb', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', tip: 'Click to see all my tasks' },
        { key: 'in_progress', label: 'In Progress', value: stats?.in_progress || 0, icon: TrendingUp, color: '#7c3aed', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', tip: 'Click to see in-progress tasks' },
        { key: 'done', label: 'Completed', value: stats?.done || 0, icon: CheckCircle2, color: '#16a34a', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', tip: 'Click to see completed tasks' },
        { key: 'overdue', label: 'Overdue', value: stats?.overdue || 0, icon: AlertTriangle, color: '#dc2626', bg: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', tip: 'Click to see overdue tasks' },
      ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)', minHeight: '100vh' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
              Welcome back, <strong>{user?.name}</strong>! Click any card to see details.
            </p>
          </div>
          {/* Project Progress button for admin/superadmin */}
          {isAdmin && projectProgress.length > 0 && (
            <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none' }}
              onClick={() => setDrawer('projects')}>
              <FolderOpen size={16} /> Project Progress
            </button>
          )}
        </div>

        {/* Stat Cards */}
        {loading ? (
          <div className="skeleton-grid">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton-card" />)}</div>
        ) : (
          <div className="stats-grid">
            {statCards.map((card) => (
              <button key={card.key} className="stat-card stat-card-btn"
                style={{ background: card.bg, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}
                onClick={() => setDrawer(card.key)} title={card.tip}>
                <div className="stat-card-icon" style={{ background: 'rgba(255,255,255,.7)', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                  <card.icon size={22} style={{ color: card.color }} />
                </div>
                <div className="stat-card-body">
                  <p className="stat-card-label" style={{ color: card.color, opacity: .8 }}>{card.label}</p>
                  <p className="stat-card-value" style={{ color: card.color }}>{card.value}</p>
                </div>
                <ArrowRight size={14} className="stat-card-arrow" style={{ color: card.color }} />
              </button>
            ))}
          </div>
        )}

        {/* Project Progress Cards (inline preview for admin/superadmin) */}
        {isAdmin && projectProgress.length > 0 && !loading && (
          <div className="section-card" style={{ background: 'linear-gradient(135deg,#faf5ff,#ede9fe)', border: '1px solid #ddd6fe' }}>
            <div className="section-card-header">
              <h2 className="section-title" style={{ color: '#7c3aed' }}>
                <FolderOpen size={18} style={{ display: 'inline', marginRight: 6 }} />
                Project Progress
              </h2>
              <button className="section-link" style={{ color: '#7c3aed' }} onClick={() => setDrawer('projects')}>
                View all <ArrowRight size={14} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '.85rem' }}>
              {projectProgress.slice(0, 4).map(proj => {
                const pct = proj.total_tasks > 0 ? Math.round((proj.done_tasks / proj.total_tasks) * 100) : 0;
                return (
                  <div key={proj.id} style={{ background: '#fff', borderRadius: 8, padding: '.85rem', border: '1px solid #e9d5ff' }}>
                    <p style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.3rem', color: '#1e1b4b' }}>{proj.name}</p>
                    {proj.member_names && (
                      <p style={{ fontSize: '.72rem', color: '#6b7280', marginBottom: '.5rem' }}>👤 {proj.member_names}</p>
                    )}
                    <div className="progress-bar-wrapper">
                      <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${pct}%` }} /></div>
                      <span className="progress-label" style={{ fontWeight: 600, color: '#7c3aed' }}>{pct}%</span>
                    </div>
                    <p style={{ fontSize: '.7rem', color: '#9ca3af', marginTop: '.25rem' }}>
                      {proj.done_tasks}/{proj.total_tasks} done
                      {proj.overdue_tasks > 0 && <span style={{ color: '#dc2626', marginLeft: '.4rem' }}>• {proj.overdue_tasks} overdue</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Tasks */}
        <div className="section-card" style={{ background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <div className="section-card-header">
            <h2 className="section-title">Recent Tasks</h2>
            <button className="section-link" onClick={() => navigate(user?.role === 'member' ? '/tasks/mine' : '/tasks/assign')}>
              View all <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <div>{[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}</div>
          ) : recentTasks.length === 0 ? (
            <div className="empty-state"><ListTodo size={40} /><p>No tasks yet.</p></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Project</th>
                    {isAdmin && <th>Assignee</th>}
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task) => (
                    <tr key={task.id}>
                      <td><span className="task-title-cell">{task.title}</span></td>
                      <td><span className="project-tag">{task.project_name || '—'}</span></td>
                      {isAdmin && <td>{task.assignee_name || <span className="text-muted">Unassigned</span>}</td>}
                      <td><PriorityBadge priority={task.priority} /></td>
                      <td><StatusPill task={task} /></td>
                      <td className="date-cell">
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {drawer && (
        <DetailDrawer
          type={drawer}
          tasks={allTasks}
          users={allUsers}
          projectProgress={projectProgress}
          isAdmin={isAdmin}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
