// backend/src/app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const itemRoutes = require('./routes/items');
const outfitRoutes = require('./routes/outfits');
const clothesRoutes = require('./routes/clothes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static uploads
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/outfits', outfitRoutes);
app.use('/api/clothes', clothesRoutes);

// Healthcheck
app.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong from /api/ping' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
