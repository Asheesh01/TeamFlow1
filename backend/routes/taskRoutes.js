const express = require('express');
const router = express.Router();
const {
  createTask,
  getAllTasks,
  getTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats,
  reassignTask,
} = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// All task routes require auth
router.use(authMiddleware);

// Stats endpoint (all roles, filtered by role in controller)
router.get('/stats', getTaskStats);

// GET all tasks (role-filtered inside controller)
router.get('/', getAllTasks);

// GET single task
router.get('/:id', getTask);

// CREATE task — superadmin ONLY (admin cannot create, they can only reassign)
router.post('/', roleMiddleware(['superadmin']), createTask);

// UPDATE STATUS — only the task assignee (controller checks ownership)
router.patch('/:id/status', updateTaskStatus);

// REASSIGN task — admin only (re-assigns SA task to a member)
router.patch('/:id/reassign', roleMiddleware(['admin']), reassignTask);

// DELETE task — admin and superadmin only
router.delete('/:id', roleMiddleware(['admin', 'superadmin']), deleteTask);

module.exports = router;
