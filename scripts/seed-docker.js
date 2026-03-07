// Seed script for Docker — runs with plain Node.js (no tsx needed)
// Usage: docker exec signal-api node /app/scripts/seed-docker.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/the-signal';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['shohini', 'sanjoy'] },
  voiceProfile: { type: String, default: '' },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB for seeding');

  const users = [
    { name: 'Shohini Ghosh', email: 'shohini@merakipeople.com', password: 'shohini123', role: 'shohini' },
    { name: 'Sanjoy Ghosh', email: 'sanjoy@merakipeople.com', password: 'sanjoy123', role: 'sanjoy' },
  ];

  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`User already exists: ${u.email}`);
      continue;
    }
    const hashed = await bcrypt.hash(u.password, 10);
    await User.create({ ...u, password: hashed });
    console.log(`Created user: ${u.email}`);
  }

  console.log('Seeding complete');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
