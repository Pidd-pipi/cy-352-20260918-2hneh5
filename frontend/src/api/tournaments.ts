import { API_BASE_URL } from "../constants/app";
import type { Tournament, TournamentInput } from "../types";

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return body;
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const response = await fetch(`${API_BASE_URL}/tournaments`, {
    headers: { Accept: "application/json" },
  });
  return parseResponse<Tournament[]>(response);
}

export async function createTournament(input: TournamentInput): Promise<Tournament> {
  const response = await fetch(`${API_BASE_URL}/tournaments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<Tournament>(response);
}

export async function registerTournament(id: string, player: string): Promise<Tournament> {
  const response = await fetch(`${API_BASE_URL}/tournaments/${id}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ player }),
  });
  return parseResponse<Tournament>(response);
}
