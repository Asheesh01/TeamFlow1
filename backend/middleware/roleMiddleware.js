/**
 * roleMiddleware — Factory that returns middleware allowing only specified roles.
 * Usage: roleMiddleware(['admin', 'superadmin'])
 * Returns 403 if authenticated user's role is not in the allowed list.
 */
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: true, message: 'Not authenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: true,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }

    next();
  };
};

module.exports = roleMiddleware;
