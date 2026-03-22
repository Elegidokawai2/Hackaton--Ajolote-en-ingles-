const express = require('express');
const { verifyToken } = require('../middleware/jwt');
const {
    createProject, getProjects, getProjectById, updateProjectStatus,
    acceptProject, deliverProject, approveDelivery, requestCorrection,
    rejectProject, timeoutApprove, timeoutRefund,
} = require('../controllers/projectController');
const router = express.Router();
router.post('/', verifyToken, createProject);
router.get('/', verifyToken, getProjects);
router.get('/:id', verifyToken, getProjectById);
router.put('/:id/status', verifyToken, updateProjectStatus);
router.post('/:id/accept', verifyToken, acceptProject);
router.post('/:id/deliver', verifyToken, deliverProject);
router.post('/:id/approve', verifyToken, approveDelivery);
router.post('/:id/correction', verifyToken, requestCorrection);
router.post('/:id/reject', verifyToken, rejectProject);
router.post('/:id/timeout-approve', verifyToken, timeoutApprove);
router.post('/:id/timeout-refund', verifyToken, timeoutRefund);
module.exports = router;
