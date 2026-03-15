import { redis } from "bun";
import { keys } from "../consts/redis.keys";
import { redis_instance } from "../singleton/redis.singleton";
import type { SessionData } from "../types/session.types";

// add zpd here to parse sessionData

export default class SessionService {
    static async create(data: SessionData): Promise<void> {
        await redis_instance.hset(keys.session(data.sessionId), {
            ...data,
            isConnected: 'true',
        });
    }

    static async get(sessionId: string) {
        const raw = await redis_instance.hgetall(keys.session(sessionId));
        return raw;
    }

    static async exists(sessionId: string): Promise<boolean> {
        return await redis.exists(keys.session(sessionId));
    }

    static async markDisconnected(sessionId: string): Promise<void> {
        await redis_instance
            .pipeline()
            .hset(keys.session(sessionId), 'isConnected', 'false')
            .persist(keys.session(sessionId))
            .exec();
    }

    static async markReconnected(sessionId: string): Promise<void> {
        await redis_instance
            .pipeline()
            .hset(keys.session(sessionId), 'isConnected', 'true')
            .persist(keys.session(sessionId))
            .exec();
    }

    static async delete(sessionId: string): Promise<void> {
        await redis_instance.del(keys.session(sessionId));
    }
}