const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

const sampleProducts = [
  {
    name: 'NexusPhone Pro 15',
    shortDescription: 'The ultimate smartphone experience.',
    description: 'Featuring a 6.7" Super Retina XDR display, A17 Pro chip, and a revolutionary 48MP camera system. Available in four stunning finishes.',
    price: 129900,
    originalPrice: 139900,
    category: 'Phones',
    brand: 'Nexus',
    stock: 50,
    discount: 7,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800', alt: 'NexusPhone Pro 15' }],
    features: ['A17 Pro Chip', '48MP Camera', '6.7" OLED Display', '5G Ready', 'Face ID'],
    specifications: [{ key: 'Display', value: '6.7" Super Retina XDR' }, { key: 'Chip', value: 'A17 Pro' }, { key: 'Camera', value: '48MP Triple System' }, { key: 'Battery', value: '4422 mAh' }],
    ratings: 4.8,
    numReviews: 124,
    sku: 'NST-PHONE-001',
  },
  {
    name: 'NexusBuds Pro',
    shortDescription: 'Hear everything. Feel nothing.',
    description: 'Industry-leading Active Noise Cancellation. Adaptive Audio. Up to 30 hours of battery life. Spatial Audio with dynamic head tracking.',
    price: 24900,
    originalPrice: 29900,
    category: 'Audio',
    brand: 'Nexus',
    stock: 120,
    discount: 17,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800', alt: 'NexusBuds Pro' }],
    features: ['Active Noise Cancellation', 'Spatial Audio', '30hr Battery', 'Wireless Charging', 'IPX4 Water Resistant'],
    specifications: [{ key: 'Driver', value: '11mm Dynamic' }, { key: 'Battery', value: '30 hours total' }, { key: 'Connectivity', value: 'Bluetooth 5.3' }],
    ratings: 4.7,
    numReviews: 89,
    sku: 'NST-AUDIO-001',
  },
  {
    name: 'NexusWatch Ultra 2',
    shortDescription: 'The most capable watch ever.',
    description: 'Titanium case. Precision dual-frequency GPS. Up to 60 hours of battery. Built for exploration, adventure, and everything in between.',
    price: 89900,
    originalPrice: 94900,
    category: 'Wearables',
    brand: 'Nexus',
    stock: 30,
    discount: 5,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800', alt: 'NexusWatch Ultra 2' }],
    features: ['Titanium Build', 'Dual GPS', '60hr Battery', 'Depth Gauge', 'Blood Oxygen Monitor'],
    specifications: [{ key: 'Case', value: '49mm Titanium' }, { key: 'Display', value: 'Ultra Retina LTPO OLED' }, { key: 'Water Resistance', value: '100m' }],
    ratings: 4.9,
    numReviews: 56,
    sku: 'NST-WEAR-001',
  },
  {
    name: 'NexusBook Air M3',
    shortDescription: 'Impossibly thin. Impossibly powerful.',
    description: 'The M3 chip brings incredible performance to the thinnest MacBook Air ever. Up to 18 hours of battery life. 13.6" Liquid Retina display.',
    price: 114900,
    originalPrice: 119900,
    category: 'Computers',
    brand: 'Nexus',
    stock: 25,
    discount: 4,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800', alt: 'NexusBook Air M3' }],
    features: ['M3 Chip', '18hr Battery', '13.6" Liquid Retina', 'MagSafe Charging', 'Fanless Design'],
    specifications: [{ key: 'Chip', value: 'Nexus M3' }, { key: 'RAM', value: '16GB' }, { key: 'Storage', value: '512GB SSD' }, { key: 'Display', value: '13.6" 2560x1664' }],
    ratings: 4.9,
    numReviews: 201,
    sku: 'NST-COMP-001',
  },
  {
    name: 'NexusPad Pro 12.9"',
    shortDescription: 'Your next computer is not a computer.',
    description: 'M2 chip. Stunning 12.9" Liquid Retina XDR display. All-day battery. Compatible with Magic Keyboard and Nexus Pencil.',
    price: 109900,
    originalPrice: 114900,
    category: 'Tablets',
    brand: 'Nexus',
    stock: 18,
    discount: 4,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800', alt: 'NexusPad Pro' }],
    features: ['M2 Chip', '12.9" XDR Display', 'ProMotion 120Hz', 'Thunderbolt 4', 'Face ID'],
    specifications: [{ key: 'Chip', value: 'Nexus M2' }, { key: 'Display', value: '12.9" Liquid Retina XDR' }, { key: 'Storage', value: '256GB' }],
    ratings: 4.8,
    numReviews: 77,
    sku: 'NST-TAB-001',
  },
  {
    name: 'NexusHub Thunderbolt 4',
    shortDescription: 'Connect everything.',
    description: '7-in-1 Thunderbolt 4 hub. 4K HDMI, USB-A, USB-C, SD card reader, 96W passthrough charging. Compact aluminum design.',
    price: 8900,
    originalPrice: 9900,
    category: 'Accessories',
    brand: 'Nexus',
    stock: 200,
    discount: 10,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1625895197185-efcec01cffe0?w=800', alt: 'NexusHub' }],
    features: ['Thunderbolt 4', '4K HDMI', '96W Passthrough', 'SD/MicroSD', 'USB 3.2 Gen 2'],
    ratings: 4.5,
    numReviews: 43,
    sku: 'NST-ACC-001',
  },
];

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB Connected');
};

const seedData = async () => {
  await connectDB();

  // Clear existing
  await User.deleteMany({});
  await Product.deleteMany({});
  await Order.deleteMany({});
  console.log('Cleared existing data');

  // Create admin
  const adminUser = await User.create({
    name: 'Admin User',
    email: process.env.ADMIN_EMAIL || 'admin@nexusstore.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
    role: 'admin',
    isVerified: true,
  });
  console.log(`Admin created: ${adminUser.email}`);

  // Create test user
  const testUser = await User.create({
    name: 'Test User',
    email: 'user@nexusstore.com',
    password: 'User@1234',
    role: 'user',
    isVerified: true,
  });
  console.log(`Test user created: ${testUser.email}`);

  // Create products
  await Product.insertMany(sampleProducts);
  console.log(`${sampleProducts.length} products seeded`);

  console.log('\n✅ Database seeded successfully!');
  console.log('Admin:', process.env.ADMIN_EMAIL || 'admin@nexusstore.com', '/', process.env.ADMIN_PASSWORD || 'Admin@123');
  console.log('User: user@nexusstore.com / User@1234');

  process.exit(0);
};

seedData().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
