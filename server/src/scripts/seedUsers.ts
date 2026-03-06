import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { env } from '../config/env';

async function seedUsers() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB for seeding');

  const users = [
    {
      name: 'Shohini Ghosh',
      email: 'shohini@merakipeople.com',
      password: await bcrypt.hash('shohini123', 10),
      role: 'shohini' as const,
      voiceProfile: 'Warm, direct, practitioner-led, storytelling-first. 20 years of communication expertise. Speaks from deep experience.',
    },
    {
      name: 'Sanjoy Ghosh',
      email: 'sanjoy@merakipeople.com',
      password: await bcrypt.hash('sanjoy123', 10),
      role: 'sanjoy' as const,
      voiceProfile: 'Honest, technical, building-in-public. Admits failures, celebrates small wins. Builder and operator mindset.',
    },
  ];

  for (const userData of users) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      console.log(`User ${userData.email} already exists, skipping`);
    } else {
      await User.create(userData);
      console.log(`Created user: ${userData.email}`);
    }
  }

  await mongoose.disconnect();
  console.log('Seeding complete');
}

seedUsers().catch(console.error);
