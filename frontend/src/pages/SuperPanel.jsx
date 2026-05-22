import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';
import { ShieldCheck, Users, Trash2, RefreshCw } from 'lucide-react';

const isOverdue = (task) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(task.due_date) < today && task.status !== 'Done';
};

const StatusPill = ({ task }) => {
  if (isOverdue(task)) return <span className="status-pill status-overdue">Overdue</span>;
  const cls = { 'To Do': 'status-todo', 'In Progress': 'status-inprogress', Done: 'status-done' }[task.status];
  return <span className={`status-pill ${cls}`}>{task.status}</span>;
};

const PriorityBadge = ({ priority }) => {
  const cls = { Low: 'priority-low', Medium: 'priority-medium', High: 'priority-high' }[priority];
  return <span className={`priority-badge ${cls}`}>{priority}</span>;
};

const RoleBadge = ({ role }) => {
  const cls = { superadmin: 'role-super', admin: 'role-admin', member: 'role-member' }[role];
  const label = { superadmin: 'Super Admin', admin: 'Admin', member: 'Member' }[role];
  return <span className={`role-badge ${cls}`}>{label}</span>;
};

const SuperPanel = () => {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [deletingUser, setDeletingUser] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [updatingRole, setUpdatingRole] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { type, id, name, message }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes, statsRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/auth/users'),
        api.get('/tasks/stats'),
      ]);
      setTasks(tasksRes.data.tasks);
      setUsers(usersRes.data.users);
      setStats(statsRes.data.stats);
    } catch (err) {
      toast.error('Failed to load super panel data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDeleteUser = async (id, name) => {
    setConfirmDialog({
      type: 'user', id, 
      title: 'Delete User',
      message: `Are you sure you want to delete user "${name}"? Their assigned tasks will become unassigned.`,
      confirmLabel: 'Yes, Delete User',
    });
  };

  const executeDeleteUser = async (id) => {
    setDeletingUser(id);
    try {
      await api.delete(`/auth/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success(`User "${name}" deleted.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user.');
    } finally {
      setDeletingUser(null);
    }
  };

  const handleDeleteTask = async (id, title) => {
    setConfirmDialog({
      type: 'task', id,
      title: 'Delete Task',
      message: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      confirmLabel: 'Yes, Delete Task',
    });
  };

  const executeDeleteTask = async (id) => {
    setDeletingTask(id);
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Task deleted.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete task.');
    } finally {
      setDeletingTask(null);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingRole(userId);
    try {
      await api.patch(`/auth/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Role updated.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role.');
    } finally {
      setUpdatingRole(null);
    }
  };

  const overdueTasks = tasks.filter(isOverdue);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <ShieldCheck size={26} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--role-super)' }} />
              Super Panel
            </h1>
            <p className="page-subtitle">System-wide administration — full visibility across all data</p>
          </div>
          <button className="btn btn-ghost" onClick={fetchAll} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {/* System Stats */}
        {stats && (
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Tasks', value: tasks.length, color: 'var(--accent-blue)' },
              { label: 'Total Users', value: users.length, color: 'var(--accent-purple)' },
              { label: 'Completed', value: stats.done || 0, color: 'var(--accent-green)' },
              { label: 'Overdue', value: overdueTasks.length, color: 'var(--accent-red)' },
              { label: 'Projects', value: stats.total_projects || 0, color: 'var(--accent-blue)' },
              { label: 'Members', value: stats.total_members || 0, color: 'var(--accent-purple)' },
            ].map(card => (
              <div key={card.label} className="stat-card stat-card-sm">
                <p className="stat-card-label">{card.label}</p>
                <p className="stat-card-value" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab ${activeTab === 'tasks' ? 'tab-active' : ''}`} onClick={() => setActiveTab('tasks')}>
            All Tasks ({tasks.length})
          </button>
          <button className={`tab ${activeTab === 'users' ? 'tab-active' : ''}`} onClick={() => setActiveTab('users')}>
            <Users size={14} /> All Users ({users.length})
          </button>
          {overdueTasks.length > 0 && (
            <button className={`tab tab-danger ${activeTab === 'overdue' ? 'tab-active' : ''}`} onClick={() => setActiveTab('overdue')}>
              Overdue ({overdueTasks.length})
            </button>
          )}
        </div>

        {/* Tasks Table */}
        {activeTab === 'tasks' && (
          <div className="section-card">
            {loading ? (
              <div className="table-loading"><span className="btn-spinner large" /></div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Project</th>
                      <th>Assigned To</th>
                      <th>Assigned By</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Due Date</th>
                      <th>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => (
                      <tr key={task.id} className={isOverdue(task) ? 'row-overdue' : ''}>
                        <td><span className="task-title-cell">{task.title}</span></td>
                        <td><span className="project-tag">{task.project_name || '—'}</span></td>
                        <td>{task.assignee_name || <span className="text-muted">Unassigned</span>}</td>
                        <td>{task.assigned_by_name || '—'}</td>
                        <td><PriorityBadge priority={task.priority} /></td>
                        <td><StatusPill task={task} /></td>
                        <td className="date-cell">
                          {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td>
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => handleDeleteTask(task.id, task.title)}
                            disabled={deletingTask === task.id}
                          >
                            {deletingTask === task.id ? <span className="btn-spinner small" /> : <Trash2 size={14} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Overdue Tasks */}
        {activeTab === 'overdue' && (
          <div className="section-card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Project</th>
                    <th>Assigned To</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueTasks.map(task => {
                    const days = Math.floor((new Date() - new Date(task.due_date)) / 86400000);
                    return (
                      <tr key={task.id} className="row-overdue">
                        <td><span className="task-title-cell">{task.title}</span></td>
                        <td><span className="project-tag">{task.project_name || '—'}</span></td>
                        <td>{task.assignee_name || <span className="text-muted">Unassigned</span>}</td>
                        <td><PriorityBadge priority={task.priority} /></td>
                        <td className="date-cell">
                          {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td><span className="overdue-days">{days} day{days !== 1 ? 's' : ''} overdue</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Table */}
        {activeTab === 'users' && (
          <div className="section-card">
            {loading ? (
              <div className="table-loading"><span className="btn-spinner large" /></div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Change Role</th>
                      <th>Joined</th>
                      <th>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-cell">
                            <div className="user-avatar-sm">{u.name.charAt(0).toUpperCase()}</div>
                            {u.name}
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td><RoleBadge role={u.role} /></td>
                        <td>
                          {u.role !== 'superadmin' ? (
                            <select
                              className="filter-select"
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              disabled={updatingRole === u.id}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="date-cell">
                          {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          {u.role !== 'superadmin' ? (
                            <button
                              className="btn-icon btn-danger"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              disabled={deletingUser === u.id}
                            >
                              {deletingUser === u.id ? <span className="btn-spinner small" /> : <Trash2 size={14} />}
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        onConfirm={() => {
          if (confirmDialog?.type === 'user') executeDeleteUser(confirmDialog.id);
          if (confirmDialog?.type === 'task') executeDeleteTask(confirmDialog.id);
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};

export default SuperPanel;
