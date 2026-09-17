import { Schema, model, type Document } from "mongoose";

export const TOURNAMENT_STATUSES = ["open", "grouped"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export interface TournamentParticipant {
  player: string;
  registeredAt: Date;
}

export interface TournamentGroup {
  name: string;
  players: string[];
}

export interface TournamentDocument extends Document {
  name: string;
  boardGame: string;
  startTime: Date;
  maxParticipants: number;
  groupSize: number;
  status: TournamentStatus;
  participants: TournamentParticipant[];
  groups: TournamentGroup[];
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<TournamentParticipant>(
  {
    player: { type: String, required: true, trim: true, maxlength: 24 },
    registeredAt: { type: Date, required: true },
  },
  { _id: false },
);

const groupSchema = new Schema<TournamentGroup>(
  {
    name: { type: String, required: true },
    players: { type: [String], default: [] },
  },
  { _id: false },
);

const tournamentSchema = new Schema<TournamentDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    boardGame: { type: String, required: true, trim: true, maxlength: 40 },
    startTime: { type: Date, required: true },
    maxParticipants: { type: Number, required: true, min: 2, max: 128 },
    groupSize: { type: Number, required: true, min: 2, max: 128 },
    status: { type: String, enum: TOURNAMENT_STATUSES, default: "open" },
    participants: { type: [participantSchema], default: [] },
    groups: { type: [groupSchema], default: [] },
  },
  { timestamps: true },
);

tournamentSchema.index({ createdAt: -1 });

export const TournamentModel = model<TournamentDocument>("Tournament", tournamentSchema);
