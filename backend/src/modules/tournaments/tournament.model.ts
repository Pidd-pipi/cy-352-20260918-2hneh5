import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const TOURNAMENT_STATUS = {
  open: "open",
  locked: "locked",
} as const;

export type TournamentStatus =
  (typeof TOURNAMENT_STATUS)[keyof typeof TOURNAMENT_STATUS];

const groupSchema = new Schema(
  {
    name: { type: String, required: true },
    players: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const tournamentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    game: { type: String, required: true, trim: true, maxlength: 60 },
    startTime: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 2, max: 512 },
    groupSize: { type: Number, required: true, min: 2, max: 64 },
    registeredCount: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      required: true,
      enum: Object.values(TOURNAMENT_STATUS),
      default: TOURNAMENT_STATUS.open,
    },
    groups: { type: [groupSchema], required: true, default: [] },
  },
  { timestamps: true },
);

const registrationSchema = new Schema(
  {
    tournamentId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Tournament",
    },
    playerName: { type: String, required: true, trim: true, maxlength: 40 },
    seq: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

// 同一赛事同一玩家只能有一条有效报名；同一赛事内报名顺序号唯一。
registrationSchema.index({ tournamentId: 1, playerName: 1 }, { unique: true });
registrationSchema.index({ tournamentId: 1, seq: 1 }, { unique: true });

export type TournamentDocument = InferSchemaType<typeof tournamentSchema> & {
  _id: Types.ObjectId;
};
export type RegistrationDocument = InferSchemaType<
  typeof registrationSchema
> & {
  _id: Types.ObjectId;
};

export const TournamentModel = model("Tournament", tournamentSchema);
export const RegistrationModel = model("Registration", registrationSchema);
