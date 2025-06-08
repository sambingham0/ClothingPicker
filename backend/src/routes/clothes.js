const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../utils/upload');

// GET /api/clothes/:category/:section
router.get('/:category/:section', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { category, section } = req.params;
  
  try {
    // Get user's uploaded items for this category/section
    const result = await db.query(
      'SELECT id, filename, type FROM clothing_items WHERE user_id = $1 AND type = $2',
      [userId, section]
    );
    
    // Convert to objects with ID and URL
    const userItems = result.rows.map(row => ({
      id: row.id,
      url: `/uploads/${row.filename}`,
      type: row.type
    }));
    
    res.json(userItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/clothes/upload
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  const userId = req.user.id;
  const { category, section } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Image file required.' });
  }
  if (!section) {
    return res.status(400).json({ error: 'Section is required.' });
  }

  try {
    // Save to database
    const result = await db.query(
      'INSERT INTO clothing_items (user_id, type, filename) VALUES ($1, $2, $3) RETURNING id, filename',
      [userId, section, file.filename]
    );
    
    // Return the URL of the uploaded image
    const imageUrl = `/uploads/${file.filename}`;
    res.json({ url: imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;