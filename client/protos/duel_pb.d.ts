import * as jspb from 'google-protobuf'



export class GetLeaderboardRequest extends jspb.Message {
  getLimit(): number;
  setLimit(value: number): GetLeaderboardRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetLeaderboardRequest.AsObject;
  static toObject(includeInstance: boolean, msg: GetLeaderboardRequest): GetLeaderboardRequest.AsObject;
  static serializeBinaryToWriter(message: GetLeaderboardRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetLeaderboardRequest;
  static deserializeBinaryFromReader(message: GetLeaderboardRequest, reader: jspb.BinaryReader): GetLeaderboardRequest;
}

export namespace GetLeaderboardRequest {
  export type AsObject = {
    limit: number,
  }
}

export class LeaderboardEntry extends jspb.Message {
  getUsername(): string;
  setUsername(value: string): LeaderboardEntry;

  getElo(): number;
  setElo(value: number): LeaderboardEntry;

  getWins(): number;
  setWins(value: number): LeaderboardEntry;

  getLosses(): number;
  setLosses(value: number): LeaderboardEntry;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LeaderboardEntry.AsObject;
  static toObject(includeInstance: boolean, msg: LeaderboardEntry): LeaderboardEntry.AsObject;
  static serializeBinaryToWriter(message: LeaderboardEntry, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LeaderboardEntry;
  static deserializeBinaryFromReader(message: LeaderboardEntry, reader: jspb.BinaryReader): LeaderboardEntry;
}

export namespace LeaderboardEntry {
  export type AsObject = {
    username: string,
    elo: number,
    wins: number,
    losses: number,
  }
}

export class GetLeaderboardResponse extends jspb.Message {
  getEntriesList(): Array<LeaderboardEntry>;
  setEntriesList(value: Array<LeaderboardEntry>): GetLeaderboardResponse;
  clearEntriesList(): GetLeaderboardResponse;
  addEntries(value?: LeaderboardEntry, index?: number): LeaderboardEntry;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetLeaderboardResponse.AsObject;
  static toObject(includeInstance: boolean, msg: GetLeaderboardResponse): GetLeaderboardResponse.AsObject;
  static serializeBinaryToWriter(message: GetLeaderboardResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetLeaderboardResponse;
  static deserializeBinaryFromReader(message: GetLeaderboardResponse, reader: jspb.BinaryReader): GetLeaderboardResponse;
}

export namespace GetLeaderboardResponse {
  export type AsObject = {
    entriesList: Array<LeaderboardEntry.AsObject>,
  }
}

export class RegisterPlayerRequest extends jspb.Message {
  getUsername(): string;
  setUsername(value: string): RegisterPlayerRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): RegisterPlayerRequest.AsObject;
  static toObject(includeInstance: boolean, msg: RegisterPlayerRequest): RegisterPlayerRequest.AsObject;
  static serializeBinaryToWriter(message: RegisterPlayerRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): RegisterPlayerRequest;
  static deserializeBinaryFromReader(message: RegisterPlayerRequest, reader: jspb.BinaryReader): RegisterPlayerRequest;
}

export namespace RegisterPlayerRequest {
  export type AsObject = {
    username: string,
  }
}

export class RegisterPlayerResponse extends jspb.Message {
  getPlayerId(): string;
  setPlayerId(value: string): RegisterPlayerResponse;

  getAuthToken(): string;
  setAuthToken(value: string): RegisterPlayerResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): RegisterPlayerResponse.AsObject;
  static toObject(includeInstance: boolean, msg: RegisterPlayerResponse): RegisterPlayerResponse.AsObject;
  static serializeBinaryToWriter(message: RegisterPlayerResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): RegisterPlayerResponse;
  static deserializeBinaryFromReader(message: RegisterPlayerResponse, reader: jspb.BinaryReader): RegisterPlayerResponse;
}

export namespace RegisterPlayerResponse {
  export type AsObject = {
    playerId: string,
    authToken: string,
  }
}

export class CreateMatchRequest extends jspb.Message {
  getPlayerId(): string;
  setPlayerId(value: string): CreateMatchRequest;

