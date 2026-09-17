import { Types } from "mongoose";
import { AppError } from "../../common/errors";
import {
  TournamentModel,
  type TournamentDocument,
  type TournamentGroup,
  type TournamentParticipant,
} from "./tournament.model";

export interface CreateTournamentInput {
  name: unknown;
  boardGame: unknown;
  startTime: unknown;
  maxParticipants: unknown;
  groupSize: unknown;
}

export interface TournamentDto {
  id: string;
  name: string;
  boardGame: string;
  startTime: string;
  maxParticipants: number;
  groupSize: number;
  status: TournamentDocument["status"];
  registeredCount: number;
  remainingSeats: number;
  participants: TournamentParticipant[];
  groups: TournamentGroup[];
  createdAt: string;
}

const LIMITS = {
  nameMax: 40,
  boardGameMax: 40,
  playerMax: 24,
  minParticipants: 2,
  maxParticipants: 128,
};

function toDto(tournament: TournamentDocument): TournamentDto {
  return {
    id: tournament.id as string,
    name: tournament.name,
    boardGame: tournament.boardGame,
    startTime: tournament.startTime.toISOString(),
    maxParticipants: tournament.maxParticipants,
    groupSize: tournament.groupSize,
    status: tournament.status,
    registeredCount: tournament.participants.length,
    remainingSeats: Math.max(0, tournament.maxParticipants - tournament.participants.length),
    participants: tournament.participants.map((entry) => ({
      player: entry.player,
      registeredAt: entry.registeredAt,
    })),
    groups: tournament.groups.map((group) => ({ name: group.name, players: [...group.players] })),
    createdAt: tournament.createdAt.toISOString(),
  };
}

function readText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(400, `${field}不能为空`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new AppError(400, `${field}长度不能超过 ${maxLength} 个字符`);
  }
  return text;
}

function readInteger(value: unknown, field: string, min: number, max: number): number {
  const num = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isInteger(num)) {
    throw new AppError(400, `${field}必须是整数`);
  }
  if (num < min || num > max) {
    throw new AppError(400, `${field}必须在 ${min} 到 ${max} 之间`);
  }
  return num;
}

function readStartTime(value: unknown): Date {
  const date = value instanceof Date ? value : new Date(typeof value === "string" || typeof value === "number" ? value : "");
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "开始时间格式无效");
  }
  return date;
}

/**
 * 按报名顺序轮流（发牌式）分组：第 i 名玩家进入第 (i % 组数) 组。
 * 组数 = ceil(人数 / 每组人数)，轮询分配保证任意两组人数差不超过 1。
 */
export function buildGroups(
  participants: TournamentParticipant[],
  groupSize: number,
): TournamentGroup[] {
  const groupCount = Math.max(1, Math.ceil(participants.length / groupSize));
  const groups: TournamentGroup[] = Array.from({ length: groupCount }, (_, index) => ({
    name: `第 ${index + 1} 组`,
    players: [] as string[],
  }));
  participants.forEach((entry, index) => {
    groups[index % groupCount].players.push(entry.player);
  });
  return groups;
}

export class TournamentService {
  async createTournament(input: CreateTournamentInput): Promise<TournamentDto> {
    const name = readText(input.name, "赛事名称", LIMITS.nameMax);
    const boardGame = readText(input.boardGame, "桌游名称", LIMITS.boardGameMax);
    const startTime = readStartTime(input.startTime);
    const maxParticipants = readInteger(
      input.maxParticipants,
      "人数上限",
      LIMITS.minParticipants,
      LIMITS.maxParticipants,
    );
    const groupSize = readInteger(input.groupSize, "每组人数", 2, maxParticipants);

    const tournament = await TournamentModel.create({
      name,
      boardGame,
      startTime,
      maxParticipants,
      groupSize,
    });
    return toDto(tournament);
  }

  async listTournaments(): Promise<TournamentDto[]> {
    const tournaments = await TournamentModel.find().sort({ createdAt: -1 });
    return tournaments.map(toDto);
  }

  async getTournament(id: string): Promise<TournamentDto> {
    const tournament = await this.findById(id);
    return toDto(tournament);
  }

  /**
   * 报名核心：单条原子更新同时校验「开放中 / 未重名 / 未满员」，
   * 并发抢最后一席或重复报名时，MongoDB 只会放行其中一条写入，
   * 因此不会超员，也不会为同一玩家留下两份记录。
   */
  async register(id: string, playerName: unknown): Promise<TournamentDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError(400, "赛事 ID 无效");
    }
    const player = readText(playerName, "玩家昵称", LIMITS.playerMax);

    const updated = await TournamentModel.findOneAndUpdate(
      {
        _id: id,
        status: "open",
        "participants.player": { $ne: player },
        $expr: { $lt: [{ $size: "$participants" }, "$maxParticipants"] },
      },
      { $push: { participants: { player, registeredAt: new Date() } } },
      { new: true },
    );

    if (!updated) {
      await this.throwRegisterFailure(id, player);
      throw new AppError(409, "名额已满，报名失败");
    }

    // 填满最后一席时，由本次请求把赛事原子锁定并写入分组结果；
    // 状态从 open -> grouped 的翻转只会成功一次，并发下不会重复分组。
    if (updated.participants.length === updated.maxParticipants) {
      const groups = buildGroups(updated.participants, updated.groupSize);
      const locked = await TournamentModel.findOneAndUpdate(
        { _id: id, status: "open" },
        { $set: { status: "grouped", groups } },
        { new: true },
      );
      if (locked) {
        return toDto(locked);
      }
    }

    return toDto(updated);
  }

  private async throwRegisterFailure(id: string, player: string): Promise<never> {
    const existing = await TournamentModel.findById(id);
    if (!existing) {
      throw new AppError(404, "赛事不存在");
    }
    if (existing.status !== "open") {
      throw new AppError(409, "报名已锁定：赛事已满员并完成分组");
    }
    if (existing.participants.some((entry) => entry.player === player)) {
      throw new AppError(409, "你已报名，请勿重复提交");
    }
    throw new AppError(409, "名额已满，报名失败");
  }

  private async findById(id: string): Promise<TournamentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError(400, "赛事 ID 无效");
    }
    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      throw new AppError(404, "赛事不存在");
    }
    return tournament;
  }
}
