const express = require('express');
const router = express.Router();
const { register, login, getMe, getUsers, deleteUser, updateUserRole } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', authMiddleware, getMe);
router.get('/users', authMiddleware, roleMiddleware(['admin', 'superadmin']), getUsers);
router.delete('/users/:id', authMiddleware, roleMiddleware(['superadmin']), deleteUser);
router.patch('/users/:id/role', authMiddleware, roleMiddleware(['superadmin']), updateUserRole);

module.exports = router;
