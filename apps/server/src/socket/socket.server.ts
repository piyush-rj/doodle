import {
    CLIENT_EVENT_ENUM,
    GAME_STATE_ENUM,
    PLAYER_LEFT_REASON_ENUM,
    SERVER_EVENT_ENUM,
    type ClientEvent,
} from '@doodle/types';
import type { CustomWebSocket } from '../types/socket.types';
import SessionService from '../services/SessionServices';
import RoomServices from '../services/RoomServices';
import PubSubService from '../services/PubSubService';
import SchedulerService from '../services/SchedulerService';
import SocketRegistry from './socket.registry';
import RoomManager from '../managers/RoomManager';
import { startScheduler } from '../managers/SchedulerManager';

const PUBLIC_EVENTS = new Set([
    CLIENT_EVENT_ENUM.CREATE_ROOM,
    CLIENT_EVENT_ENUM.JOIN_ROOM,
    CLIENT_EVENT_ENUM.RECONNECT,
]);

export default class WebSocketServer {
    private room_handlers: RoomManager;

    constructor(port: number) {
        this.room_handlers = new RoomManager();
        PubSubService.init();
        startScheduler();
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
                open: (socket: CustomWebSocket) => {
                    socket.sessionId = undefined;
                    socket.roomId = undefined;
                    socket.username = undefined;
                },

                message: (socket: CustomWebSocket, event) => {
                    let parsed: ClientEvent;
                    try {
                        parsed = JSON.parse(event.toString());
                    } catch {
                        console.error('failed to parse incoming message');
                        return;
                    }
                    this.handleIncomingMessage(socket, parsed);
                },

                close: async (socket: CustomWebSocket) => {
                    if (!socket.sessionId || !socket.roomId) return;

                    SocketRegistry.remove(socket.sessionId);
                    await SessionService.markDisconnected(socket.sessionId);

                    const room = await RoomServices.get(socket.roomId);
                    if (!room) return;

                    // if drawer disconnected, start the 10s grace window before skipping
                    if (
                        room.currentDrawer === socket.sessionId &&
                        room.status === GAME_STATE_ENUM.DRAWING
                    ) {
                        const drawerTimeoutEndsAt = await RoomServices.setDrawerTimeout(
                            socket.roomId,
                            socket.sessionId,
                        );
                        await SchedulerService.schedule(
                            { type: 'drawer', sessionId: socket.sessionId, roomId: socket.roomId },
                            drawerTimeoutEndsAt,
                        );
                    }

                    const remaining = await RoomServices.getPlayerIds(socket.roomId);

                    if (remaining.length === 0) {
                        await RoomServices.delete(socket.roomId);
                        await PubSubService.unsubscribe(socket.roomId);
                        return;
                    }

                    if (room.hostId === socket.sessionId) {
                        await RoomServices.transferHost(socket.roomId, remaining[0]!);
                    }

                    await PubSubService.publish(socket.roomId, {
                        type: SERVER_EVENT_ENUM.PLAYER_LEFT,
                        payload: {
                            sessionId: socket.sessionId,
                            username: socket.username ?? '',
                            temporary: true,
                            reason: PLAYER_LEFT_REASON_ENUM.DISCONNECT,
                        },
                    });
                },
            },
        });
    }

    private async validateSession(sessionId: string | undefined) {
        if (!sessionId) return null;
        return await SessionService.get(sessionId);
    }

    private async handleIncomingMessage(socket: CustomWebSocket, event: ClientEvent) {
        if (!socket) return;

        if (!PUBLIC_EVENTS.has(event.type)) {
            const session = await this.validateSession(socket.sessionId);
            if (!session) {
                SocketRegistry.send(socket.sessionId!, {
                    type: SERVER_EVENT_ENUM.ERROR,
                    payload: {
                        code: 'SESSION_NOT_FOUND',
                        message: 'Session expired. Please reconnect.',
                    },
                });
                return;
            }
        }

        try {
            switch (event.type) {
                case CLIENT_EVENT_ENUM.CREATE_ROOM:
                    await this.room_handlers.handleCreateRoom(socket, event.payload);
                    break;
                case CLIENT_EVENT_ENUM.JOIN_ROOM:
                    await this.room_handlers.handleJoinRoom(socket, event.payload);
                    break;
                case CLIENT_EVENT_ENUM.LEAVE_ROOM:
                    await this.room_handlers.handleLeaveRoom(socket, event.payload);
                    break;
                case CLIENT_EVENT_ENUM.RECONNECT:
                    await this.room_handlers.handleReconnect(socket, event.payload);
                    break;
                case CLIENT_EVENT_ENUM.START_GAME:
                    await this.room_handlers.handleStartGame(socket, event.payload);
                    break;
                case CLIENT_EVENT_ENUM.SELECT_WORD:
                    await this.room_handlers.handleSelectWord(socket, event.payload);
                    break;
                case CLIENT_EVENT_ENUM.DRAW_STROKE:
                    await this.room_handlers.handleDrawStroke(socket, event.payload);
                    break;
                case CLIENT_EVENT_ENUM.CLEAR_CANVAS:
                    await this.room_handlers.handleClearCanvas(socket);
                    break;
                case CLIENT_EVENT_ENUM.UNDO_STROKE:
                    await this.room_handlers.handleUndoStroke(socket, event.payload);
                    break;
                case CLIENT_EVENT_ENUM.SUBMIT_GUESS:
                    await this.room_handlers.handleSubmitGuess(socket, event.payload);
                    break;
                case CLIENT_EVENT_ENUM.CHAT_MESSAGE:
                    await this.room_handlers.handleChatMessage(socket, event.payload);
                    break;
            }
        } catch (err) {
            console.error(`ws error in ${event.type}:`, err);
            SocketRegistry.send(socket.sessionId!, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: {
                    code: 'INTERNAL_WS_ERROR',
                    message: 'Internal server error.',
                },
            });
        }
    }
}
