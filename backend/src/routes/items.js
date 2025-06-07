const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../utils/upload');

// GET all items for current user
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      'SELECT id, type, filename, label, created_at, updated_at FROM clothing_items WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single item
router.get('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.id;
  try {
    const result = await db.query(
      'SELECT id, type, filename, label, created_at, updated_at FROM clothing_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE new item (with image)
// Expect multipart/form-data: { type, label, image: File }
router.post(
  '/',
  authMiddleware,
  upload.single('image'),
  async (req, res) => {
    const userId = req.user.id;
    const { type, label } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Image file required.' });
    }
    if (!type) {
      return res.status(400).json({ error: 'Type is required.' });
    }

    try {
      const result = await db.query(
        'INSERT INTO clothing_items (user_id, type, filename, label) VALUES ($1, $2, $3, $4) RETURNING id, type, filename, label, created_at, updated_at',
        [userId, type, file.filename, label || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE item
router.delete('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.id;
  try {
    // Fetch filename to delete from disk
    const existing = await db.query(
      'SELECT filename FROM clothing_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    const filename = existing.rows[0].filename;

    // Delete DB row
    await db.query('DELETE FROM clothing_items WHERE id = $1 AND user_id = $2', [
      itemId,
      userId,
    ]);

    // Delete file from disk
    const fs = require('fs');
    const path = require('path');
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.resolve(uploadDir, filename);
    fs.unlink(filePath, (err) => {
      if (err) console.warn('Failed to delete image:', err);
    });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
