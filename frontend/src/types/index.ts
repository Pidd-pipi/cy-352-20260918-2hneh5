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

export interface TournamentGroup {
  name: string;
  players: string[];
}

export interface Tournament {
  id: string;
  name: string;
  game: string;
  startTime: string;
  capacity: number;
  groupSize: number;
  registeredCount: number;
  remaining: number;
  status: "open" | "locked";
  groups: TournamentGroup[];
  players: string[];
  createdAt: string;
}

export interface CreateTournamentPayload {
  name: string;
  game: string;
  startTime: string;
  capacity: number;
  groupSize: number;
}
