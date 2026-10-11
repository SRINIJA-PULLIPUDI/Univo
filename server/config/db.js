const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/univo";
  try {
    await mongoose.connect(uri);
    console.log(`[db] MongoDB connected -> ${mongoose.connection.name}`);
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
