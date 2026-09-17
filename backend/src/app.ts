import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { AppError } from "./common/errors";
import { logger } from "./common/logger";
import { overviewRouter } from "./modules/overview/overview.routes";
import { tournamentRouter } from "./modules/tournaments/tournament.routes";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => response.json({ status: "ok" }));
app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.use("/", overviewRouter);
app.use("/api", overviewRouter);
app.use("/", tournamentRouter);
app.use("/api", tournamentRouter);

app.use((_request, response) => {
  response.status(404).json({ message: "接口不存在" });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in (error as object)) {
    response.status(400).json({ message: "请求体不是合法的 JSON" });
    return;
  }
  logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  response.status(500).json({ message: "服务器内部错误" });
});
