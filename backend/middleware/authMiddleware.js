const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

/**
 * authMiddleware — Verifies the JWT from Authorization header.
 * Attaches req.user = { id, name, email, role } on success.
 * Returns 401 if token is missing/invalid/expired.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: true,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB (catches deleted users or role changes)
    const [rows] = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: true,
        message: 'User no longer exists.',
      });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: true, message: 'Token expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: true, message: 'Invalid token.' });
    }
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: true, message: 'Authentication error.' });
  }
};

module.exports = authMiddleware;
