const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const signToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ── POST /api/auth/register ──────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: true, message: 'Name must be at least 2 characters.', field: 'name' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: true, message: 'Valid email is required.', field: 'email' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: true, message: 'Password must be at least 6 characters.', field: 'password' });
    }

    // ALWAYS force 'member' on self-registration — role can ONLY be promoted by SuperAdmin
    const assignedRole = 'member';

    // Check duplicate email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: true, message: 'Email already in use.', field: 'email' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase(), hash, assignedRole]
    );

    const user = { id: result.insertId, name: name.trim(), email: email.toLowerCase(), role: assignedRole };
    const token = signToken(user);

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: true, message: 'Registration failed.' });
  }
};

// ── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Email and password are required.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: true, message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: true, message: 'Invalid email or password.' });
    }

    const token = signToken(user);
    res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: true, message: 'Login failed.' });
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// ── GET /api/auth/users ──────────────────────────────────────────────────────
// Returns all non-superadmin users for dropdowns (admin/superadmin only)
const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, role, created_at FROM users ORDER BY name ASC`
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch users.' });
  }
};

// ── DELETE /api/auth/users/:id ───────────────────────────────────────────────
// SuperAdmin only — delete a user (tasks SET NULL via FK)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot delete yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: true, message: 'You cannot delete your own account.' });
    }

    // Cannot delete other superadmins
    const [[target]] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (!target) {
      return res.status(404).json({ error: true, message: 'User not found.' });
    }
    if (target.role === 'superadmin') {
      return res.status(403).json({ error: true, message: 'Cannot delete a superadmin.' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: true, message: 'Failed to delete user.' });
  }
};

// ── PATCH /api/auth/users/:id/role ──────────────────────────────────────────
// SuperAdmin only — change a user's role
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: true, message: "Role must be 'admin' or 'member'." });
    }

    const [[target]] = await pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!target) {
      return res.status(404).json({ error: true, message: 'User not found.' });
    }
    if (target.role === 'superadmin') {
      return res.status(403).json({ error: true, message: 'Cannot change superadmin role.' });
    }

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ message: 'Role updated successfully.' });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: true, message: 'Failed to update role.' });
  }
};

module.exports = { register, login, getMe, getUsers, deleteUser, updateUserRole };
