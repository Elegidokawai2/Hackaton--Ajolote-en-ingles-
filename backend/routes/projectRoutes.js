const express = require('express');
const { verifyToken } = require('../middleware/jwt');
const { createProject, getProjects, getProjectById, updateProjectStatus, deliverProject } = require('../controllers/projectController');

const router = express.Router();

router.post('/', verifyToken, createProject);
router.get('/', verifyToken, getProjects);
router.get('/:id', verifyToken, getProjectById);
router.put('/:id/status', verifyToken, updateProjectStatus);
router.post('/:id/deliver', verifyToken, deliverProject);

module.exports = router;