  getMode(): MatchMode;
  setMode(value: MatchMode): CreateMatchRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CreateMatchRequest.AsObject;
  static toObject(includeInstance: boolean, msg: CreateMatchRequest): CreateMatchRequest.AsObject;
  static serializeBinaryToWriter(message: CreateMatchRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CreateMatchRequest;
  static deserializeBinaryFromReader(message: CreateMatchRequest, reader: jspb.BinaryReader): CreateMatchRequest;
}

export namespace CreateMatchRequest {
  export type AsObject = {
    playerId: string,
    mode: MatchMode,
  }
}

export class CreateMatchResponse extends jspb.Message {
  getMatchId(): string;
  setMatchId(value: string): CreateMatchResponse;

  getJoinCode(): string;
  setJoinCode(value: string): CreateMatchResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CreateMatchResponse.AsObject;
  static toObject(includeInstance: boolean, msg: CreateMatchResponse): CreateMatchResponse.AsObject;
  static serializeBinaryToWriter(message: CreateMatchResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CreateMatchResponse;
  static deserializeBinaryFromReader(message: CreateMatchResponse, reader: jspb.BinaryReader): CreateMatchResponse;
}

export namespace CreateMatchResponse {
  export type AsObject = {
    matchId: string,
    joinCode: string,
  }
}

export class JoinMatchRequest extends jspb.Message {
  getMatchId(): string;
  setMatchId(value: string): JoinMatchRequest;

  getPlayerId(): string;
  setPlayerId(value: string): JoinMatchRequest;

  getJoinCode(): string;
  setJoinCode(value: string): JoinMatchRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): JoinMatchRequest.AsObject;
  static toObject(includeInstance: boolean, msg: JoinMatchRequest): JoinMatchRequest.AsObject;
  static serializeBinaryToWriter(message: JoinMatchRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): JoinMatchRequest;
  static deserializeBinaryFromReader(message: JoinMatchRequest, reader: jspb.BinaryReader): JoinMatchRequest;
}

export namespace JoinMatchRequest {
  export type AsObject = {
    matchId: string,
    playerId: string,
    joinCode: string,
  }
}

export class JoinMatchResponse extends jspb.Message {
  getMatchId(): string;
  setMatchId(value: string): JoinMatchResponse;

  getStatus(): MatchStatus;
  setStatus(value: MatchStatus): JoinMatchResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): JoinMatchResponse.AsObject;
  static toObject(includeInstance: boolean, msg: JoinMatchResponse): JoinMatchResponse.AsObject;
  static serializeBinaryToWriter(message: JoinMatchResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): JoinMatchResponse;
  static deserializeBinaryFromReader(message: JoinMatchResponse, reader: jspb.BinaryReader): JoinMatchResponse;
}

export namespace JoinMatchResponse {
  export type AsObject = {
    matchId: string,
    status: MatchStatus,
  }
}

export class FindRankedMatchRequest extends jspb.Message {
  getPlayerId(): string;
  setPlayerId(value: string): FindRankedMatchRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): FindRankedMatchRequest.AsObject;
  static toObject(includeInstance: boolean, msg: FindRankedMatchRequest): FindRankedMatchRequest.AsObject;
  static serializeBinaryToWriter(message: FindRankedMatchRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): FindRankedMatchRequest;
  static deserializeBinaryFromReader(message: FindRankedMatchRequest, reader: jspb.BinaryReader): FindRankedMatchRequest;
}

export namespace FindRankedMatchRequest {
  export type AsObject = {
    playerId: string,
  }
}

export class FindRankedMatchResponse extends jspb.Message {
  getMatchId(): string;
  setMatchId(value: string): FindRankedMatchResponse;

  getStatus(): MatchStatus;
  setStatus(value: MatchStatus): FindRankedMatchResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): FindRankedMatchResponse.AsObject;
  static toObject(includeInstance: boolean, msg: FindRankedMatchResponse): FindRankedMatchResponse.AsObject;
  static serializeBinaryToWriter(message: FindRankedMatchResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): FindRankedMatchResponse;
  static deserializeBinaryFromReader(message: FindRankedMatchResponse, reader: jspb.BinaryReader): FindRankedMatchResponse;
}

export namespace FindRankedMatchResponse {
  export type AsObject = {
    matchId: string,
    status: MatchStatus,
  }
}

export class WatchMatchRequest extends jspb.Message {
  getMatchId(): string;
  setMatchId(value: string): WatchMatchRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): WatchMatchRequest.AsObject;
  static toObject(includeInstance: boolean, msg: WatchMatchRequest): WatchMatchRequest.AsObject;
  static serializeBinaryToWriter(message: WatchMatchRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): WatchMatchRequest;
  static deserializeBinaryFromReader(message: WatchMatchRequest, reader: jspb.BinaryReader): WatchMatchRequest;
}

