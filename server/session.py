from dataclasses import dataclass, field
from asyncio import Task
from enum import Enum
from constants import STARTING_CREDITS, ROSTER_SIZE


@dataclass
class PlayerSeason:
    player_id: str
    player_name: str
    season: str
    team: str
    position: str  # PG | SG | SF | PF | C
    laker_score: float
    rapm: float
    rapm_offense: float
    rapm_defense: float
    war: float
    tier: str  # S | A | B | C


class Phase(Enum):
    WAITING = "WAITING"  # waiting for both players to connect and send Ready
    BID_WINDOW = "BID_WINDOW"  # bid window open; only here are bids/passes accepted
    RESOLVING = "RESOLVING"  # bids collected, computing result
    GAME_OVER = "GAME_OVER"


@dataclass
class PlayerState:
    player_id: str
    credits: int = STARTING_CREDITS
    lineup: list = field(default_factory=list)  # list of PlayerSeason
    disconnected: bool = False  # set if the stream drops mid-match

    def is_full(self) -> bool:
        return len(self.lineup) >= ROSTER_SIZE

    def empty_slots(self) -> int:
        return ROSTER_SIZE - len(self.lineup)

    def max_bid(self) -> int:
        # Reserve rule: keep >= 1 credit per remaining slot after this one.
        # A full roster can't bid at all (the raw formula would say credits+1).
        if self.is_full():
            return 0
        return max(0, self.credits - (self.empty_slots() - 1))


@dataclass
class GameSession:
    match_id: str
    board: list = field(default_factory=list)  # ordered PlayerSeason list
    pity_pool: list = field(default_factory=list)  # S+A cards NOT on the board
    board_index: int = 0
    phase: Phase = Phase.WAITING
    players: dict = field(default_factory=dict)  # player_id -> PlayerState
    consecutive_passes: int = 0
    game_loop_started: bool = False
    # Per-player queues (NOT one shared action queue — see SPEC "Game loop" rationale)
    action_queues: dict = field(
        default_factory=dict
    )  # player_id -> Queue[PlayerAction]
    event_queues: dict = field(default_factory=dict)  # player_id -> Queue[GameEvent]
    spectator_queues: dict = field(
        default_factory=dict
    )  # spectator_id -> Queue[GameEvent]
    # Keep strong refs to spawned tasks so they are not garbage-collected.
    reader_tasks: dict = field(default_factory=dict)  # player_id -> Task
    loop_task: "Task | None" = None

    def current_card(self):
        return (
            self.board[self.board_index] if self.board_index < len(self.board) else None
        )

    def cards_remaining(self):
        return len(self.board) - self.board_index

    def both_full(self):
        return all(p.is_full() for p in self.players.values())
