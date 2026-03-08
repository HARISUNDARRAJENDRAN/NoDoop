import mongoose from "mongoose";

export async function connectMongo(uri) {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri, {
      autoIndex: true,
      maxPoolSize: 20
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("certificate is not yet valid")) {
      const hint =
        "TLS certificate validation failed: your system clock appears out of sync. " +
        "Sync Windows time (date/time + timezone) and retry.";
      error.message = `${error.message}\n${hint}`;
    }
    throw error;
  }
}
