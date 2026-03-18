import type { ServerWebSocket } from 'bun';

export interface CustomWebSocket extends ServerWebSocket {
    sessionId?: string;
    username?: string;
    roomId?: string;
}
