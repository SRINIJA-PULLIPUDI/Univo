require("dotenv").config();
const mongoose = require("mongoose");
const Bookmark = require("../models/Bookmark");

async function fixIndexes() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");
  const coll = mongoose.connection.collection("bookmarks");
  
  try {
    await coll.dropIndex("user_1_resource_1");
    console.log("Successfully dropped user_1_resource_1 index.");
  } catch (err) {
    console.log("Drop user_1_resource_1:", err.message);
  }

  try {
    await coll.dropIndex("user_1_circular_1");
    console.log("Successfully dropped user_1_circular_1 index.");
  } catch (err) {
    console.log("Drop user_1_circular_1:", err.message);
  }

  await Bookmark.syncIndexes();
  console.log("Successfully synced Bookmark indexes!");

  const indexes = await coll.indexes();
  console.log("Current indexes:", JSON.stringify(indexes, null, 2));
  process.exit(0);
}

fixIndexes().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
