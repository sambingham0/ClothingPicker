const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  // At this point, req.user contains { id, email }
  res.json({ id: req.user.id, email: req.user.email });
});

module.exports = router;
