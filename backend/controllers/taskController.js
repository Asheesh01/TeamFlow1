const { pool } = require('../config/db');

// Helper: build full task SELECT with JOINs
const TASK_SELECT = `
  SELECT
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.created_at,
    t.updated_at,
    t.project_id,
    p.name            AS project_name,
    t.assignee_id,
    a.name            AS assignee_name,
    a.email           AS assignee_email,
    t.assigned_by_id,
    ab.name           AS assigned_by_name,
    (t.due_date < CURDATE() AND t.status != 'Done') AS is_overdue
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN users    a ON a.id = t.assignee_id
  LEFT JOIN users   ab ON ab.id = t.assigned_by_id
`;

// ── POST /api/tasks ──────────────────────────────────────────────────────────
const createTask = async (req, res) => {
  try {
    // ── Only SuperAdmin can create tasks ────────────────────────────────────
    if (req.user.role === 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Admins cannot create tasks. Tasks are created by SuperAdmin and assigned to you.',
      });
    }

    const { title, description, projectId, assigneeId, dueDate, priority } = req.body;
    const assignedById = req.user.id; // ALWAYS from token, never from body

    // ── Validation ──────────────────────────────────────────────────────────
    if (!title || title.trim().length < 3) {
      return res.status(400).json({ error: true, message: 'Task title is required (min 3 chars).', field: 'title' });
    }
    if (title.trim().length > 255) {
      return res.status(400).json({ error: true, message: 'Task title too long (max 255 chars).', field: 'title' });
    }
    if (description && description.length > 2000) {
      return res.status(400).json({ error: true, message: 'Description too long (max 2000 chars).', field: 'description' });
    }
    if (!projectId) {
      return res.status(400).json({ error: true, message: 'Project is required.', field: 'projectId' });
    }
    if (!assigneeId) {
      return res.status(400).json({ error: true, message: 'Assignee is required.', field: 'assigneeId' });
    }
    if (!dueDate) {
      return res.status(400).json({ error: true, message: 'Due date is required.', field: 'dueDate' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res.status(400).json({ error: true, message: 'Due date must be in YYYY-MM-DD format.', field: 'dueDate' });
    }
    const validPriorities = ['Low', 'Medium', 'High'];
    const taskPriority = validPriorities.includes(priority) ? priority : 'Medium';

    // ── Check project exists ─────────────────────────────────────────────────
    const [[project]] = await pool.query('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(400).json({ error: true, message: 'Project not found.', field: 'projectId' });
    }

    // ── Check assignee exists and enforce role chain ─────────────────────────
    // SuperAdmin assigns to Admins; Admin assigns to Members
    const [[assignee]] = await pool.query('SELECT id, role, name FROM users WHERE id = ?', [assigneeId]);
    if (!assignee) {
      return res.status(400).json({ error: true, message: 'Assignee user not found.', field: 'assigneeId' });
    }
    if (assignee.role === 'superadmin') {
      return res.status(400).json({ error: true, message: 'Cannot assign tasks to superadmin.', field: 'assigneeId' });
    }

    const assigner = req.user; // from JWT
    if (assigner.role === 'superadmin' && assignee.role !== 'admin') {
      return res.status(400).json({ error: true, message: 'SuperAdmin can only assign tasks to Admins.', field: 'assigneeId' });
    }
    if (assigner.role === 'admin' && assignee.role !== 'member') {
      return res.status(400).json({ error: true, message: 'Admin can only assign tasks to Members.', field: 'assigneeId' });
    }

    // ── Warn if due date is in the past (but allow it) ───────────────────────
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    const isPastDue = due < today;

    // ── Insert task ──────────────────────────────────────────────────────────
    const [result] = await pool.query(
      `INSERT INTO tasks (title, description, project_id, assignee_id, assigned_by_id, status, priority, due_date)
       VALUES (?, ?, ?, ?, ?, 'To Do', ?, ?)`,
      [title.trim(), description?.trim() || null, projectId, assigneeId, assignedById, taskPriority, dueDate]
    );

    const [[task]] = await pool.query(TASK_SELECT + ' WHERE t.id = ?', [result.insertId]);

    res.status(201).json({
      task,
      warning: isPastDue ? 'Due date is in the past. The task will immediately be marked overdue.' : null,
    });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: true, message: 'Failed to create task.' });
  }
};

// ── GET /api/tasks ───────────────────────────────────────────────────────────
const getAllTasks = async (req, res) => {
  try {
    let query = TASK_SELECT;
    const params = [];

    // Members only see their own tasks
    if (req.user.role === 'member') {
      query += ' WHERE t.assignee_id = ?';
      params.push(req.user.id);
    }
    // Admins see all tasks in their scope:
    // - Tasks assigned TO them (pending delegation)
    // - Tasks they delegated to members (for progress tracking)
    else if (req.user.role === 'admin') {
      query += ' WHERE (t.assignee_id = ? OR t.assigned_by_id = ?)';
      params.push(req.user.id, req.user.id);
    }

    query += ' ORDER BY is_overdue DESC, t.due_date ASC, t.created_at DESC';

    const [tasks] = await pool.query(query, params);
    res.json({ tasks });
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch tasks.' });
  }
};

// ── GET /api/tasks/:id ───────────────────────────────────────────────────────
const getTask = async (req, res) => {
  try {
    const [[task]] = await pool.query(TASK_SELECT + ' WHERE t.id = ?', [req.params.id]);

    if (!task) {
      return res.status(404).json({ error: true, message: 'Task not found.' });
    }

    // Members can only view their own tasks
    if (req.user.role === 'member' && task.assignee_id !== req.user.id) {
      return res.status(403).json({ error: true, message: 'Access denied. Not your task.' });
    }

    res.json({ task });
  } catch (err) {
    console.error('Get task error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch task.' });
  }
};

