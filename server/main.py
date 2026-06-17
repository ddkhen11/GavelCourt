import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "gen"))
import grpc
from grpc_reflection.v1alpha import reflection
import duel_pb2 as pb
import duel_pb2_grpc as pb_grpc

import db as database
import loader
import matchmaking
from session import PlayerSeason

GRPC_PORT = 50051
GAME_DB_PATH = "server/data/game.db"


async def _load_tier_pools(game_db) -> dict[str, list]:
    rows = await game_db.execute_fetchall("SELECT * FROM player_seasons")
    pools: dict[str, list] = {"S": [], "A": [], "B": [], "C": []}
    for r in rows:
        d = dict(r)
        ps = PlayerSeason(**{k: d[k] for k in PlayerSeason.__dataclass_fields__})
        pools[ps.tier].append(ps)
    return pools


async def serve() -> None:
    # Init DB and load player data
    game_db = await database.init_db(GAME_DB_PATH)
    upserted = await loader.load_player_seasons(game_db)
    pools = await _load_tier_pools(game_db)
    matchmaking.set_tier_pools(pools)
    total = sum(len(v) for v in pools.values())
    print(
        f"Loaded {upserted} player-seasons ({total} qualifying), tiers: "
        f"S={len(pools['S'])} A={len(pools['A'])} B={len(pools['B'])} C={len(pools['C'])}"
    )

    # gRPC server
    server = grpc.aio.server()
    from servicer import DuelServiceImpl

    pb_grpc.add_DuelServiceServicer_to_server(DuelServiceImpl(), server)

    # Server reflection
    service_names = (
        pb.DESCRIPTOR.services_by_name["DuelService"].full_name,
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(service_names, server)

    listen_addr = f"[::]:{GRPC_PORT}"
    server.add_insecure_port(listen_addr)
    await server.start()
    print(f"gRPC server listening on {listen_addr}")
    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())
