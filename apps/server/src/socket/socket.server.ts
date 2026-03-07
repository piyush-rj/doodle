import {
    CLIENT_EVENT_TYPE,
    ROOM_STATE,
    SERVER_EVENT_TYPE,
    type ClientMessage,
    type Player,
    type Room,
    type Stroke,
} from '@doodle/types';

import { WebSocketServer as WSServer } from 'ws';
import type { CustomWebSocket } from '../types/socket_types';

import type {
    ChatMessageClientPayload,
    CreateRoomPayload,
    DrawPayload,
    JoinRoomPayload,
    SelectWordPayload,
} from '@doodle/types/socket/socket.payload.types';

import RoomManager from '../manager/RoomManager';
import RedisService from '../redis/RedisService';
import { v4 as uuid } from 'uuid';

export default class WebSocketServer {
    private wss: WSServer;
    private socketMap: Map<string, CustomWebSocket>;
    private roundTimerMap: Map<string, NodeJS.Timeout>;
    private roomManager: RoomManager;
    private redis: RedisService;

    private readonly MAX_PLAYERS: number = 8;
    private readonly DRAW_RATE_LIMIT_MS: number = 15;
    private readonly serverId: string = uuid();

    constructor(port: number) {
        this.socketMap = new Map();
        this.roundTimerMap = new Map();
        this.roomManager = new RoomManager();
        this.redis = new RedisService();

        this.wss = new WSServer({ port });

        this.initConnection();
    }

    private initConnection() {
        this.wss.on('connection', (ws: CustomWebSocket) => {
            ws.lastDrawTime = 0;
            ws.lastGuessTime = 0;

            ws.on('message', async (data) => {
                try {
                    const parsed: ClientMessage = JSON.parse(data.toString());
                    await this.handleIncomingMessage(ws, parsed);
                } catch {
                    this.sendErrorMessage(ws, 'Invalid message format');
                }
            });

            ws.on('close', () => {
                this.handleCloseConnection(ws);
            });
        });
    }

    private handleCloseConnection(socket: CustomWebSocket) {
        if (!socket.id || !socket.roomId) return;

        const room = this.roomManager.getRoom(socket.roomId);
        const wasDrawer = room?.drawerId === socket.id;

        this.socketMap.delete(socket.id);

        setTimeout(async () => {
            const stillDisconnected = !this.socketMap.has(socket.id);

            if (stillDisconnected) {
                const deleted = this.roomManager.leaveRoom(socket.id!, socket.roomId!);

                if (deleted) {
                    await this.redis.removeRoom(socket.roomId!);
                }
            }
        }, 10000);

        if (wasDrawer && room && room.state === ROOM_STATE.DRAWING) {
            clearTimeout(this.roundTimerMap.get(room.id));
            this.roundTimerMap.delete(room.id);

            const next = this.roomManager.nextTurn(room.id);
            if (!next) return;

            const nextRoom = next.room;

            if (next.gameEnded) {
                this.broadcastToRoom(nextRoom, {
                    type: SERVER_EVENT_TYPE.ROUND_ENDED,
                    payload: { roomId: nextRoom.id },
                });
                return;
            }

            const drawerSocket = this.socketMap.get(nextRoom.drawerId!);

            if (drawerSocket) {
                this.sendToPlayer(drawerSocket.id, {
                    type: SERVER_EVENT_TYPE.WORD_OPTIONS,
                    payload: { wordOptions: nextRoom.wordOptions },
                });
            }

            this.broadcastToRoom(nextRoom, {
                type: SERVER_EVENT_TYPE.NEXT_DRAWER,
                payload: {
                    drawerId: nextRoom.drawerId,
                    round: nextRoom.round,
                },
            });
        }
    }

    private async handleIncomingMessage(ws: CustomWebSocket, message: ClientMessage) {
        switch (message.type) {
            case CLIENT_EVENT_TYPE.CREATE_ROOM:
                await this.handleCreateRoom(ws, message.payload);
                break;

            case CLIENT_EVENT_TYPE.JOIN_ROOM:
                await this.handleJoinRoom(ws, message.payload);
                break;

            case CLIENT_EVENT_TYPE.LEAVE_ROOM:
                this.handleLeaveRoom(ws);
                break;

            case CLIENT_EVENT_TYPE.START_GAME:
                this.handleStartGame(ws);
                break;

            case CLIENT_EVENT_TYPE.SELECT_WORD:
                this.handleSelectWord(ws, message.payload);
                break;

            case CLIENT_EVENT_TYPE.DRAW_STROKE:
                this.handleDrawStroke(ws, message.payload);
                break;

            // case CLIENT_EVENT_TYPE.SUBMIT_GUESS:
            //     this.handleSubmitGuess(ws, message.payload);
            //     break;

            case CLIENT_EVENT_TYPE.CHAT_MESSAGE:
                this.handleChatMessage(ws, message.payload);
                break;
        }
    }

