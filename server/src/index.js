require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const merchantRoutes = require('./routes/merchant');
const adminRoutes = require('./routes/admin');

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) throw new Error('MONGODB_URI is required in server/.env');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required in server/.env');

app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/verify', merchantRoutes);
app.use('/api/admin', adminRoutes);
app.use((error, _req, res, _next) => {
  console.error(error);
  return res.status(500).json({ message: 'Internal server error' });
});

mongoose
  .connect(mongoUri)
  .then(() => app.listen(port, () => console.log(`Auth API listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error('MongoDB connection failed', error.message);
    process.exit(1);
  });