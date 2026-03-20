const { Dispute, DisputeEvidence } = require('../models/Dispute');
const { Project } = require('../models/Project');

const openDispute = async (req, res) => {
  try {
    const { project_id, reason, description } = req.body;

    const project = await Project.findById(project_id);
    if (!project) return res.status(404).json({ message: "Project not found!" });

    if (project.freelancer_id.toString() !== req.userId && project.recruiter_id.toString() !== req.userId) {
        return res.status(403).json({ message: "Not authorized to open dispute for this project!" });
    }

    const dispute = new Dispute({
      project_id,
      opened_by: req.userId,
      reason,
      description
    });

    await dispute.save();

    project.status = 'disputed';
    await project.save();

    res.status(201).json(dispute);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDisputes = async (req, res) => {
    try {
        let query = {};
        if (req.role !== 'admin') {
            // Only admins see all; others see their own (requires complex query on project)
             return res.status(403).json({ message: "Only admins can view all disputes" });
        }
        const disputes = await Dispute.find(query).populate('project_id');
        res.status(200).json(disputes);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { openDispute, getDisputes };
