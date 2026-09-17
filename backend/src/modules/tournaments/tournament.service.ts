import { Types } from "mongoose";
import { AppError, ERROR_MESSAGES } from "../../common/errors";
import {
  RegistrationModel,
  TournamentModel,
  TOURNAMENT_STATUS,
  type TournamentDocument,
} from "./tournament.model";

export interface CreateTournamentInput {
  name: string;
  game: string;
  startTime: string;
  capacity: number;
  groupSize: number;
}

export interface TournamentGroupView {
  name: string;
  players: string[];
}

export interface TournamentView {
  id: string;
  name: string;
  game: string;
  startTime: string;
  capacity: number;
  groupSize: number;
  registeredCount: number;
  remaining: number;
  status: "open" | "locked";
  groups: TournamentGroupView[];
  players: string[];
  createdAt: string;
}

function toView(
  tournament: TournamentDocument,
  players: string[],
): TournamentView {
  const remaining = Math.max(0, tournament.capacity - tournament.registeredCount);
  return {
    id: tournament._id.toHexString(),
    name: tournament.name,
    game: tournament.game,
    startTime: tournament.startTime.toISOString(),
    capacity: tournament.capacity,
    groupSize: tournament.groupSize,
    registeredCount: tournament.registeredCount,
    remaining,
    status: tournament.status,
    groups: (tournament.groups ?? []).map((group) => ({
      name: group.name,
      players: [...group.players],
    })),
    players,
    createdAt: tournament.createdAt.toISOString(),
  };
}

async function listPlayerNames(tournamentId: string): Promise<string[]> {
  const registrations = await RegistrationModel.find({ tournamentId })
    .sort({ seq: 1 })
    .select({ playerName: 1, _id: 0 })
    .lean();
  return registrations.map((registration) => registration.playerName);
}

/**
 * 按报名顺序轮流分组：第 i 名玩家进入第 (i % 组数) 组，
 * 因此任意两组人数差不超过 1。
 */
export function buildGroups(
  players: string[],
  capacity: number,
  groupSize: number,
): TournamentGroupView[] {
  const groupCount = Math.max(1, Math.ceil(capacity / groupSize));
  const groups: TournamentGroupView[] = Array.from(
    { length: groupCount },
    (_, index) => ({ name: `第 ${index + 1} 组`, players: [] as string[] }),
  );
  players.forEach((player, index) => {
    groups[index % groupCount].players.push(player);
  });
  return groups;
}

/**
 * 满员后锁定并分组。通过条件更新把 open -> locked 的翻转限制为仅一次，
 * 并发触发时只有一个请求能真正写入分组结果。
 */
async function tryFinalizeTournament(tournamentId: string): Promise<void> {
  const tournament = await TournamentModel.findById(tournamentId);
  if (!tournament || tournament.status !== TOURNAMENT_STATUS.open) {
    return;
  }
  const registrations = await RegistrationModel.find({ tournamentId })
    .sort({ seq: 1 })
    .lean();
  if (registrations.length < tournament.capacity) {
    return;
  }
  const groups = buildGroups(
    registrations.map((registration) => registration.playerName),
    tournament.capacity,
    tournament.groupSize,
  );
  await TournamentModel.findOneAndUpdate(
    { _id: tournamentId, status: TOURNAMENT_STATUS.open },
    { $set: { status: TOURNAMENT_STATUS.locked, groups } },
  );
}

export class TournamentService {
  async createTournament(input: CreateTournamentInput): Promise<TournamentView> {
    const name = input.name?.trim();
    const game = input.game?.trim();
    const startTime = new Date(input.startTime);
    const capacity = Number(input.capacity);
    const groupSize = Number(input.groupSize);

    const valid =
      !!name &&
      !!game &&
      !Number.isNaN(startTime.getTime()) &&
      Number.isInteger(capacity) &&
      capacity >= 2 &&
      capacity <= 512 &&
      Number.isInteger(groupSize) &&
      groupSize >= 2 &&
      groupSize <= capacity;
    if (!valid) {
      throw new AppError(400, ERROR_MESSAGES.invalidTournamentPayload);
    }

    const tournament = await TournamentModel.create({
      name,
      game,
      startTime,
      capacity,
      groupSize,
    });
    return toView(tournament, []);
  }

  async listTournaments(): Promise<TournamentView[]> {
    const tournaments = await TournamentModel.find().sort({ createdAt: -1 });
    return Promise.all(
      tournaments.map(async (tournament) =>
        toView(tournament, await listPlayerNames(tournament._id.toHexString())),
      ),
    );
  }

  async getTournament(id: string): Promise<TournamentView> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError(404, ERROR_MESSAGES.tournamentNotFound);
    }
    // 自愈：若此前满员但分组未落库，读取时补齐锁定。
    await tryFinalizeTournament(id);
    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      throw new AppError(404, ERROR_MESSAGES.tournamentNotFound);
    }
    return toView(tournament, await listPlayerNames(id));
  }

  /**
   * 报名流程（并发安全）：
   * 1. 快速路径查重，直接拒绝明显重复报名；
   * 2. 条件原子自增占座（registeredCount < capacity 才成功），杜绝超员；
   * 3. 写入报名记录，(tournamentId, playerName) 唯一索引兜底并发重复，
   *    冲突时回滚名额，保证“只留一份、不超员、不漏人”；
   * 4. 占到最后一个名额后尝试满员分组并锁定。
   */
  async register(tournamentId: string, playerName: string): Promise<TournamentView> {
    const name = playerName?.trim();
    if (!name) {
      throw new AppError(400, ERROR_MESSAGES.invalidPlayerName);
    }
    if (!Types.ObjectId.isValid(tournamentId)) {
      throw new AppError(404, ERROR_MESSAGES.tournamentNotFound);
    }

    const tournament = await TournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new AppError(404, ERROR_MESSAGES.tournamentNotFound);
    }
    if (tournament.status !== TOURNAMENT_STATUS.open) {
      throw new AppError(409, ERROR_MESSAGES.tournamentLocked);
    }

    const existing = await RegistrationModel.findOne({
      tournamentId,
      playerName: name,
    });
    if (existing) {
      throw new AppError(409, ERROR_MESSAGES.duplicateRegistration);
    }

    const seated = await TournamentModel.findOneAndUpdate(
      {
        _id: tournamentId,
        status: TOURNAMENT_STATUS.open,
        registeredCount: { $lt: tournament.capacity },
      },
      { $inc: { registeredCount: 1 } },
      { new: true },
    );
    if (!seated) {
      const current = await TournamentModel.findById(tournamentId).select({
        status: 1,
      });
      if (current && current.status !== TOURNAMENT_STATUS.open) {
        throw new AppError(409, ERROR_MESSAGES.tournamentLocked);
      }
      throw new AppError(409, ERROR_MESSAGES.tournamentFull);
    }

    try {
      await RegistrationModel.create({
        tournamentId,
        playerName: name,
        seq: seated.registeredCount,
      });
    } catch (error) {
      const isDuplicate =
        typeof error === "object" &&
        error !== null &&
        (error as { code?: number }).code === 11000;
      if (isDuplicate) {
        // 并发重复报名：释放多占的名额，只保留先到的有效记录。
        await TournamentModel.updateOne(
          { _id: tournamentId, status: TOURNAMENT_STATUS.open },
          { $inc: { registeredCount: -1 } },
        );
        throw new AppError(409, ERROR_MESSAGES.duplicateRegistration);
      }
      throw error;
    }

    await tryFinalizeTournament(tournamentId);
    return this.getTournament(tournamentId);
  }
}
