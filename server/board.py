import random
from constants import BOARD_SIZE, BOARD_FILL_WEIGHTS


class BoardBuilder:
    def build(self, tier_pools: dict[str, list]) -> tuple[list, list]:
        """
        Returns (board, pity_pool).
        board     = ordered list of ~BOARD_SIZE PlayerSeason objects for one match.
        pity_pool = all S and A cards NOT placed on the board.
        tier_pools = {"S": [...], "A": [...], "B": [...], "C": [...]}
        """
        # Step 1: guaranteed minimums (sample without replacement)
        board = []
        board += random.sample(tier_pools["S"], min(1, len(tier_pools["S"])))
        board += random.sample(tier_pools["A"], min(2, len(tier_pools["A"])))
        used_ids = {p.player_id for p in board}

        # Step 2: probabilistic fill to reach BOARD_SIZE
        available = {
            tier: [p for p in pool if p.player_id not in used_ids]
            for tier, pool in tier_pools.items()
        }
        weights = BOARD_FILL_WEIGHTS
        while len(board) < BOARD_SIZE and any(available.values()):
            tier = random.choices(list(weights), weights=list(weights.values()))[0]
            if not available[tier]:
                continue
            pick = random.choice(available[tier])
            board.append(pick)
            available[tier].remove(pick)
            used_ids.add(pick.player_id)

        # Step 3: shuffle with constraints (up to 100 attempts)
        for _ in range(100):
            random.shuffle(board)
            if self._constraints_pass(board):
                break

        # Pity pool: every S/A card not on the board
        pity_pool = [p for tier in ("S", "A") for p in available[tier]]
        return board, pity_pool

    def _constraints_pass(self, board) -> bool:
        # Constraint A: no more than 2 consecutive C-tier cards
        consecutive_c = 0
        for card in board:
            if card.tier == "C":
                consecutive_c += 1
                if consecutive_c > 2:
                    return False
            else:
                consecutive_c = 0
        # Constraint B: at least 1 S/A card in the first 5 positions
        if not any(c.tier in ("S", "A") for c in board[:5]):
            return False
        return True
