const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  return { id: user._id.toString(), role: user.role, username: user.username, merchantId: user.merchantId, govId: user.govId, email: user.email };
}

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

router.post('/register', async (req, res, next) => {
  try {
    const { role, email, password, username, merchantId, govId } = req.body;
    const normalizedRole = role === 'merchant' ? 'merchant' : role === 'admin' ? 'admin' : 'consumer';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const finalUsername = (username && username.trim()) || (normalizedEmail ? normalizedEmail.split('@')[0].trim() : '');

    if (!normalizedEmail || !validatePassword(password)) {
      return res.status(400).json({ message: 'Email and a password of at least 8 characters are required' });
    }

    if (normalizedRole === 'merchant' && (!merchantId || !finalUsername)) {
      return res.status(400).json({ message: 'Merchant ID and username are required for merchants' });
    }

    if (!finalUsername) {
      return res.status(400).json({ message: 'A username is required' });
    }

    if (normalizedRole === 'admin' && !govId?.trim()) {
      return res.status(400).json({ message: 'Government ID is required for admin accounts' });
    }

    const existingEmail = await User.findOne({ email: normalizedEmail });
    const existingPublicAccount = normalizedRole === 'admin'
      ? await User.findOne({ email: normalizedEmail, role: { $in: ['consumer', 'merchant'] } })
      : null;
    if (existingEmail && (normalizedRole === 'admin' || existingEmail.role === 'admin') || existingPublicAccount) {
      return res.status(409).json({ message: 'Account already exists' });
    }

    const existing = await User.findOne({
      $or: [
        ...(normalizedRole === 'admin' ? [{ email: normalizedEmail }] : [{ email: normalizedEmail, role: normalizedRole }]),
        ...(finalUsername ? [{ username: finalUsername.toLowerCase() }] : []),
        ...(merchantId ? [{ merchantId: merchantId.toUpperCase() }] : []),
      ],
    });
    if (existing) return res.status(409).json({ message: 'An account with these details already exists' });

    const user = await User.create({
      role: normalizedRole,
      email: normalizedEmail,
      username: finalUsername,
      govId: normalizedRole === 'admin' ? String(govId).trim().toUpperCase() : undefined,
      merchantId: normalizedRole === 'merchant' ? merchantId : undefined,
      passwordHash: await bcrypt.hash(password, 12),
    });
    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'An account with this email, username, or ID already exists' });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { role, email, password } = req.body;
    const normalizedRole = role === 'merchant' ? 'merchant' : role === 'admin' ? 'admin' : 'consumer';

    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const query = { role: normalizedRole, email: email.toLowerCase() };

    const user = await User.findOne(query);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid credentials' });

    return res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;