import Redis from 'ioredis';

const createRedisClient = () => {
    return new Redis(process.env.REDIS_URL!);
};

export const redis_instance = createRedisClient();
export const publisher_instance = createRedisClient();
export const subscriber_instance = createRedisClient();
