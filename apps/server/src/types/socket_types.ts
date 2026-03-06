import { WebSocket } from 'ws';

export interface CustomWebSocket extends WebSocket {
    id: string;
    roomId?: string;
    username?: string;
}