export namespace WatchMatchRequest {
  export type AsObject = {
    matchId: string,
  }
}

export class PlayerAction extends jspb.Message {
  getReady(): ReadyAction | undefined;
  setReady(value?: ReadyAction): PlayerAction;
  hasReady(): boolean;
  clearReady(): PlayerAction;

  getBid(): BidAction | undefined;
  setBid(value?: BidAction): PlayerAction;
  hasBid(): boolean;
  clearBid(): PlayerAction;

  getPass(): PassAction | undefined;
  setPass(value?: PassAction): PlayerAction;
  hasPass(): boolean;
  clearPass(): PlayerAction;

  getActionCase(): PlayerAction.ActionCase;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PlayerAction.AsObject;
  static toObject(includeInstance: boolean, msg: PlayerAction): PlayerAction.AsObject;
  static serializeBinaryToWriter(message: PlayerAction, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PlayerAction;
  static deserializeBinaryFromReader(message: PlayerAction, reader: jspb.BinaryReader): PlayerAction;
}

export namespace PlayerAction {
  export type AsObject = {
    ready?: ReadyAction.AsObject,
    bid?: BidAction.AsObject,
    pass?: PassAction.AsObject,
  }

  export enum ActionCase { 
    ACTION_NOT_SET = 0,
    READY = 1,
    BID = 2,
    PASS = 3,
  }
}

export class ReadyAction extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ReadyAction.AsObject;
  static toObject(includeInstance: boolean, msg: ReadyAction): ReadyAction.AsObject;
  static serializeBinaryToWriter(message: ReadyAction, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ReadyAction;
  static deserializeBinaryFromReader(message: ReadyAction, reader: jspb.BinaryReader): ReadyAction;
}

export namespace ReadyAction {
  export type AsObject = {
  }
}

export class BidAction extends jspb.Message {
  getAmount(): number;
  setAmount(value: number): BidAction;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): BidAction.AsObject;
  static toObject(includeInstance: boolean, msg: BidAction): BidAction.AsObject;
  static serializeBinaryToWriter(message: BidAction, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): BidAction;
  static deserializeBinaryFromReader(message: BidAction, reader: jspb.BinaryReader): BidAction;
}

export namespace BidAction {
  export type AsObject = {
    amount: number,
  }
}

export class PassAction extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PassAction.AsObject;
  static toObject(includeInstance: boolean, msg: PassAction): PassAction.AsObject;
  static serializeBinaryToWriter(message: PassAction, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PassAction;
  static deserializeBinaryFromReader(message: PassAction, reader: jspb.BinaryReader): PassAction;
}

export namespace PassAction {
  export type AsObject = {
  }
}

export class GameEvent extends jspb.Message {
  getGameStarted(): GameStartedEvent | undefined;
  setGameStarted(value?: GameStartedEvent): GameEvent;
  hasGameStarted(): boolean;
  clearGameStarted(): GameEvent;

  getCardFlipped(): CardFlippedEvent | undefined;
  setCardFlipped(value?: CardFlippedEvent): GameEvent;
  hasCardFlipped(): boolean;
  clearCardFlipped(): GameEvent;

  getBidWindowOpen(): BidWindowOpenEvent | undefined;
  setBidWindowOpen(value?: BidWindowOpenEvent): GameEvent;
  hasBidWindowOpen(): boolean;
  clearBidWindowOpen(): GameEvent;

  getBidResolved(): BidResolvedEvent | undefined;
  setBidResolved(value?: BidResolvedEvent): GameEvent;
  hasBidResolved(): boolean;
  clearBidResolved(): GameEvent;

  getCardPassed(): CardPassedEvent | undefined;
  setCardPassed(value?: CardPassedEvent): GameEvent;
  hasCardPassed(): boolean;
  clearCardPassed(): GameEvent;

  getPityTriggered(): PityTriggeredEvent | undefined;
  setPityTriggered(value?: PityTriggeredEvent): GameEvent;
  hasPityTriggered(): boolean;
  clearPityTriggered(): GameEvent;

  getGameEnded(): GameEndedEvent | undefined;
  setGameEnded(value?: GameEndedEvent): GameEvent;
  hasGameEnded(): boolean;
  clearGameEnded(): GameEvent;

  getError(): ErrorEvent | undefined;
  setError(value?: ErrorEvent): GameEvent;
  hasError(): boolean;
  clearError(): GameEvent;

