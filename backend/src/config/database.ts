import mongoose from "mongoose";
import { logger } from "../common/logger";
import { env } from "./env";

export function buildMongoUri(): string {
  const direct = process.env.MONGO_URL ?? process.env.DATABASE_URL;
  if (direct) {
    return direct;
  }
  const hasAuth = env.dbUser.length > 0 && env.dbPassword.length > 0;
  const credentials = hasAuth
    ? `${encodeURIComponent(env.dbUser)}:${encodeURIComponent(env.dbPassword)}@`
    : "";
  const authSource = hasAuth ? "?authSource=admin" : "";
  return `mongodb://${credentials}${env.dbHost}:${env.dbPort}/${env.dbName}${authSource}`;
}

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(buildMongoUri(), { serverSelectionTimeoutMS: 10000 });
  logger.info(`MongoDB connected: ${env.dbHost}:${env.dbPort}/${env.dbName}`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
