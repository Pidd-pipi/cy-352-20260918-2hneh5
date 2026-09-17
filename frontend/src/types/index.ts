export interface FeatureItem {
  id: number;
  title: string;
  description: string;
  status: string;
  metric: string;
}

export interface KpiItem {
  label: string;
  value: string;
  trend: string;
  tone: string;
}

export interface OperationRecord {
  key: string;
  name: string;
  owner: string;
  status: string;
  metric: string;
  priority: string;
}

export interface OverviewResponse {
  appName: string;
  appCode: string;
  description: string;
  features: FeatureItem[];
  kpis: KpiItem[];
  records: OperationRecord[];
}

export type TournamentStatus = "open" | "grouped";

export interface TournamentParticipant {
  player: string;
  registeredAt: string;
}

export interface TournamentGroup {
  name: string;
  players: string[];
}

export interface Tournament {
  id: string;
  name: string;
  boardGame: string;
  startTime: string;
  maxParticipants: number;
  groupSize: number;
  status: TournamentStatus;
  registeredCount: number;
  remainingSeats: number;
  participants: TournamentParticipant[];
  groups: TournamentGroup[];
  createdAt: string;
}

export interface TournamentInput {
  name: string;
  boardGame: string;
  startTime: string;
  maxParticipants: number;
  groupSize: number;
}
