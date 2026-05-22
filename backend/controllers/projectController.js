const { pool } = require('../config/db');

// ── POST /api/projects ───────────────────────────────────────────────────────
const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: true, message: 'Project name must be at least 2 characters.', field: 'name' });
    }
    if (name.trim().length > 255) {
      return res.status(400).json({ error: true, message: 'Project name too long.', field: 'name' });
    }

    const [result] = await pool.query(
      'INSERT INTO projects (name, description, created_by_id) VALUES (?, ?, ?)',
      [name.trim(), description?.trim() || null, req.user.id]
    );

    const [[project]] = await pool.query(
      `SELECT p.*, u.name as created_by_name
       FROM projects p LEFT JOIN users u ON u.id = p.created_by_id
       WHERE p.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: true, message: 'Failed to create project.' });
  }
};

// ── GET /api/projects ────────────────────────────────────────────────────────
const getProjects = async (req, res) => {
  try {
    const [projects] = await pool.query(
      `SELECT p.*,
              u.name as created_by_name,
              COUNT(t.id)                                              AS total_tasks,
              SUM(t.status = 'Done')                                   AS done_tasks,
              SUM(t.status != 'Done' AND t.due_date < CURDATE())       AS overdue_tasks
       FROM projects p
       LEFT JOIN users u  ON u.id  = p.created_by_id
       LEFT JOIN tasks t  ON t.project_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    );

    res.json({ projects });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch projects.' });
  }
};

// ── GET /api/projects/:id ────────────────────────────────────────────────────
const getProject = async (req, res) => {
  try {
    const [[project]] = await pool.query(
      `SELECT p.*, u.name as created_by_name FROM projects p
       LEFT JOIN users u ON u.id = p.created_by_id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!project) {
      return res.status(404).json({ error: true, message: 'Project not found.' });
    }

    res.json({ project });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch project.' });
  }
};

// ── DELETE /api/projects/:id ─────────────────────────────────────────────────
// Tasks CASCADE deleted via FK
const deleteProject = async (req, res) => {
  try {
    const [[project]] = await pool.query('SELECT id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: true, message: 'Project not found.' });
    }

    await pool.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: true, message: 'Failed to delete project.' });
  }
};

module.exports = { createProject, getProjects, getProject, deleteProject };
