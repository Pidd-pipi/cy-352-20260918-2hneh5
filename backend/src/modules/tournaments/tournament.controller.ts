import type { Request, Response } from "express";
import { TournamentService } from "./tournament.service";

const service = new TournamentService();

export async function createTournament(request: Request, response: Response) {
  const tournament = await service.createTournament(request.body ?? {});
  response.status(201).json(tournament);
}

export async function listTournaments(_request: Request, response: Response) {
  response.json(await service.listTournaments());
}

export async function getTournament(request: Request, response: Response) {
  response.json(await service.getTournament(String(request.params.id)));
}

export async function registerTournament(request: Request, response: Response) {
  const tournament = await service.register(String(request.params.id), request.body?.player);
  response.status(201).json(tournament);
}
