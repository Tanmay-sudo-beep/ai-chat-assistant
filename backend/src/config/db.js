import mongoose from 'mongoose';

export async function connectDB(uri) {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`✅ MongoDB connected: ${mongoose.connection.name}`);
}

export const isDbConnected = () => mongoose.connection.readyState === 1;
