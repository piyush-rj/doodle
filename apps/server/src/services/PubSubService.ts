import type { ServerEvent } from '@doodle/types';
import { publisher_instance, subscriber_instance } from '../singleton/redis.singleton';
import { keys } from '../consts/redis.keys';
import SocketRegistry from '../socket/socket.registry';

export default class PubSubService {
    // forwards all pubsub messages to local sockets
    static init() {
        subscriber_instance.on('message', (channel, raw) => {
            const match = channel.match(/^pubsub:room:(.+)$/);
            if (!match) return;
            const roomId = match[1];
            const event = JSON.parse(raw) as ServerEvent;

            for (const [sessionId, ws] of SocketRegistry.all()) {
                if (ws.roomId === roomId) ws.send(JSON.stringify(event));
            }
        });
    }

    static async publish(roomId: string, event: ServerEvent) {
        await publisher_instance.publish(keys.roomChannel(roomId), JSON.stringify(event));
    }

    static async subscribe(roomId: string) {
        await subscriber_instance.subscribe(keys.roomChannel(roomId));
    }

    static async unsubscribe(roomId: string) {
        await subscriber_instance.unsubscribe(keys.roomChannel(roomId));
    }
}
