import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, AlertCircle, FolderOpen } from 'lucide-react';

// Create Project Modal
const CreateProjectModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Project name must be at least 2 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/projects', form);
      toast.success('Project created!');
      onCreated(res.data.project);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">New Project</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Project Name <span className="required">*</span></label>
            <input
              id="project-name"
              type="text"
              className={`form-input ${error ? 'input-error' : ''}`}
              placeholder="e.g. Website Redesign"
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(''); }}
            />
            {error && <p className="field-error"><AlertCircle size={12} /> {error}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Description <span className="optional">(optional)</span></label>
            <textarea
              id="project-description"
              className="form-textarea"
              placeholder="Brief description of this project..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button id="create-project-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : <><Plus size={15} /> Create Project</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Progress bar component
const ProgressBar = ({ done, total }) => {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress-bar-wrapper">
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-label">{pct}% ({done}/{total})</span>
    </div>
  );
};

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data.projects);
    } catch (err) {
      toast.error('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete project "${name}"? All tasks in this project will also be deleted.`)) return;
    setDeleting(id);
    try {
      await api.delete(`/projects/${id}`);
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success('Project deleted.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete project.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-subtitle">Manage projects — deleting a project removes all its tasks</p>
          </div>
          <button id="new-project-btn" className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Project
          </button>
        </div>

        {loading ? (
          <div className="projects-grid">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-project-card" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <FolderOpen size={48} />
            <p>No projects yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map(p => (
              <div key={p.id} className="project-card">
                <div className="project-card-header">
                  <div className="project-icon">
                    <FolderOpen size={20} />
                  </div>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(p.id, p.name)}
                    disabled={deleting === p.id}
                    title="Delete project"
                  >
                    {deleting === p.id ? <span className="btn-spinner small" /> : <Trash2 size={14} />}
                  </button>
                </div>

                <h3 className="project-card-name">{p.name}</h3>
                {p.description && <p className="project-card-desc">{p.description}</p>}

                <div className="project-card-stats">
                  <span className="project-stat">
                    <strong>{p.total_tasks || 0}</strong> tasks
                  </span>
                  {p.overdue_tasks > 0 && (
                    <span className="project-stat overdue">
                      <strong>{p.overdue_tasks}</strong> overdue
                    </span>
                  )}
                </div>

                <ProgressBar done={parseInt(p.done_tasks) || 0} total={parseInt(p.total_tasks) || 0} />

                <p className="project-card-meta">
                  Created by {p.created_by_name || 'Unknown'}
                </p>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <CreateProjectModal
            onClose={() => setShowModal(false)}
            onCreated={(p) => setProjects(prev => [p, ...prev])}
          />
        )}
      </main>
    </div>
  );
};

export default Projects;
