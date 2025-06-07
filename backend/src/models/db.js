// backend/src/models/db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  // SSL
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};