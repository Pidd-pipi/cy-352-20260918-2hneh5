import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import {
  createTournament,
  getTournament,
  listTournaments,
  registerTournament,
} from "./tournament.controller";

function asyncHandler(
  handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}

export const tournamentRouter = Router();

tournamentRouter.get("/tournaments", asyncHandler(listTournaments));
tournamentRouter.post("/tournaments", asyncHandler(createTournament));
tournamentRouter.get("/tournaments/:id", asyncHandler(getTournament));
tournamentRouter.post("/tournaments/:id/register", asyncHandler(registerTournament));
