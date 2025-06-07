const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

async function hashPassword(plainTextPassword) {
  const saltRounds = 10;
  return bcrypt.hash(plainTextPassword, saltRounds);
}

async function comparePassword(plainTextPassword, hash) {
  return bcrypt.compare(plainTextPassword, hash);
}

function signToken(user) {
  // We’ll include only the user id and email in the JWT payload
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken };
