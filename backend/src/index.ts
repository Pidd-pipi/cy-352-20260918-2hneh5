import { app } from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { logger } from "./common/logger";

async function bootstrap() {
  await connectDatabase();
  app.listen(env.port, "0.0.0.0", () => {
    logger.info(`API listening on port ${env.port}`);
  });
}

bootstrap().catch((error: unknown) => {
  logger.error(`Failed to start API: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