  getEventCase(): GameEvent.EventCase;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GameEvent.AsObject;
  static toObject(includeInstance: boolean, msg: GameEvent): GameEvent.AsObject;
  static serializeBinaryToWriter(message: GameEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GameEvent;
  static deserializeBinaryFromReader(message: GameEvent, reader: jspb.BinaryReader): GameEvent;
}

export namespace GameEvent {
  export type AsObject = {
    gameStarted?: GameStartedEvent.AsObject,
    cardFlipped?: CardFlippedEvent.AsObject,
    bidWindowOpen?: BidWindowOpenEvent.AsObject,
    bidResolved?: BidResolvedEvent.AsObject,
    cardPassed?: CardPassedEvent.AsObject,
    pityTriggered?: PityTriggeredEvent.AsObject,
    gameEnded?: GameEndedEvent.AsObject,
    error?: ErrorEvent.AsObject,
  }

  export enum EventCase { 
    EVENT_NOT_SET = 0,
    GAME_STARTED = 1,
    CARD_FLIPPED = 2,
    BID_WINDOW_OPEN = 3,
    BID_RESOLVED = 4,
    CARD_PASSED = 5,
    PITY_TRIGGERED = 6,
    GAME_ENDED = 7,
    ERROR = 8,
  }
}

export class GameStartedEvent extends jspb.Message {
  getMatchId(): string;
  setMatchId(value: string): GameStartedEvent;

  getBoardSize(): number;
  setBoardSize(value: number): GameStartedEvent;

  getYourCredits(): number;
  setYourCredits(value: number): GameStartedEvent;

  getRosterSize(): number;
  setRosterSize(value: number): GameStartedEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GameStartedEvent.AsObject;
  static toObject(includeInstance: boolean, msg: GameStartedEvent): GameStartedEvent.AsObject;
  static serializeBinaryToWriter(message: GameStartedEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GameStartedEvent;
  static deserializeBinaryFromReader(message: GameStartedEvent, reader: jspb.BinaryReader): GameStartedEvent;
}

export namespace GameStartedEvent {
  export type AsObject = {
    matchId: string,
    boardSize: number,
    yourCredits: number,
    rosterSize: number,
  }
}

export class CardFlippedEvent extends jspb.Message {
  getCardNumber(): number;
  setCardNumber(value: number): CardFlippedEvent;

  getCardsRemaining(): number;
  setCardsRemaining(value: number): CardFlippedEvent;

  getCard(): CardInfo | undefined;
  setCard(value?: CardInfo): CardFlippedEvent;
  hasCard(): boolean;
  clearCard(): CardFlippedEvent;

  getTier(): CardTier;
  setTier(value: CardTier): CardFlippedEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CardFlippedEvent.AsObject;
  static toObject(includeInstance: boolean, msg: CardFlippedEvent): CardFlippedEvent.AsObject;
  static serializeBinaryToWriter(message: CardFlippedEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CardFlippedEvent;
  static deserializeBinaryFromReader(message: CardFlippedEvent, reader: jspb.BinaryReader): CardFlippedEvent;
}

export namespace CardFlippedEvent {
  export type AsObject = {
    cardNumber: number,
    cardsRemaining: number,
    card?: CardInfo.AsObject,
    tier: CardTier,
  }
}

export class CardInfo extends jspb.Message {
  getPlayerId(): string;
  setPlayerId(value: string): CardInfo;

  getPlayerName(): string;
  setPlayerName(value: string): CardInfo;

  getSeason(): string;
  setSeason(value: string): CardInfo;

  getTeam(): string;
  setTeam(value: string): CardInfo;

  getPosition(): string;
  setPosition(value: string): CardInfo;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CardInfo.AsObject;
  static toObject(includeInstance: boolean, msg: CardInfo): CardInfo.AsObject;
  static serializeBinaryToWriter(message: CardInfo, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CardInfo;
  static deserializeBinaryFromReader(message: CardInfo, reader: jspb.BinaryReader): CardInfo;
}

export namespace CardInfo {
  export type AsObject = {
    playerId: string,
    playerName: string,
    season: string,
    team: string,
    position: string,
  }
}

export class BidWindowOpenEvent extends jspb.Message {
  getDurationSeconds(): number;
  setDurationSeconds(value: number): BidWindowOpenEvent;

