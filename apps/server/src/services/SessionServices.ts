import type { Player } from '@doodle/types';
import { keys, TTL } from '../consts/redis.keys';
import { redis_instance } from '../singleton/redis.singleton';
import RoomServices from './RoomServices';

export interface SessionData {
    sessionId: string;
    username: string;
    roomId: string;
    isConnected: boolean;
}

export default class SessionService {
    static async create(data: SessionData): Promise<void> {
        await redis_instance.hset(keys.session(data.sessionId), {
            sessionId: data.sessionId,
            username: data.username,
            roomId: data.roomId,
            isConnected: 'true',
        });
    }

    static async get(sessionId: string): Promise<SessionData | null> {
        const raw = await redis_instance.hgetall(keys.session(sessionId));
        if (!raw?.sessionId) return null;

        return {
            sessionId: raw.sessionId,
            username: raw.username!,
            roomId: raw.roomId!,
            isConnected: raw.isConnected === 'true',
        };
    }

    static async exists(sessionId: string): Promise<boolean> {
        return (await redis_instance.exists(keys.session(sessionId))) === 1;
    }

    static async markDisconnected(sessionId: string): Promise<void> {
        await redis_instance
            .pipeline()
            .hset(keys.session(sessionId), 'isConnected', 'false')
            .expire(keys.session(sessionId), TTL.SESSION) // start 10 min countdown
            .exec();
    }

    static async markReconnected(sessionId: string): Promise<void> {
        await redis_instance
            .pipeline()
            .hset(keys.session(sessionId), 'isConnected', 'true')
            .persist(keys.session(sessionId)) // remove TTL so it doesn't expire
            .exec();
    }

    static async delete(sessionId: string): Promise<void> {
        await redis_instance.del(keys.session(sessionId));
    }

    static async buildSnapshot(roomId: string) {
        const hash = await RoomServices.get(roomId);
        if (!hash) return null;

        const playerIds = await RoomServices.getPlayerIds(roomId);
        const scores = await RoomServices.getLeaderboard(roomId);
        const history = await RoomServices.getHistory(roomId);
        const scoreMap = new Map(scores.map((s) => [s.sessionId, s.score]));

        const players: Player[] = await Promise.all(
            playerIds.map(async (sid) => {
                const session = await this.get(sid);
                return {
                    sessionId: sid,
                    username: session?.username!,
                    score: scoreMap.get(sid) ?? 0,
                    isHost: hash.hostId === sid,
                    hasGuessed: false,
                    isConnected: session?.isConnected ?? false,
                };
            }),
        );

        return {
            id: hash.id,
            hostId: hash.hostId,
            maxPlayers: hash.maxPlayers,
            maxRounds: hash.totalRounds,
            difficulty: hash.difficulty,
            createdAt: hash.createdAt,
            drawingHistory: history,
            guessedPlayers: [],
            players,
            gameState: {
                state: hash.status,
                currentDrawer: hash.currentDrawer || undefined,
                currentRound: hash.currentRound,
                totalRounds: hash.totalRounds,
                roundEndsAt: hash.roundEndsAt || undefined,
                roundDuration: hash.roundDuration,
            },
        };
    }
}
