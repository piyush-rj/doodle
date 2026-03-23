// Event format stored in the ZSET:
//   "round:{roomId}"          → fires when the round timer expires
//   "drawer:{sessionId}:{roomId}" → fires when the drawer reconnect window expires
//
// Score = epoch ms when the event is due.
// The poll loop calls getdue() every second and processes whatever comes back.

import { keys } from '../consts/redis.keys';
import { redis_instance } from '../singleton/redis.singleton';

export type ScheduledEvent =
    | { type: 'round'; roomId: string }
    | { type: 'drawer'; sessionId: string; roomId: string };

const encode = (event: ScheduledEvent): string => {
    if (event.type === 'round') return `round:${event.roomId}`;
    return `drawer:${event.sessionId}:${event.roomId}`;
};

const decode = (raw: string): ScheduledEvent | null => {
    const parts = raw.split(':');
    if (parts[0] === 'round' && parts.length === 2) return { type: 'round', roomId: parts[1]! };
    if (parts[0] === 'drawer' && parts.length === 3)
        return { type: 'drawer', sessionId: parts[1]!, roomId: parts[2]! };
    return null;
};

const SchedulerService = {
    async schedule(event: ScheduledEvent, fireAt: number): Promise<void> {
        await redis_instance.zadd(keys.scheduled, fireAt, encode(event));
    },

    async cancel(event: ScheduledEvent): Promise<void> {
        await redis_instance.zrem(keys.scheduled, encode(event));
    },

    // Returns all events due right now and removes them from the ZSET atomically.
    // Called by the poll loop every second — 2 Redis calls regardless of room count.
    async getDue(): Promise<ScheduledEvent[]> {
        const now = Date.now();
        const raw = await redis_instance.zrangebyscore(keys.scheduled, 0, now);
        if (raw.length === 0) return [];

        await redis_instance.zrem(keys.scheduled, ...raw);
        return raw.map(decode).filter(Boolean) as ScheduledEvent[];
    },
};

export default SchedulerService;
