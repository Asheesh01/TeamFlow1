import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, AlertCircle, Calendar, Search, ChevronDown, ArrowRight, Users } from 'lucide-react';

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

// ── Searchable picker (reused for both create and reassign) ───────────────────
const AssigneePicker = ({ users, value, onChange, error, placeholder = 'Search and select...' }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const selected = users.find(u => String(u.id) === String(value));
  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className={`assignee-picker ${error ? 'input-error' : ''}`} ref={ref}>
      <button type="button" className={`assignee-picker-btn ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        {selected ? (
          <span className="assignee-selected">
            <span className="assignee-avatar">{selected.name.charAt(0).toUpperCase()}</span>
            <span>{selected.name}</span>
            <span className="assignee-role-tag">{selected.role}</span>
          </span>
        ) : <span className="assignee-placeholder">{placeholder}</span>}
        <ChevronDown size={15} className={`picker-chevron ${open ? 'rotated' : ''}`} />
      </button>
      {open && (
        <div className="assignee-dropdown">
          <div className="assignee-search-wrapper">
            <Search size={14} className="assignee-search-icon" />
            <input autoFocus type="text" className="assignee-search-input"
              placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="assignee-list">
            {filtered.length === 0
              ? <p className="assignee-empty">No results found</p>
              : filtered.map(u => (
                <button key={u.id} type="button"
                  className={`assignee-option ${String(u.id) === String(value) ? 'selected' : ''}`}
                  onClick={() => { onChange(u.id); setSearch(''); setOpen(false); }}>
                  <span className="assignee-avatar">{u.name.charAt(0).toUpperCase()}</span>
                  <span className="assignee-option-info">
                    <span className="assignee-option-name">{u.name}</span>
                    <span className="assignee-option-email">{u.email}</span>
                  </span>
                  <span className={`role-badge role-${u.role}`}>{u.role}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Reassign Modal (Admin → Member) ──────────────────────────────────────────
const ReassignModal = ({ task, onClose, onReassigned }) => {
  const [members, setMembers] = useState([]);
  const [memberId, setMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/auth/users').then(res => {
      setMembers(res.data.users.filter(u => u.role === 'member'));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!memberId) { setError('Please select a member'); return; }
    setLoading(true);
    try {
      const res = await api.patch(`/tasks/${task.id}/reassign`, { memberId: parseInt(memberId) });
      toast.success(res.data.message || 'Task reassigned!');
      onReassigned(res.data.task);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reassign task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Assign to Member</h2>
            <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
              Task: <strong style={{ color: 'var(--text-primary)' }}>{task.title}</strong>
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">
              <Users size={14} style={{ display: 'inline', marginRight: 4 }} />
              Select Member <span className="required">*</span>
            </label>
            <AssigneePicker
              users={members}
              value={memberId}
              onChange={(id) => { setMemberId(id); setError(''); }}
              error={!!error}
              placeholder="Search members..."
            />
            {error && <p className="field-error"><AlertCircle size={12} /> {error}</p>}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : <><ArrowRight size={15} /> Assign to Member</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Create Task Modal (SuperAdmin only) ───────────────────────────────────────
const CreateTaskModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ title: '', description: '', projectId: '', assigneeId: '', dueDate: '', priority: 'Medium' });
  const [projects, setProjects] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState({});

  useEffect(() => {
    Promise.all([api.get('/projects'), api.get('/auth/users')]).then(([p, u]) => {
      setProjects(p.data.projects);
      setAdmins(u.data.users.filter(u => u.role === 'admin'));
    });
  }, []);

  const validate = () => {
    const errs = {};
    if (!form.title.trim() || form.title.trim().length < 3) errs.title = 'Title required (min 3 chars)';
    if (!form.projectId) errs.projectId = 'Select a project';
    if (!form.assigneeId) errs.assigneeId = 'Select an admin to assign';
    if (!form.dueDate) errs.dueDate = 'Due date is required';
    setFieldError(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.post('/tasks', {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        projectId: parseInt(form.projectId),
        assigneeId: parseInt(form.assigneeId),
        dueDate: form.dueDate,
        priority: form.priority,
      });
      toast.success('Task created and assigned to Admin!');
      if (res.data.warning) toast(res.data.warning, { icon: '⚠️' });
      onCreated(res.data.task);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create task.';
      const field = err.response?.data?.field;
      if (field) setFieldError(prev => ({ ...prev, [field]: msg }));
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create New Task</h2>
            <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
              🔑 SuperAdmin: Assigning task to an Admin
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Task Title <span className="required">*</span></label>
            <input id="task-title" type="text" className={`form-input ${fieldError.title ? 'input-error' : ''}`}
              placeholder="e.g. Design the login page" maxLength={255} value={form.title}
              onChange={(e) => { setForm({ ...form, title: e.target.value }); setFieldError({ ...fieldError, title: '' }); }} />
            {fieldError.title && <p className="field-error"><AlertCircle size={12} /> {fieldError.title}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Description <span className="optional">(optional)</span></label>
            <textarea id="task-description" className="form-textarea" placeholder="What needs to be done?"
              maxLength={2000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Project <span className="required">*</span></label>
            <select id="task-project" className={`form-select ${fieldError.projectId ? 'input-error' : ''}`}
              value={form.projectId}
              onChange={(e) => { setForm({ ...form, projectId: e.target.value }); setFieldError({ ...fieldError, projectId: '' }); }}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {fieldError.projectId && <p className="field-error"><AlertCircle size={12} /> {fieldError.projectId}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Assign to Admin <span className="required">*</span></label>
            <AssigneePicker users={admins} value={form.assigneeId}
              onChange={(id) => { setForm({ ...form, assigneeId: id }); setFieldError({ ...fieldError, assigneeId: '' }); }}
              error={fieldError.assigneeId} placeholder="Search admins..." />
            {fieldError.assigneeId && <p className="field-error"><AlertCircle size={12} /> {fieldError.assigneeId}</p>}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Due Date <span className="required">*</span></label>
              <div className="input-wrapper">
                <Calendar size={15} className="input-icon" />
                <input id="task-due-date" type="date" className={`form-input ${fieldError.dueDate ? 'input-error' : ''}`}
                  value={form.dueDate}
                  onChange={(e) => { setForm({ ...form, dueDate: e.target.value }); setFieldError({ ...fieldError, dueDate: '' }); }} />
              </div>
              {fieldError.dueDate && <p className="field-error"><AlertCircle size={12} /> {fieldError.dueDate}</p>}
              {form.dueDate && form.dueDate < today && <p className="field-warning">⚠️ Past date — task will be overdue immediately</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select id="task-priority" className="form-select" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button id="create-task-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : <><Plus size={15} /> Create & Assign to Admin</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const AssignTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [reassignTask, setReassignTask] = useState(null); // task to reassign
  const [filter, setFilter] = useState({ status: '', priority: '', search: '' });
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin';

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data.tasks);
    } catch { toast.error('Failed to load tasks.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleDeleteConfirmed = async () => {
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setDeleting(id);
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Task deleted.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete task.');
    } finally { setDeleting(null); }
  };

  const filtered = tasks.filter(t => {
    if (filter.status && t.status !== filter.status) return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return t.title.toLowerCase().includes(q) ||
        (t.assignee_name || '').toLowerCase().includes(q) ||
        (t.project_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {isSuperAdmin ? 'Assign Tasks' : 'My Assigned Tasks'}
            </h1>
            <p className="page-subtitle">
              {isSuperAdmin
                ? '🔑 SuperAdmin: Create tasks and assign them to Admins'
                : '📋 Admin: Tasks assigned to you by SuperAdmin — delegate to members'}
            </p>
          </div>
          {/* Only SuperAdmin can create new tasks */}
          {isSuperAdmin && (
            <button id="new-task-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New Task
            </button>
          )}
        </div>

        {/* Admin info banner */}
        {isAdmin && (
          <div className="admin-info-banner">
            <ArrowRight size={16} />
            <span>Select a task below and click <strong>Assign to Member</strong> to delegate it to a team member.</span>
          </div>
        )}

        {/* Filters */}
        <div className="filter-bar">
          <div className="filter-search-wrapper">
            <Search size={14} className="filter-search-icon" />
            <input type="text" className="filter-search filter-search-with-icon"
              placeholder="Search tasks, projects..." value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
          </div>
          <select className="filter-select" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All Statuses</option>
            <option>To Do</option><option>In Progress</option><option>Done</option>
          </select>
          <select className="filter-select" value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })}>
            <option value="">All Priorities</option>
            <option>Low</option><option>Medium</option><option>High</option>
          </select>
        </div>

        {/* Task Table */}
        <div className="section-card">
          {loading ? (
            <div className="table-loading"><span className="btn-spinner large" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Plus size={40} />
              <p>{filter.search || filter.status || filter.priority
                ? 'No tasks match your filters.'
                : isAdmin ? 'No tasks assigned to you yet by SuperAdmin.' : 'No tasks yet. Create one!'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Project</th>
                    {isSuperAdmin && <th>Assigned To (Admin)</th>}
                    {isAdmin && <th>Delegated To (Member)</th>}
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(task => {
                    // A task is PENDING if still assigned to the admin (not yet delegated)
                    const isPendingDelegation = isAdmin && task.assignee_id === user?.id;
                    // A task is DELEGATED if admin sent it to a member (assigned_by=admin, assignee=member)
                    const isDelegatedByMe = isAdmin && task.assigned_by_id === user?.id && task.assignee_id !== user?.id;
                    return (
                    <tr key={task.id} className={isOverdue(task) ? 'row-overdue' : ''}>
                      <td>
                        <div className="task-title-cell">
                          <span>{task.title}</span>
                          {task.description && <span className="task-desc-preview">{task.description.substring(0, 60)}...</span>}
                        </div>
                      </td>
                      <td><span className="project-tag">{task.project_name || '—'}</span></td>
                      {isSuperAdmin && (
                        <td>
                          {task.assignee_name
                            ? <div className="user-cell"><div className="user-avatar-sm">{task.assignee_name.charAt(0)}</div><span>{task.assignee_name}</span></div>
                            : <span className="text-muted">Unassigned</span>}
                        </td>
                      )}
                      {/* Admin: show who task is delegated to */}
                      {isAdmin && (
                        <td>
                          {isDelegatedByMe ? (
                            <div className="user-cell">
                              <div className="user-avatar-sm" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)' }}>
                                {task.assignee_name.charAt(0)}
                              </div>
                              <span style={{ fontSize: '.8rem' }}>{task.assignee_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '.78rem' }}>Not yet assigned</span>
                          )}
                        </td>
                      )}
                      <td><PriorityBadge priority={task.priority} /></td>
                      <td><StatusPill task={task} /></td>
                      <td className="date-cell">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                          {/* Admin: show Assign to Member only for tasks not yet delegated */}
                          {isAdmin && isPendingDelegation && (
                            <button className="btn btn-sm btn-primary" onClick={() => setReassignTask(task)}
                              title="Assign this task to a member">
                              <ArrowRight size={13} /> Assign to Member
                            </button>
                          )}
                          {isAdmin && isDelegatedByMe && (
                            <span style={{ fontSize: '.72rem', color: 'var(--accent-green)', fontWeight: 600 }}>✓ Delegated</span>
                          )}
                          <button className="btn-icon btn-danger"
                            onClick={() => setConfirmDelete({ id: task.id, title: task.title })}
                            disabled={deleting === task.id} title="Delete task">
                            {deleting === task.id ? <span className="btn-spinner small" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={(t) => setTasks(prev => [t, ...prev])} />}
      {reassignTask && (
        <ReassignModal
          task={reassignTask}
          onClose={() => setReassignTask(null)}
          onReassigned={(updated) => {
            // Remove from admin's list since task is now assigned to a member
            setTasks(prev => prev.filter(t => t.id !== updated.id));
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Task"
        message={confirmDelete ? `Are you sure you want to delete "${confirmDelete.title}"? This cannot be undone.` : ''}
        confirmLabel="Yes, Delete Task"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default AssignTasks;
