import { Router } from "express";
import {
  createTournament,
  getTournament,
  listTournaments,
  registerPlayer,
} from "./tournament.controller";

export const tournamentRouter = Router();

tournamentRouter.get("/tournaments", listTournaments);
tournamentRouter.post("/tournaments", createTournament);
tournamentRouter.get("/tournaments/:id", getTournament);
tournamentRouter.post("/tournaments/:id/register", registerPlayer);