    private sendErrorMessage(socket: CustomWebSocket, message: string) {
        if (!socket.id) return;

        this.sendToPlayer(socket.id, {
            type: SERVER_EVENT_TYPE.SERVER_ERROR,
            payload: { message },
        });
    }

    private async handleCreateRoom(socket: CustomWebSocket, payload: CreateRoomPayload) {
        const { username, sessionId } = payload;

        if (!username || !sessionId) {
            this.sendErrorMessage(socket, 'Invalid creds');
            return;
        }

        socket.id = sessionId;
        socket.username = username;

        const player: Player = {
            id: sessionId,
            username,
            score: 0,
            hasGuessed: false,
        };

        const room = this.roomManager.createRoom(player);
        if (!room) return;

        socket.roomId = room.id;
        this.socketMap.set(sessionId, socket);

        await this.redis.registerRoom(room.id, this.serverId);

        this.sendToPlayer(socket.id, {
            type: SERVER_EVENT_TYPE.ROOM_CREATED,
            payload: { roomId: room.id },
        });
    }

    private async handleJoinRoom(socket: CustomWebSocket, payload: JoinRoomPayload) {
        const { username, roomId, sessionId } = payload;

        const serverId = await this.redis.getRoomServer(roomId);

        if (serverId && serverId !== this.serverId) {
            this.sendErrorMessage(socket, 'Room not hosted here');
            return;
        }

        socket.id = sessionId;
        socket.username = username;

        const player: Player = {
            id: sessionId,
            username,
            score: 0,
            hasGuessed: false,
        };

        const room = this.roomManager.getRoom(roomId);

        if (room && room.players.has(sessionId)) {
            socket.roomId = roomId;
            this.socketMap.set(sessionId, socket);
            this.sendRoomState(sessionId, room);
            return;
        }

        if (!room || room.players.size >= this.MAX_PLAYERS) {
            this.sendErrorMessage(socket, 'Room is full');
            return;
        }

        const joinedRoom = this.roomManager.joinRoom(player, roomId);
        if (!joinedRoom) return;

        socket.roomId = roomId;
        this.socketMap.set(sessionId, socket);

        this.broadcastToRoom(joinedRoom, {
            type: SERVER_EVENT_TYPE.ROOM_JOINED,
            payload: {
                roomId: joinedRoom.id,
                players: Array.from(joinedRoom.players.values()),
                hostId: joinedRoom.hostId,
                drawerId: joinedRoom.drawerId,
                state: joinedRoom.state,
                round: joinedRoom.round,
            },
        });

        this.sendRoomState(socket.id, joinedRoom);
    }

    private handleLeaveRoom(socket: CustomWebSocket) {
        if (!socket.id || !socket.roomId) return;

        this.socketMap.delete(socket.id);

        const room = this.roomManager.getRoom(socket.roomId);
        if (!room) return;

        const deleted = this.roomManager.leaveRoom(socket.id, socket.roomId);

        if (deleted) {
            this.redis.removeRoom(socket.roomId);
        }

        this.broadcastToRoom(room, {
            type: SERVER_EVENT_TYPE.ROOM_LEFT,
            payload: { roomId: socket.roomId },
        });
    }

    private handleStartGame(socket: CustomWebSocket) {
        if (!socket.roomId || !socket.id) return;

        const room = this.roomManager.startGame(socket.roomId, socket.id);
        if (!room) return;

        const drawerSocket = this.socketMap.get(room.drawerId!);

        if (drawerSocket) {
            this.sendToPlayer(drawerSocket.id, {
                type: SERVER_EVENT_TYPE.WORD_OPTIONS,
                payload: { wordOptions: room.wordOptions },
            });
        }

        this.broadcastToRoom(room, {
            type: SERVER_EVENT_TYPE.GAME_STARTED,
            payload: {
                roomId: room.id,
                players: Array.from(room.players.values()),
                hostId: room.hostId,
                drawerId: room.drawerId,
                word: room.word,
                state: room.state,
                round: room.round,
                maxRounds: room.maxRounds,
                drawingHistory: room.drawingHistory,
            },
        });
    }

    private handleSelectWord(socket: CustomWebSocket, payload: SelectWordPayload) {
        if (!socket.id || !socket.roomId) return;

        const room = this.roomManager.selectWord(socket.roomId, socket.id, payload.word);
        if (!room) return;

        this.startRoundTimer(room);

        this.broadcastToRoom(room, {
            type: SERVER_EVENT_TYPE.WORD_SELECTED,
            payload: {
                drawerId: room.drawerId,
                round: room.round,
                roundStartTime: room.roundStartTime,
            },
        });
    }

