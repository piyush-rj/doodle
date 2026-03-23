import type { ServerEvent } from '@doodle/types';
import type { CustomWebSocket } from '../types/socket.types';

export default class SocketRegistry {
    private static sockets: Map<string, CustomWebSocket> = new Map(); // sessionId, ws

    static register(sessionId: string, socket: CustomWebSocket) {
        this.sockets.set(sessionId, socket);
    }

    static get(sessionId: string) {
        return this.sockets.get(sessionId);
    }

    static remove(sessionId: string) {
        this.sockets.delete(sessionId);
    }

    static send(sessionId: string, event: ServerEvent) {
        const socket = this.sockets.get(sessionId);
        if (!socket) return;

        socket.send(
            JSON.stringify({
                ...event,
                timestamp: Date.now(),
            }),
        );
    }

    static sendRaw(sessionId: string, data: string) {
        const socket = this.sockets.get(sessionId);
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(data);
        }
    }

    static all() {
        return this.sockets.entries();
    }
}
