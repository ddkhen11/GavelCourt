"""
Auto-play test client. Usage: python scripts/test_client.py <username>
Registers, finds ranked match, plays to completion, prints all events.
"""
import sys, os, asyncio, random
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "gen"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

import grpc
import duel_pb2 as pb
import duel_pb2_grpc as pb_grpc

SERVER = "localhost:50051"

async def main(username):
    async with grpc.aio.insecure_channel(SERVER) as ch:
        stub = pb_grpc.DuelServiceStub(ch)

        reg = await stub.RegisterPlayer(pb.RegisterPlayerRequest(username=username))
        pid, tok = reg.player_id, reg.auth_token
        print(f"[{username}] registered {pid[:8]}", flush=True)

        meta = (("player-id", pid), ("auth-token", tok))
        print(f"[{username}] waiting for match...", flush=True)
        ranked = await stub.FindRankedMatch(
            pb.FindRankedMatchRequest(player_id=pid), metadata=meta
        )
        print(f"[{username}] paired match={ranked.match_id[:8]}", flush=True)

        action_q = asyncio.Queue()
        done = asyncio.Event()

        async def actions():
            yield pb.PlayerAction(ready=pb.ReadyAction())
            while True:
                a = await action_q.get()
                if a is None:
                    return
                yield a

        async def play():
            async for ev in stub.StreamDuel(actions(), metadata=meta):
                w = ev.WhichOneof("event")

                if w == "game_started":
                    e = ev.game_started
                    print(f"[{username}] GAME_STARTED board={e.board_size} credits={e.your_credits}", flush=True)

                elif w == "pity_triggered":
                    print(f"[{username}] PITY_TRIGGERED", flush=True)

                elif w == "card_flipped":
                    e = ev.card_flipped
                    print(f"[{username}] CARD #{e.card_number} {e.card.player_name} {e.card.season} {e.card.position} tier={pb.CardTier.Name(e.tier)} left={e.cards_remaining}", flush=True)

                elif w == "bid_window_open":
                    e = ev.bid_window_open
                    if e.your_max_bid == 0:
                        bid = 0
                    elif random.random() < 0.25:
                        bid = 0  # pass 25% of time
                    else:
                        bid = random.randint(1, min(e.your_max_bid, 15))
                    print(f"[{username}]   → bid={bid} (max={e.your_max_bid})", flush=True)
                    await action_q.put(pb.PlayerAction(bid=pb.BidAction(amount=bid)))

                elif w == "bid_resolved":
                    e = ev.bid_resolved
                    print(f"[{username}] RESOLVED {'WON' if e.you_won else 'lost'} winning={e.winning_bid} you={e.your_bid} opp={e.opponent_bid} player={e.revealed_stats.player_name} credits={e.your_credits_remaining} roster={e.your_players_drafted}/5", flush=True)

                elif w == "card_passed":
                    print(f"[{username}] PASSED consecutive={ev.card_passed.consecutive_passes}", flush=True)

                elif w == "error":
                    print(f"[{username}] ERROR {ev.error.code}: {ev.error.message}", flush=True)

                elif w == "game_ended":
                    e = ev.game_ended
                    print(f"[{username}] ══ GAME ENDED {pb.GameResult.Name(e.result)} score={e.your_score:.1f} opp={e.opponent_score:.1f} elo={e.elo_change:+d} forfeit={e.by_forfeit}", flush=True)
                    for p in e.your_lineup.players:
                        print(f"[{username}]   {p.player_name} {p.season} {p.position} laker={p.laker_score:.1f}", flush=True)
                    done.set()
                    await action_q.put(None)
                    return

        await play()
        await done.wait()
        print(f"[{username}] EXIT OK", flush=True)

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "player1"))