  getYourMaxBid(): number;
  setYourMaxBid(value: number): BidWindowOpenEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): BidWindowOpenEvent.AsObject;
  static toObject(includeInstance: boolean, msg: BidWindowOpenEvent): BidWindowOpenEvent.AsObject;
  static serializeBinaryToWriter(message: BidWindowOpenEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): BidWindowOpenEvent;
  static deserializeBinaryFromReader(message: BidWindowOpenEvent, reader: jspb.BinaryReader): BidWindowOpenEvent;
}

export namespace BidWindowOpenEvent {
  export type AsObject = {
    durationSeconds: number,
    yourMaxBid: number,
  }
}

export class BidResolvedEvent extends jspb.Message {
  getYouWon(): boolean;
  setYouWon(value: boolean): BidResolvedEvent;

  getWinningBid(): number;
  setWinningBid(value: number): BidResolvedEvent;

  getYourBid(): number;
  setYourBid(value: number): BidResolvedEvent;

  getOpponentBid(): number;
  setOpponentBid(value: number): BidResolvedEvent;

  getRevealedStats(): CardStats | undefined;
  setRevealedStats(value?: CardStats): BidResolvedEvent;
  hasRevealedStats(): boolean;
  clearRevealedStats(): BidResolvedEvent;

  getYourCreditsRemaining(): number;
  setYourCreditsRemaining(value: number): BidResolvedEvent;

  getOpponentCreditsRemaining(): number;
  setOpponentCreditsRemaining(value: number): BidResolvedEvent;

  getYourPlayersDrafted(): number;
  setYourPlayersDrafted(value: number): BidResolvedEvent;

  getOpponentPlayersDrafted(): number;
  setOpponentPlayersDrafted(value: number): BidResolvedEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): BidResolvedEvent.AsObject;
  static toObject(includeInstance: boolean, msg: BidResolvedEvent): BidResolvedEvent.AsObject;
  static serializeBinaryToWriter(message: BidResolvedEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): BidResolvedEvent;
  static deserializeBinaryFromReader(message: BidResolvedEvent, reader: jspb.BinaryReader): BidResolvedEvent;
}

export namespace BidResolvedEvent {
  export type AsObject = {
    youWon: boolean,
    winningBid: number,
    yourBid: number,
    opponentBid: number,
    revealedStats?: CardStats.AsObject,
    yourCreditsRemaining: number,
    opponentCreditsRemaining: number,
    yourPlayersDrafted: number,
    opponentPlayersDrafted: number,
  }
}

export class CardStats extends jspb.Message {
  getPlayerId(): string;
  setPlayerId(value: string): CardStats;

  getPlayerName(): string;
  setPlayerName(value: string): CardStats;

  getSeason(): string;
  setSeason(value: string): CardStats;

  getTeam(): string;
  setTeam(value: string): CardStats;

  getPosition(): string;
  setPosition(value: string): CardStats;

  getLakerScore(): number;
  setLakerScore(value: number): CardStats;

  getRapm(): number;
  setRapm(value: number): CardStats;

  getRapmOffense(): number;
  setRapmOffense(value: number): CardStats;

  getRapmDefense(): number;
  setRapmDefense(value: number): CardStats;

  getWar(): number;
  setWar(value: number): CardStats;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CardStats.AsObject;
  static toObject(includeInstance: boolean, msg: CardStats): CardStats.AsObject;
  static serializeBinaryToWriter(message: CardStats, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CardStats;
  static deserializeBinaryFromReader(message: CardStats, reader: jspb.BinaryReader): CardStats;
}

export namespace CardStats {
  export type AsObject = {
    playerId: string,
    playerName: string,
    season: string,
    team: string,
    position: string,
    lakerScore: number,
    rapm: number,
    rapmOffense: number,
    rapmDefense: number,
    war: number,
  }
}

export class CardPassedEvent extends jspb.Message {
  getConsecutivePasses(): number;
  setConsecutivePasses(value: number): CardPassedEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CardPassedEvent.AsObject;
  static toObject(includeInstance: boolean, msg: CardPassedEvent): CardPassedEvent.AsObject;
  static serializeBinaryToWriter(message: CardPassedEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CardPassedEvent;
  static deserializeBinaryFromReader(message: CardPassedEvent, reader: jspb.BinaryReader): CardPassedEvent;
}

export namespace CardPassedEvent {
  export type AsObject = {
    consecutivePasses: number,
  }
}

export class PityTriggeredEvent extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PityTriggeredEvent.AsObject;
  static toObject(includeInstance: boolean, msg: PityTriggeredEvent): PityTriggeredEvent.AsObject;
  static serializeBinaryToWriter(message: PityTriggeredEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PityTriggeredEvent;
  static deserializeBinaryFromReader(message: PityTriggeredEvent, reader: jspb.BinaryReader): PityTriggeredEvent;
}

export namespace PityTriggeredEvent {
  export type AsObject = {
  }
}

export class GameEndedEvent extends jspb.Message {
  getResult(): GameResult;
  setResult(value: GameResult): GameEndedEvent;

