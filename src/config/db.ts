import mongoose from 'mongoose';

async function connectDB(): Promise<void> {
  const conn = await mongoose.connect(process.env.MONGODB_URI!);
  console.log(`MongoDB connected: ${conn.connection.host}`);
}

export default connectDB;
