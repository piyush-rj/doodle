import { CLIENT_EVENT_ENUM, SERVER_EVENT_ENUM, type ClientEvent } from '@doodle/types';
import RoomServices from '../services/RoomServices';
import type { CustomWebSocket } from '../types/socket.types';
import SessionService from '../services/SessionServices';
import SocketRegistry from './socket.registry';
import RoomManager from '../managers/RoomManager';

export default class WebSocketServer {
    private room_manager: RoomManager;

    constructor(port: number) {
        this.room_manager = new RoomManager();
        this.initConnection(port);
    }

    private initConnection(port: number) {
        Bun.serve({
            port,

            fetch(req, server) {
                if (server.upgrade(req)) return;
                return new Response('Websocket upgrade failed', { status: 500 });
            },

            websocket: {
                open: () => {
                    console.log('connected');
                },
                message: (socket: CustomWebSocket, event) => {
                    let parsed: ClientEvent;
                    try {
                        parsed = JSON.parse(event.toString());
                    } catch (error) {
                        console.error('Failed to parse incoming message: ', error);
                        return;
                    }

                    this.handleIncomingMessage(socket, parsed);
                },

                close: (socket: CustomWebSocket) => {
                    console.log('client disconnected');

                    if (socket.sessionId) {
                        SessionService.markDisconnected(socket.sessionId);
                        SocketRegistry.remove(socket.sessionId);
                    }
                },
            },
        });
    }

    private async validateSession(sessionId: string) {
        if (!sessionId) return null;
        return await SessionService.get(sessionId);
    }

    private handleIncomingMessage(socket: CustomWebSocket, event: ClientEvent) {
        if (!socket) return;
        const session = this.validateSession(socket.sessionId!);
        if (!session) {
            SocketRegistry.send(socket.sessionId!, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: {
                    code: 'SESSION_NOT_FOUND',
                    message: 'try to reconnect.',
                },
            });
        }

        switch (event.type) {
            case CLIENT_EVENT_ENUM.CREATE_ROOM:
                this.room_manager.handleCreateRoom(socket, event.payload);
                break;
        }
    }
}
