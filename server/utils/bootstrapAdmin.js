require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User");
const mongoose = require("mongoose");

async function run() {
  const allowDemoAdmin = process.env.NODE_ENV !== "production";
  const email = (process.env.ADMIN_EMAIL || (allowDemoAdmin ? "admin@univo.edu" : "")).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (allowDemoAdmin ? "Univo@123" : "");
  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env before bootstrapping Admin");
  }

  await connectDB();
  const existingAdmin = await User.findOne({ role: "admin" }).select("email");
  if (existingAdmin) {
    console.log(`Admin already exists: ${existingAdmin.email}`);
    return;
  }

  await User.create({
    name: process.env.ADMIN_NAME?.trim() || "Univo Admin",
    email,
    password,
    role: "admin",
  });
  console.log(`Admin account created: ${email}`);
}

run()
  .catch((err) => {
    console.error(`[bootstrap-admin] ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
