// client/src/entities/session/types.ts
/** Одно измерение реакции оператора внутри сеанса. */
export interface ReactionPoint {
  /** Секунда сеанса, на которой цель была отмечена */
  t: number;
  reactionMs: number;
  correct: boolean;
}

export interface SessionResult {
  id: string;
  userId: string;
  mode: 'training';
  startedAt: number;
  finishedAt: number;
  durationSec: number;
  markedTotal: number;
  correct: number;
  wrong: number;
  points: ReactionPoint[];
}
