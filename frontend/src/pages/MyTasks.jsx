import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import { ClipboardList } from 'lucide-react';

// Overdue detection (client-side, matches backend)
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

// Status dropdown — only shows forward-progression options
// (Done → In Progress allowed per spec, but we keep it open per backend rules)
const StatusDropdown = ({ task, onUpdate }) => {
  const [loading, setLoading] = useState(false);

  const handleChange = async (e) => {
    const newStatus = e.target.value;
    if (newStatus === task.status) return;
    setLoading(true);
    try {
      const res = await api.patch(`/tasks/${task.id}/status`, { status: newStatus });
      toast.success('Status updated!');
      onUpdate(res.data.task);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="status-dropdown-wrapper">
      {loading ? (
        <span className="btn-spinner small" />
      ) : (
        <select
          className={`status-select status-select-${task.status.replace(' ', '-').toLowerCase()}`}
          value={task.status}
          onChange={handleChange}
        >
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
        </select>
      )}
    </div>
  );
};

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '' });

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data.tasks);
    } catch (err) {
      toast.error('Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleStatusUpdate = (updated) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  // Sort: overdue first, then by due date
  const sorted = [...tasks].sort((a, b) => {
    const aOD = isOverdue(a), bOD = isOverdue(b);
    if (aOD && !bOD) return -1;
    if (!aOD && bOD) return 1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  const filtered = sorted.filter(t => {
    if (filter.status === 'Overdue') return isOverdue(t);
    if (filter.status && t.status !== filter.status) return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    return true;
  });

  const overdueCnt = tasks.filter(isOverdue).length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Tasks</h1>
            <p className="page-subtitle">
              Tasks assigned to you — {overdueCnt > 0 && <span className="overdue-warning">{overdueCnt} overdue</span>}
              {overdueCnt === 0 && 'update your status as you progress'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <select className="filter-select" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All Statuses</option>
            <option value="Overdue">🔴 Overdue</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>
          <select className="filter-select" value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })}>
            <option value="">All Priorities</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        <div className="section-card">
          {loading ? (
            <div className="table-loading"><span className="btn-spinner large" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <ClipboardList size={40} />
              <p>{filter.status || filter.priority ? 'No tasks match your filter.' : 'No tasks assigned to you yet.'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Project</th>
                    <th>Assigned By</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(task => (
                    <tr key={task.id} className={isOverdue(task) ? 'row-overdue' : ''}>
                      <td>
                        <div className="task-title-cell">
                          <span>{task.title}</span>
                          {task.description && (
                            <span className="task-desc-preview">{task.description.substring(0, 70)}</span>
                          )}
                        </div>
                      </td>
                      <td><span className="project-tag">{task.project_name || '—'}</span></td>
                      <td>{task.assigned_by_name || '—'}</td>
                      <td><PriorityBadge priority={task.priority} /></td>
                      <td><StatusPill task={task} /></td>
                      <td className="date-cell">
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td>
                        <StatusDropdown task={task} onUpdate={handleStatusUpdate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MyTasks;
