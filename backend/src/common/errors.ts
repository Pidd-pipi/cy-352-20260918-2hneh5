export class AppError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

export const ERROR_MESSAGES = {
  overviewUnavailable: "Overview data is unavailable",
  tournamentNotFound: "赛事不存在",
  tournamentFull: "名额已满，报名失败",
  tournamentLocked: "分组已完成，报名已锁定",
  duplicateRegistration: "该玩家已报名，请勿重复提交",
  invalidTournamentPayload: "赛事信息不完整或格式不正确",
  invalidPlayerName: "玩家昵称不能为空",
  databaseUnavailable: "数据库暂不可用，请稍后重试",
};
