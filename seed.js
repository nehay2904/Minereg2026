const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Compliance = require('./models/Compliance');
dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    await User.deleteMany({});
    await Compliance.deleteMany({});

    const admin = await User.create({
      name: 'JPL Admin',
      email: 'admin@jplmines.com',
      password: 'Admin@123',
      role: 'admin',
      dept: 'Admin'
    });
    console.log('Admin created:', admin.email);
    console.log('Seed done! Now add users and compliances from admin dashboard.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
