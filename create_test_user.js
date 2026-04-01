const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const createTestUser = async () => {
    console.log('🚀 Deleting and recreating test user...');

    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI is missing in .env!');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const email = 'test@example.com';
        const password = 'Password123!';

        // Clear existing
        const result = await User.deleteMany({ email });
        console.log(`🧹 Deleted ${result.deletedCount} user(s) with email ${email}`);

        // Create new verified user
        const newUser = await User.create({
            name: 'Test Account',
            email: email,
            password: password,
            isVerified: true,
            role: 'user'
        });

        console.log('🎉 Test Account Created Successfully!');
        console.log('------------------------------');
        console.log(`📧 Email: ${newUser.email}`);
        console.log(`🔑 Password: ${password}`);
        console.log(`✅ Status: Verified (No OTP needed)`);
        console.log('------------------------------');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createTestUser();
