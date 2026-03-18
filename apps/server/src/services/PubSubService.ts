import type { ServerEvent } from '@doodle/types';
import {
    publisher_instance,
    redis_instance,
    subscriber_instance,
} from '../singleton/redis.singleton';
import { keys } from '../consts/redis.keys';

type MessageHandler = (event: ServerEvent) => void;

export default class PubSubService {
    static async publish(roomId: string, event: ServerEvent) {
        await publisher_instance.publish(keys.roomChannel(roomId), JSON.stringify(event));
    }

    static async subscribe(roomId: string, onMessage: MessageHandler) {
        await subscriber_instance.subscribe(keys.roomChannel(roomId));
        subscriber_instance.on('message', (channel, raw) => {
            if (channel !== keys.roomChannel(roomId)) return;

            try {
                onMessage(JSON.parse(raw) as ServerEvent);
            } catch (error) {
                console.error('Failed to parse subscibrer msg');
            }
        });
    }

    static async unsubscribe(roomId: string) {
        await subscriber_instance.unsubscribe(keys.roomChannel(roomId));
    }
}
