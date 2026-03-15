import type { WebSocket } from 'ws';

export interface CustomWebSocket extends WebSocket {
    id: string;
    username?: string;
    roomId?: string;
}
