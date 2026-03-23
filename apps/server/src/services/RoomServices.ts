import { GAME_STATE_ENUM, type DIFFICULTY_ENUM, type Player, type Room } from '@doodle/types';
import { redis_instance } from '../singleton/redis.singleton';
import { keys, TTL } from '../consts/redis.keys';
import { room_schema } from '../schemas/create_room_schema';
import SessionService from './SessionServices';

export default class RoomServices {
    static async create(input: {
        roomId: string;
        hostId: string;
        maxPlayers: number;
        totalRounds: number;
        roundDuration: number;
        difficulty: DIFFICULTY_ENUM;
    }) {
        await redis_instance
            .pipeline()
            .hset(keys.room(input.roomId), {
                id: input.roomId,
                hostId: input.hostId,
                status: GAME_STATE_ENUM.WAITING,
                currentDrawer: '',
                currentWord: '',
                currentRound: 0,
                totalRounds: input.totalRounds,
                maxPlayers: input.maxPlayers,
                roundDuration: input.roundDuration,
                roundEndsAt: 0,
                drawerTimeoutEndsAt: 0,
                guessedPlayers: '',
                difficulty: input.difficulty,
                createdAt: Date.now(),
            })
            .expire(keys.room(input.roomId), TTL.ROOM)
            .exec();
    }

    static async get(roomId: string) {
        const raw = await redis_instance.hgetall(keys.room(roomId));
        const { data, success } = room_schema.safeParse(raw);
        if (success) return data;
    }

    static async exists(roomId: string) {
        return await redis_instance.exists(keys.room(roomId));
    }

    static async delete(roomId: string) {
        await redis_instance.del(
            keys.room(roomId),
            keys.roomPlayers(roomId),
            keys.roomHistory(roomId),
            keys.roomScores(roomId),
        );
    }

    static async addPlayer(roomId: string, sessionId: string) {
        await redis_instance
            .pipeline()
            .sadd(keys.roomPlayers(roomId), sessionId)
            .zadd(keys.roomScores(roomId), 'NX', 0, sessionId)
            .exec();
    }

    static async removePlayer(roomId: string, sessionId: string) {
        await redis_instance
            .pipeline()
            .srem(keys.roomPlayers(roomId), sessionId)
            .zrem(keys.roomScores(roomId), sessionId)
            .exec();
    }

    static async getPlayerIds(roomId: string) {
        return redis_instance.smembers(keys.roomPlayers(roomId));
    }

    static async getPlayerCount(roomId: string) {
        return redis_instance.scard(keys.roomPlayers(roomId));
    }

    static async incrementScore(roomId: string, sessionId: string, points: number) {
        const score = await redis_instance.zincrby(keys.roomScores(roomId), points, sessionId);
        return Number(score);
    }

    static async getLeaderboard(roomId: string) {
        const raw = await redis_instance.zrevrangebyscore(
            keys.roomScores(roomId),
            '+inf',
            '-inf',
            'WITHSCORES',
        );
        const result: Array<{ sessionId: string; score: number }> = [];
        for (let i = 0; i < raw.length; i += 2) {
            const sessionId = raw[i];
            const score = raw[i + 1];
            if (!sessionId || !score) continue;
            result.push({ sessionId, score: Number(score) });
        }
        return result;
    }

    static async addGuessedPlayer(roomId: string, sessionId: string) {
        const room = await RoomServices.get(roomId);
        if (!room) return;
        const current = room.guessedPlayers ?? [];
        await redis_instance.hset(
            keys.room(roomId),
            'guessedPlayers',
            [...current, sessionId].join(','),
        );
    }

    static async setWordOptions(roomId: string, words: string[]) {
        await redis_instance.set(keys.roomWordOptions(roomId), JSON.stringify(words), 'EX', 30);
    }

    static async getWordOptions(roomId: string): Promise<string[] | null> {
        const raw = await redis_instance.get(keys.roomWordOptions(roomId));
        return raw ? (JSON.parse(raw) as string[]) : null;
    }

    static async startRound(
        roomId: string,
        opts: {
            drawerId: string;
            word: string;
            roundNumber: number;
            roundDuration: number;
        },
    ) {
        const roundEndsAt = Date.now() + opts.roundDuration * 1000;
        await redis_instance.hset(keys.room(roomId), {
            status: GAME_STATE_ENUM.DRAWING,
            currentDrawer: opts.drawerId,
            currentWord: opts.word,
            currentRound: opts.roundNumber,
            roundEndsAt,
            drawerTimeoutEndsAt: 0,
            guessedPlayers: '',
        });
        return roundEndsAt;
    }

    static async setDrawerTimeout(roomId: string, sessionId: string) {
        const drawerTimeoutEndsAt = Date.now() + 10000;
        await redis_instance.hset(keys.room(roomId), { drawerTimeoutEndsAt });
        return drawerTimeoutEndsAt;
    }

    static async clearDrawerTimeout(roomId: string) {
        await redis_instance.hset(keys.room(roomId), 'drawerTimeoutEndsAt', 0);
    }

    static async updateStatus(roomId: string, status: GAME_STATE_ENUM) {
        await redis_instance.hset(keys.room(roomId), 'status', status);
    }

    static async getCurrentWord(roomId: string) {
        return redis_instance.hget(keys.room(roomId), 'currentWord');
    }

    static async transferHost(roomId: string, newHostId: string) {
        await redis_instance.hset(keys.room(roomId), 'hostId', newHostId);
    }

    static async pushStroke(roomId: string, stroke: unknown) {
        await redis_instance.rpush(keys.roomHistory(roomId), JSON.stringify(stroke));
    }

    static async getHistory(roomId: string) {
        const raw = await redis_instance.lrange(keys.roomHistory(roomId), 0, -1);
        return raw.map((s) => JSON.parse(s));
    }

    static async clearHistory(roomId: string) {
        await redis_instance.del(keys.roomHistory(roomId));
    }

    static async removeHistory(roomId: string, strokeId: string) {
        const all = await redis_instance.lrange(keys.roomHistory(roomId), 0, -1);
        const filtered = all.filter((s) => {
            try {
                return (JSON.parse(s) as { id: string }).id !== strokeId;
            } catch {
                return true;
            }
        });
        await redis_instance
            .pipeline()
            .del(keys.roomHistory(roomId))
            .rpush(keys.roomHistory(roomId), ...filtered)
            .exec();
    }

    static async buildSnapshot(roomId: string): Promise<Room | null> {
        const hash = await RoomServices.get(roomId);
        if (!hash) return null;

        const playerIds = await RoomServices.getPlayerIds(roomId);
        const scores = await RoomServices.getLeaderboard(roomId);
        const history = await RoomServices.getHistory(roomId);
        const scoreMap = new Map(scores.map((s) => [s.sessionId, s.score]));

        const players: Player[] = await Promise.all(
            playerIds.map(async (sid) => {
                const session = await SessionService.get(sid);
                return {
                    sessionId: sid,
                    username: session?.username ?? '',
                    score: scoreMap.get(sid) ?? 0,
                    isHost: hash.hostId === sid,
                    hasGuessed: (hash.guessedPlayers ?? []).includes(sid),
                    isConnected: session?.isConnected === true,
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
            guessedPlayers: hash.guessedPlayers ?? [],
            players,
            gameState: {
                state: hash.status,
                currentDrawer: hash.currentDrawer || undefined,
                currentRound: hash.currentRound,
                totalRounds: hash.totalRounds,
                roundDuration: hash.roundDuration,
                roundEndsAt: hash.roundEndsAt || undefined,
            },
        };
    }
}
