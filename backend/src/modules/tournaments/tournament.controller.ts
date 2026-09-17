import type { Request, Response } from "express";
import { AppError, ERROR_MESSAGES } from "../../common/errors";
import { isDatabaseReady } from "../../config/database";
import { TournamentService } from "./tournament.service";

const service = new TournamentService();

function ensureDatabase() {
  if (!isDatabaseReady()) {
    throw new AppError(503, ERROR_MESSAGES.databaseUnavailable);
  }
}

function handleError(response: Response, error: unknown) {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }
  response.status(500).json({ message: "服务器内部错误" });
}

export async function listTournaments(_request: Request, response: Response) {
  try {
    ensureDatabase();
    response.json(await service.listTournaments());
  } catch (error) {
    handleError(response, error);
  }
}

export async function getTournament(request: Request, response: Response) {
  try {
    ensureDatabase();
    response.json(await service.getTournament(String(request.params.id)));
  } catch (error) {
    handleError(response, error);
  }
}

export async function createTournament(request: Request, response: Response) {
  try {
    ensureDatabase();
    const created = await service.createTournament(request.body ?? {});
    response.status(201).json(created);
  } catch (error) {
    handleError(response, error);
  }
}

export async function registerPlayer(request: Request, response: Response) {
  try {
    ensureDatabase();
    const { playerName } = request.body ?? {};
    response.json(await service.register(String(request.params.id), playerName));
  } catch (error) {
    handleError(response, error);
  }
}
