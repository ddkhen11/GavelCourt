from constants import ELO_K


def expected_score(rating_a: int, rating_b: int) -> float:
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def elo_change(
    winner_rating: int, loser_rating: int, k: int = ELO_K
) -> tuple[int, int]:
    dw = round(k * (1 - expected_score(winner_rating, loser_rating)))
    dl = round(k * (0 - expected_score(loser_rating, winner_rating)))
    return dw, dl  # (winner_delta >= 0, loser_delta <= 0)


def elo_change_tie(rating_a: int, rating_b: int, k: int = ELO_K) -> tuple[int, int]:
    da = round(k * (0.5 - expected_score(rating_a, rating_b)))
    db = round(k * (0.5 - expected_score(rating_b, rating_a)))
    return da, db
