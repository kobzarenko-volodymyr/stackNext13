import mongoose from "mongoose";

let isConnected: boolean = false;

export const connectToDatabase = async () => {
  // to prevent unknown field queries
  mongoose.set("strictQuery", true);

  if (!process.env.MONGODB_URL) {
    return console.log("MISSING MONGODB_URL");
  }

  if (isConnected) {
    return console.log("MongoDB is already connected");
  }

  // подключение
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      dbName: "NextJS13-test",
    });

    isConnected = true;

    console.log("MongoDB is connected");
  } catch (error) {
    console.log("MongoDB connection failed", error);
  }
};
