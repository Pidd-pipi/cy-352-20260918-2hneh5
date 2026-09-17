import { API_BASE_URL } from "../constants/app";
import type { CreateTournamentPayload, OverviewResponse, Tournament } from "../types";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // 保留默认错误信息
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function fetchOverview(): Promise<OverviewResponse> {
  const response = await fetch(`${API_BASE_URL}/overview`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Overview request failed: ${response.status}`);
  }

  return response.json() as Promise<OverviewResponse>;
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const response = await fetch(`${API_BASE_URL}/tournaments`, {
    headers: { Accept: "application/json" },
  });
  return parseResponse<Tournament[]>(response);
}

export async function createTournament(
  payload: CreateTournamentPayload,
): Promise<Tournament> {
  const response = await fetch(`${API_BASE_URL}/tournaments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<Tournament>(response);
}

export async function registerPlayer(
  tournamentId: string,
  playerName: string,
): Promise<Tournament> {
  const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ playerName }),
  });
  return parseResponse<Tournament>(response);
}
