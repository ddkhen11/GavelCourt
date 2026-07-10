STARTING_CREDITS = 100
ROSTER_SIZE = 5
BOARD_SIZE = 20
BID_WINDOW_SECONDS = 10
PITY_THRESHOLD = 2  # consecutive passes that trigger a pity card
LAKER_FLOOR = 3.5
MIN_BID = 1  # smallest winning bid; amount 0 == pass

TIER_THRESHOLDS = {"S": 9.0, "A": 7.0, "B": 5.0, "C": 3.5}  # lower bounds
BOARD_FILL_WEIGHTS = {"S": 0.08, "A": 0.22, "B": 0.42, "C": 0.28}
ELO_K = 32
STARTING_ELO = 1000
PENDING_CHALLENGE_TTL_SECONDS = 3600  # unjoined challenges expire after an hour
LEADERBOARD_DEFAULT_LIMIT = 20  # rows returned when the client sends limit=0
LEADERBOARD_MAX_LIMIT = 100  # hard cap on client-supplied limits
