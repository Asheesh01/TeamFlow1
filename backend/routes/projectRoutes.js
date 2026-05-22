const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProject,
  deleteProject,
} = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// All project routes require auth
router.use(authMiddleware);

router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', roleMiddleware(['admin', 'superadmin']), createProject);
router.delete('/:id', roleMiddleware(['admin', 'superadmin']), deleteProject);

module.exports = router;