// ── PATCH /api/tasks/:id/status ──────────────────────────────────────────────
// ONLY the assignee can change status of THEIR OWN task
const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['To Do', 'In Progress', 'Done'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: true,
        message: `Status must be one of: ${validStatuses.join(', ')}.`,
        field: 'status',
      });
    }

    // Fetch the task
    const [[task]] = await pool.query('SELECT id, assignee_id, status FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) {
      return res.status(404).json({ error: true, message: 'Task not found.' });
    }

    // Only the assignee can update status
    if (task.assignee_id !== req.user.id) {
      return res.status(403).json({
        error: true,
        message: 'You can only update status of your own tasks.',
      });
    }

    await pool.query(
      'UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    );

    const [[updated]] = await pool.query(TASK_SELECT + ' WHERE t.id = ?', [req.params.id]);
    res.json({ task: updated });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: true, message: 'Failed to update task status.' });
  }
};

// ── DELETE /api/tasks/:id ────────────────────────────────────────────────────
// Admin and SuperAdmin only (roleMiddleware enforces this in routes)
const deleteTask = async (req, res) => {
  try {
    const [[task]] = await pool.query('SELECT id FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) {
      return res.status(404).json({ error: true, message: 'Task not found.' });
    }

    await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: true, message: 'Failed to delete task.' });
  }
};

// ── GET /api/tasks/stats ─────────────────────────────────────────────────────
const getTaskStats = async (req, res) => {
  try {
    let statsQuery;
    const params = [];

    if (req.user.role === 'member') {
      // Member: only their own tasks
      statsQuery = `
        SELECT
          COUNT(*)                                                              AS total,
          SUM(status = 'In Progress')                                           AS in_progress,
          SUM(status = 'Done')                                                  AS done,
          SUM(status = 'To Do')                                                 AS todo,
          SUM(due_date < CURDATE() AND status != 'Done')                        AS overdue
        FROM tasks
        WHERE assignee_id = ?
      `;
      params.push(req.user.id);
    } else if (req.user.role === 'admin') {
      // Admin: tasks assigned TO them OR assigned BY them (delegated)
      statsQuery = `
        SELECT
          COUNT(*)                                                              AS total,
          SUM(status = 'In Progress')                                           AS in_progress,
          SUM(status = 'Done')                                                  AS done,
          SUM(status = 'To Do')                                                 AS todo,
          SUM(due_date < CURDATE() AND status != 'Done')                        AS overdue,
          (SELECT COUNT(*) FROM users WHERE role = 'member')                    AS total_members,
          (SELECT COUNT(*) FROM projects)                                       AS total_projects
        FROM tasks
        WHERE (assignee_id = ? OR assigned_by_id = ?)
      `;
      params.push(req.user.id, req.user.id);
    } else {
      // SuperAdmin: all tasks
      statsQuery = `
        SELECT
          COUNT(*)                                                              AS total,
          SUM(status = 'In Progress')                                           AS in_progress,
          SUM(status = 'Done')                                                  AS done,
          SUM(status = 'To Do')                                                 AS todo,
          SUM(due_date < CURDATE() AND status != 'Done')                        AS overdue,
          (SELECT COUNT(*) FROM users WHERE role = 'member')                    AS total_members,
          (SELECT COUNT(*) FROM projects)                                       AS total_projects
        FROM tasks
      `;
    }

    const [[stats]] = await pool.query(statsQuery, params);

    // Recent tasks
    let recentQuery = TASK_SELECT;
    if (req.user.role === 'member') {
      recentQuery += ' WHERE t.assignee_id = ?';
      params.push(req.user.id);
    }
    recentQuery += ' ORDER BY t.created_at DESC LIMIT 5';

    const [recentTasks] = await pool.query(recentQuery, req.user.role === 'member' ? [req.user.id] : []);

    res.json({ stats, recentTasks });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch stats.' });
  }
};

// ── PATCH /api/tasks/:id/reassign ────────────────────────────────────────────
// Admin re-assigns a task (given to them by SuperAdmin) to a Member
const reassignTask = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: true, message: 'Only Admins can reassign tasks.' });
    }

    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ error: true, message: 'memberId is required.', field: 'memberId' });
    }

    // Verify task exists and is currently assigned to this admin
    const [[task]] = await pool.query('SELECT id, assignee_id, title FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) {
      return res.status(404).json({ error: true, message: 'Task not found.' });
    }
    if (task.assignee_id !== req.user.id) {
      return res.status(403).json({ error: true, message: 'You can only reassign tasks that are assigned to you.' });
    }

    // Verify the target is a member
    const [[member]] = await pool.query('SELECT id, role, name FROM users WHERE id = ?', [memberId]);
    if (!member) {
      return res.status(400).json({ error: true, message: 'Member not found.', field: 'memberId' });
    }
    if (member.role !== 'member') {
      return res.status(400).json({ error: true, message: 'You can only reassign tasks to Members.', field: 'memberId' });
    }

    // Update assignee
    await pool.query(
      'UPDATE tasks SET assignee_id = ?, assigned_by_id = ?, updated_at = NOW() WHERE id = ?',
      [memberId, req.user.id, req.params.id]
    );

    const [[updated]] = await pool.query(TASK_SELECT + ' WHERE t.id = ?', [req.params.id]);
    res.json({ task: updated, message: `Task reassigned to ${member.name}.` });
  } catch (err) {
    console.error('Reassign task error:', err);
    res.status(500).json({ error: true, message: 'Failed to reassign task.' });
  }
};

module.exports = { createTask, getAllTasks, getTask, updateTaskStatus, deleteTask, getTaskStats, reassignTask };