    private handleDrawStroke(socket: CustomWebSocket, payload: DrawPayload) {
        if (!socket.id || !socket.roomId) return;

        const now = Date.now();
        if (now - socket.lastDrawTime! < this.DRAW_RATE_LIMIT_MS) return;
        socket.lastDrawTime = now;

        const room = this.roomManager.drawStroke(socket.roomId, socket.id, payload as Stroke);
        if (!room) return;

        this.broadcastExceptSender(room, socket.id, {
            type: SERVER_EVENT_TYPE.DRAWING_EVENT,
            payload,
        });
    }

    private handleChatMessage(socket: CustomWebSocket, payload: ChatMessageClientPayload) {
        if (!socket.id || !socket.roomId) return;

        const message = payload.message?.trim();
        if (!message) return;

        const result = this.roomManager.submitGuess(socket.roomId, socket.id, message);

        if (!result) {
            const room = this.roomManager.getRoom(socket.roomId);
            if (!room) return;

            this.broadcastToRoom(room, {
                type: SERVER_EVENT_TYPE.CHAT_MESSAGE,
                payload: {
                    playerId: socket.id,
                    username: socket.username,
                    message,
                    correct: false,
                },
            });

            return;
        }

        const { room, correct, score, roundEnded, gameEnded } = result;

        this.broadcastToRoom(room, {
            type: SERVER_EVENT_TYPE.CHAT_MESSAGE,
            payload: {
                playerId: socket.id,
                username: socket.username,
                message: correct ? null : message,
                correct,
                score,
            },
        });

        if (correct && roundEnded && !gameEnded) {
            clearTimeout(this.roundTimerMap.get(room.id));
            this.roundTimerMap.delete(room.id);

            const next = this.roomManager.nextTurn(room.id);
            if (!next) return;

            const nextRoom = next.room;

            const drawerSocket = this.socketMap.get(nextRoom.drawerId!);

            if (drawerSocket) {
                this.sendToPlayer(drawerSocket.id, {
                    type: SERVER_EVENT_TYPE.WORD_OPTIONS,
                    payload: {
                        wordOptions: nextRoom.wordOptions,
                    },
                });
            }

            this.broadcastToRoom(nextRoom, {
                type: SERVER_EVENT_TYPE.NEXT_DRAWER,
                payload: {
                    drawerId: nextRoom.drawerId,
                    round: nextRoom.round,
                },
            });
        }
    }

    private startRoundTimer(room: Room) {
        const roomId = room.id;

        if (this.roundTimerMap.has(roomId)) {
            clearTimeout(this.roundTimerMap.get(roomId)!);
        }

        const timer = setTimeout(() => {
            this.handleRoundTimeout(roomId);
        }, 60000);

        this.roundTimerMap.set(roomId, timer);
    }

    private handleRoundTimeout(roomId: string) {
        const room = this.roomManager.getRoom(roomId);
        if (!room) return;

        const next = this.roomManager.nextTurn(roomId);
        if (!next) return;

        const nextRoom = next.room;

        this.broadcastToRoom(nextRoom, {
            type: SERVER_EVENT_TYPE.NEXT_DRAWER,
            payload: {
                drawerId: nextRoom.drawerId,
                round: nextRoom.round,
            },
        });
    }

    private sendRoomState(playerId: string, room: Room) {
        this.sendToPlayer(playerId, {
            type: SERVER_EVENT_TYPE.ROOM_STATE,
            payload: {
                roomId: room.id,
                players: Array.from(room.players.values()),
                hostId: room.hostId,
                drawerId: room.drawerId,
                state: room.state,
                round: room.round,
                maxRounds: room.maxRounds,
                drawingHistory: room.drawingHistory,
                roundStartTime: room.roundStartTime,
            },
        });
    }

    private sendToPlayer(playerId: string, message: unknown) {
        const socket = this.socketMap.get(playerId);
        if (!socket) return;

        socket.send(JSON.stringify(message));
    }

    private broadcastToRoom(room: Room, message: unknown) {
        const data = JSON.stringify(message);

        for (const player of room.players.values()) {
            const socket = this.socketMap.get(player.id);
            if (socket) socket.send(data);
        }
    }

    private broadcastExceptSender(room: Room, excludePlayerId: string, message: unknown) {
        const data = JSON.stringify(message);

        for (const player of room.players.values()) {
            if (player.id === excludePlayerId) continue;

            const socket = this.socketMap.get(player.id);
            if (socket) socket.send(data);
        }
    }
}
