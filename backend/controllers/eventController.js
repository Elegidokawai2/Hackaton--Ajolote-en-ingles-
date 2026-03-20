const { Event, EventParticipant, EventSubmission } = require('../models/Event');
const Category = require('../models/Category');

const createEvent = async (req, res) => {
  try {
    if (req.role !== 'recruiter' && req.role !== 'admin') {
      return res.status(403).json({ message: "Only recruiters can create events!" });
    }

    const newEvent = new Event({
      recruiter_id: req.userId,
      ...req.body
    });

    // TODO: Connect to Soroban Event Contract to create an event on-chain and lock prize.
    // For now, save to DB in draft or active status.
    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getEvents = async (req, res) => {
  try {
    // Filter logic (status, category, etc)
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.category_id) query.category_id = req.query.category_id;

    const events = await Event.find(query).populate('recruiter_id', 'username email');
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('recruiter_id', 'username email')
      .populate('category_id');
    if (!event) return res.status(404).json({ message: "Event not found!" });

    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const applyToEvent = async (req, res) => {
  try {
    if (req.role !== 'freelancer') {
      return res.status(403).json({ message: "Only freelancers can apply!" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found!" });
    if (event.status !== 'active') return res.status(400).json({ message: "Event is not active." });

    // Check if already applied
    const existing = await EventParticipant.findOne({ event_id: req.params.id, freelancer_id: req.userId });
    if (existing) return res.status(400).json({ message: "Already applied!" });

    const participant = new EventParticipant({
      event_id: req.params.id,
      freelancer_id: req.userId
    });

    // TODO: Interaction with Soroban to track participants if required
    await participant.save();
    res.status(201).json(participant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const submitWork = async (req, res) => {
  try {
    if (req.role !== 'freelancer') {
        return res.status(403).json({ message: "Only freelancers can submit work!" });
    }

    const { file_url, description } = req.body;
    
    // Verify participation
    const participant = await EventParticipant.findOne({ event_id: req.params.id, freelancer_id: req.userId });
    if (!participant) return res.status(403).json({ message: "You have not applied to this event!" });
    
    const submission = new EventSubmission({
      event_id: req.params.id,
      freelancer_id: req.userId,
      file_url,
      description
    });

    participant.status = 'submitted';
    await participant.save();
    await submission.save();

    res.status(201).json(submission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const selectWinner = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found!" });

    if (event.recruiter_id.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the event creator can select a winner!" });
    }

    const { submission_id } = req.body;
    const submission = await EventSubmission.findById(submission_id);
    if (!submission) return res.status(404).json({ message: "Submission not found!" });

    submission.is_winner = true;
    await submission.save();

    // Update participant
    await EventParticipant.findOneAndUpdate(
        { event_id: req.params.id, freelancer_id: submission.freelancer_id },
        { status: 'winner' }
    );

    // Update event status
    event.status = 'completed';
    await event.save();

    // TODO: Call Soroban Contract to release prize to winner and update reputation log

    res.status(200).json({ message: "Winner selected!", submission });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createEvent, getEvents, getEventById, applyToEvent, submitWork, selectWinner };
