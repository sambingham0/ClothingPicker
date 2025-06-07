const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middlewares/authMiddleware');

// GET /api/outfits → list all outfits w/ nested items
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    // Fetch outfits
    const outfitsRes = await db.query(
      'SELECT id, name, created_at FROM outfits WHERE user_id = $1',
      [userId]
    );
    const outfits = outfitsRes.rows;

    // For each outfit, fetch its items
    for (let outfit of outfits) {
      const itemsRes = await db.query(
        `SELECT ci.id, ci.type, ci.filename, ci.label 
         FROM outfit_items oi 
         JOIN clothing_items ci ON oi.clothing_item_id = ci.id 
         WHERE oi.outfit_id = $1`,
        [outfit.id]
      );
      outfit.items = itemsRes.rows;
    }
    res.json(outfits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/outfits → create
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { name, items } = req.body;
  if (!name || !Array.isArray(items)) {
    return res
      .status(400)
      .json({ error: 'Name and array of item IDs required.' });
  }
  try {
    // Create outfit
    const outfitRes = await db.query(
      'INSERT INTO outfits (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at',
      [userId, name]
    );
    const outfit = outfitRes.rows[0];

    // Insert into outfit_items
    if (items.length > 0) {
      const valuesClause = items
        .map((_, idx) => `($1, $${idx + 2})`)
        .join(', ');
      // Flatten [outfit.id, item1, item2, item3, ...]
      const values = [outfit.id, ...items];
      await db.query(
        `INSERT INTO outfit_items (outfit_id, clothing_item_id) VALUES ${valuesClause}`,
        values
      );
    }

    // Respond with full outfit (with items)
    const itemsRes = await db.query(
      `SELECT ci.id, ci.type, ci.filename, ci.label
       FROM outfit_items oi
       JOIN clothing_items ci ON oi.clothing_item_id = ci.id
       WHERE oi.outfit_id = $1`,
      [outfit.id]
    );
    outfit.items = itemsRes.rows;
    res.status(201).json(outfit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/outfits/:id → update name/items
router.put('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const outfitId = req.params.id;
  const { name, items } = req.body;
  try {
    // Check ownership
    const existing = await db.query(
      'SELECT id FROM outfits WHERE id = $1 AND user_id = $2',
      [outfitId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    // Update name if provided
    if (name) {
      await db.query('UPDATE outfits SET name = $1 WHERE id = $2', [name, outfitId]);
    }
    // If items provided, reset join table
    if (Array.isArray(items)) {
      // Delete old join rows
      await db.query('DELETE FROM outfit_items WHERE outfit_id = $1', [outfitId]);
      // Insert new ones
      if (items.length > 0) {
        const valuesClause = items
          .map((_, idx) => `($1, $${idx + 2})`)
          .join(', ');
        const values = [outfitId, ...items];
        await db.query(
          `INSERT INTO outfit_items (outfit_id, clothing_item_id) VALUES ${valuesClause}`,
          values
        );
      }
    }
    // Return updated outfit
    const outfitRes = await db.query(
      'SELECT id, name, created_at FROM outfits WHERE id = $1',
      [outfitId]
    );
    const outfit = outfitRes.rows[0];
    const itemsRes = await db.query(
      `SELECT ci.id, ci.type, ci.filename, ci.label
       FROM outfit_items oi
       JOIN clothing_items ci ON oi.clothing_item_id = ci.id
       WHERE oi.outfit_id = $1`,
      [outfitId]
    );
    outfit.items = itemsRes.rows;
    res.json(outfit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/outfits/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const outfitId = req.params.id;
  try {
    // Check ownership
    const existing = await db.query(
      'SELECT id FROM outfits WHERE id = $1 AND user_id = $2',
      [outfitId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    await db.query('DELETE FROM outfits WHERE id = $1', [outfitId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
