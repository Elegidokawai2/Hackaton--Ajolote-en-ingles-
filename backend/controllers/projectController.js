const { Project, ProjectDelivery, ProjectStatusLog } = require('../models/Project');

const createProject = async (req, res) => {
  try {
    if (req.role !== 'recruiter' && req.role !== 'freelancer') {
        return res.status(403).json({ message: "Invalid role!" });
    }

    const { freelancer_id, recruiter_id, category_id, title, description, amount, guarantee, deadline } = req.body;

    const newProject = new Project({
      freelancer_id,
      recruiter_id,
      category_id,
      title,
      description,
      amount,
      guarantee,
      deadline
    });

    const savedProject = await newProject.save();

    const log = new ProjectStatusLog({
      project_id: savedProject._id,
      status: 'proposed',
      changed_by: req.userId
    });
    await log.save();

    res.status(201).json(savedProject);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

const getProjects = async (req, res) => {
    try {
        const query = {};
        if (req.role === 'freelancer') query.freelancer_id = req.userId;
        else if (req.role === 'recruiter') query.recruiter_id = req.userId;

        if (req.query.status) query.status = req.query.status;

        const projects = await Project.find(query).populate('freelancer_id').populate('recruiter_id');
        res.status(200).json(projects);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if(!project) return res.status(404).json({ message: "Project not found!" });
        res.status(200).json(project);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

const updateProjectStatus = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if(!project) return res.status(404).json({ message: "Project not found!" });

        // Authorization simplified for MVP
        if(project.freelancer_id.toString() !== req.userId && project.recruiter_id.toString() !== req.userId) {
            return res.status(403).json({ message: "Not authorized!" });
        }

        project.status = req.body.status;
        await project.save();

        const log = new ProjectStatusLog({
            project_id: project._id,
            status: req.body.status,
            changed_by: req.userId
        });
        await log.save();

        res.status(200).json(project);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

const deliverProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if(!project) return res.status(404).json({ message: "Project not found!" });

        if(project.freelancer_id.toString() !== req.userId) {
            return res.status(403).json({ message: "Only the assigned freelancer can deliver!" });
        }

        const delivery = new ProjectDelivery({
            project_id: project._id,
            file_url: req.body.file_url,
            description: req.body.description
        });
        await delivery.save();

        project.status = 'review';
        await project.save();

        res.status(201).json(delivery);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { createProject, getProjects, getProjectById, updateProjectStatus, deliverProject };
