import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { logger } from "./common/logger";

async function bootstrap() {
  const connected = await connectDatabase();
  if (!connected) {
    logger.error("MongoDB unavailable at startup; tournament APIs will return 503 until reconnected.");
  }
  app.listen(env.port, "0.0.0.0", () => {
    logger.info(`API listening on port ${env.port}`);
  });
}

void bootstrap();
