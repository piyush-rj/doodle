import Redis from 'ioredis';

export default class RedisService {
    private redis: Redis;

    constructor() {
        this.redis = new Redis(process.env.REDIS_URL!);
    }

    async registerRoom(roomId: string, serverId: string) {
        await this.redis.set(`room:${roomId}`, serverId);
    }

    async getRoomServer(roomId: string): Promise<string | null> {
        return this.redis.get(`room:${roomId}`);
    }

    async removeRoom(roomId: string) {
        await this.redis.del(`room:${roomId}`);
    }
}