  getYourLineup(): Lineup | undefined;
  setYourLineup(value?: Lineup): GameEndedEvent;
  hasYourLineup(): boolean;
  clearYourLineup(): GameEndedEvent;

  getOpponentLineup(): Lineup | undefined;
  setOpponentLineup(value?: Lineup): GameEndedEvent;
  hasOpponentLineup(): boolean;
  clearOpponentLineup(): GameEndedEvent;

  getYourScore(): number;
  setYourScore(value: number): GameEndedEvent;

  getOpponentScore(): number;
  setOpponentScore(value: number): GameEndedEvent;

  getEloChange(): number;
  setEloChange(value: number): GameEndedEvent;

  getByForfeit(): boolean;
  setByForfeit(value: boolean): GameEndedEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GameEndedEvent.AsObject;
  static toObject(includeInstance: boolean, msg: GameEndedEvent): GameEndedEvent.AsObject;
  static serializeBinaryToWriter(message: GameEndedEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GameEndedEvent;
  static deserializeBinaryFromReader(message: GameEndedEvent, reader: jspb.BinaryReader): GameEndedEvent;
}

export namespace GameEndedEvent {
  export type AsObject = {
    result: GameResult,
    yourLineup?: Lineup.AsObject,
    opponentLineup?: Lineup.AsObject,
    yourScore: number,
    opponentScore: number,
    eloChange: number,
    byForfeit: boolean,
  }
}

export class Lineup extends jspb.Message {
  getPlayersList(): Array<CardStats>;
  setPlayersList(value: Array<CardStats>): Lineup;
  clearPlayersList(): Lineup;
  addPlayers(value?: CardStats, index?: number): CardStats;

  getImpactScore(): number;
  setImpactScore(value: number): Lineup;

  getBonus(): number;
  setBonus(value: number): Lineup;

  getTotalScore(): number;
  setTotalScore(value: number): Lineup;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Lineup.AsObject;
  static toObject(includeInstance: boolean, msg: Lineup): Lineup.AsObject;
  static serializeBinaryToWriter(message: Lineup, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Lineup;
  static deserializeBinaryFromReader(message: Lineup, reader: jspb.BinaryReader): Lineup;
}

export namespace Lineup {
  export type AsObject = {
    playersList: Array<CardStats.AsObject>,
    impactScore: number,
    bonus: number,
    totalScore: number,
  }
}

export class ErrorEvent extends jspb.Message {
  getCode(): string;
  setCode(value: string): ErrorEvent;

  getMessage(): string;
  setMessage(value: string): ErrorEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ErrorEvent.AsObject;
  static toObject(includeInstance: boolean, msg: ErrorEvent): ErrorEvent.AsObject;
  static serializeBinaryToWriter(message: ErrorEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ErrorEvent;
  static deserializeBinaryFromReader(message: ErrorEvent, reader: jspb.BinaryReader): ErrorEvent;
}

export namespace ErrorEvent {
  export type AsObject = {
    code: string,
    message: string,
  }
}

export enum MatchMode { 
  MATCH_MODE_UNSPECIFIED = 0,
  MATCH_MODE_RANKED = 1,
  MATCH_MODE_CHALLENGE = 2,
}
export enum MatchStatus { 
  MATCH_STATUS_UNSPECIFIED = 0,
  MATCH_STATUS_WAITING = 1,
  MATCH_STATUS_READY = 2,
  MATCH_STATUS_IN_PROGRESS = 3,
  MATCH_STATUS_COMPLETE = 4,
}
export enum CardTier { 
  CARD_TIER_UNSPECIFIED = 0,
  CARD_TIER_S = 1,
  CARD_TIER_A = 2,
  CARD_TIER_B = 3,
  CARD_TIER_C = 4,
}
export enum GameResult { 
  GAME_RESULT_UNSPECIFIED = 0,
  GAME_RESULT_WIN = 1,
  GAME_RESULT_LOSS = 2,
  GAME_RESULT_TIE = 3,
}
