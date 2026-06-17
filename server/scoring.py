from collections import Counter


def score_lineup(lineup: list) -> tuple[float, float, float]:
    """Returns (impact_score, bonus, total_score)."""
    impact = sum(p.laker_score for p in lineup)
    bonus = calculate_bonus(lineup)
    return impact, bonus, impact + bonus


def calculate_bonus(lineup: list) -> float:
    bonus = 0.0
    positions = [p.position for p in lineup]

    # +3 for all 5 positions represented (PG, SG, SF, PF, C)
    if len(set(positions)) == 5:
        bonus += 3.0
    # +2 for balance: no position duplicated
    if positions and max(Counter(positions).values()) <= 1:
        bonus += 2.0
    # +4 for lockdown: at least one player with rapm_defense > 2.5
    if any(p.rapm_defense > 2.5 for p in lineup):
        bonus += 4.0
    return bonus
