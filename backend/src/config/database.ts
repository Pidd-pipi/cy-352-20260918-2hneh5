import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../common/logger";

export function buildMongoUri(): string {
  if (env.databaseUrl) {
    return env.databaseUrl;
  }
  const hasAuth = env.dbUser.length > 0 && env.dbPassword.length > 0;
  const credentials = hasAuth
    ? `${encodeURIComponent(env.dbUser)}:${encodeURIComponent(env.dbPassword)}@`
    : "";
  const authSource = hasAuth ? "?authSource=admin" : "";
  return `mongodb://${credentials}${env.dbHost}:${env.dbPort}/${env.dbName}${authSource}`;
}

export async function connectDatabase(): Promise<boolean> {
  const uri = buildMongoUri();
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    logger.info(`MongoDB connected: ${mongoose.connection.name}`);
    return true;
  } catch (error) {
    logger.error(
      `MongoDB connection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
