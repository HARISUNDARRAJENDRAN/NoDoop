import dotenv from "dotenv";

dotenv.config();

function mustGet(name, fallback = "") {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  mongoUri: mustGet("MONGODB_URI"),
  jwtAccessSecret: mustGet("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: mustGet("JWT_REFRESH_SECRET"),
  jwtAccessTTL: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTTL: process.env.JWT_REFRESH_TTL ?? "7d",
  dfsBridgeUrl: process.env.DFS_BRIDGE_URL ?? "http://localhost:9090",
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
};
