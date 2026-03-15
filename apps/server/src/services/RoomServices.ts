import { GAME_STATE_ENUM, type DIFFICULTY_ENUM } from "@doodle/types";
import { redis_instance } from "../singleton/redis.singleton";
import { keys, TTL } from "../consts/redis.keys";
import { room_schema } from "../schemas/create_room_schema";

export default class RoomServices {

    static async create(input: {
        roomId: string,
        hostId: string,
        maxPlayers: number,
        totalRounds: number,
        roundDuration: number,
        difficulty: DIFFICULTY_ENUM,
    }) {
        await redis_instance
            .pipeline()
            .hset(keys.room(input.roomId), {
                id: input.roomId,
                hostId: input.hostId,
                status: GAME_STATE_ENUM.WAITING,
                currentDrawer: "",
                currentWord: "",
                currentRound: 0,
                totalRounds: input.totalRounds,
                maxPlayers: input.maxPlayers,
                roundDuration: input.roundDuration,
                roundEndsAt: 0,
                drawerTimeoutEndsAt: 0,
                difficulty: input.difficulty,
                createdAt: Date.now(),
            })
            .expire(keys.room(input.roomId), TTL.ROOM)
            .exec();
    }

    static async get(roomId: string) {
        const raw = await redis_instance.hgetall(keys.room(roomId));
        const { data, success} = room_schema.safeParse(raw);
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

    static async addPlauyer(roomId: string, sessionId: string) {
        await redis_instance
            .pipeline()
            .sadd(keys.roomPlayers(roomId), sessionId)
            .zadd(keys.roomScores(roomId), 'NX', 0, sessionId) // nx -> dont overwrite if exists
            .exec()
    }

    static async removePlayer(roomId: string, sessionid: string) {
        await redis_instance
            .pipeline()
            .srem(keys.room(roomId), sessionid)
            .zrem(keys.roomScores(roomId), sessionid)
            .exec();
    }

    static async getPlayerIds(roomId: string) {
        return redis_instance.smembers(keys.roomPlayers(roomId));
    }

    static async getPlayerCount(roomId: string) {
        return redis_instance.scard(keys.roomPlayers(roomId));
    }

    static async incrementScore() {}

}