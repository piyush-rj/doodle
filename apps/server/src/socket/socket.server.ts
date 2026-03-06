import {
    CLIENT_EVENT_TYPE,
    ROOM_STATE,
    SERVER_EVENT_TYPE,
    type ClientMessage,
    type Player,
    type Room,
    type ServerMessage,
    type Stroke,
} from '@doodle/types';
import { WebSocketServer as WSServer } from 'ws';
import type { CustomWebSocket } from '../types/socket_types';
import { v4 as uuid } from 'uuid';
import type {
    CreateRoomPayload,
    DrawPayload,
    JoinRoomPayload,
    SelectWordPayload,
    SubmitGuessPayload,
} from '@doodle/types/socket/socket.payload.types';
import RoomManager from './manager/RoomManager';

export default class WebSocketServer {
    private wss: WSServer;
    private socketMap: Map<string, CustomWebSocket>;
    private roundTimerMap: Map<string, NodeJS.Timeout>;
    private roomManager: RoomManager;

    constructor(port: number) {
        this.socketMap = new Map();
        this.roundTimerMap = new Map();
        this.roomManager = new RoomManager();
        this.wss = new WSServer({ port });

        this.initConnection();
    }

    private initConnection() {
        this.wss.on('connection', (ws: CustomWebSocket) => {
            console.log('ws connexted');

            ws.on('message', (data) => {
                try {
                    const parsed: ClientMessage = JSON.parse(data.toString());
                    this.handleIncomingMessage(ws, parsed);
                } catch {
                    this.sendErrorMessage(ws, 'Invalid message format');
                    return;
                }
            });

            ws.on('close', () => {
                this.handleCloseConnection(ws);
            });
        });
    }

    private handleCloseConnection(socket: CustomWebSocket) {
        try {
            if (!socket.id || !socket.roomId) return;

            const room = this.roomManager.getRoom(socket.roomId);
            const wasDrawer = room?.drawerId === socket.id;

            this.roomManager.leaveRoom(socket.id, socket.roomId);
            this.socketMap.delete(socket.id);

            // if drawer disconnects while drawing
            if (wasDrawer && room.state === ROOM_STATE.DRAWING) {
                clearTimeout(this.roundTimerMap.get(room.id));
                this.roundTimerMap.delete(room.id);

                const next = this.roomManager.nextTurn(room.id);
                if (!next) return;

                const nextRoom = next.room;
                if (next.gameEnded) {
                    const message: ServerMessage = {
                        type: SERVER_EVENT_TYPE.ROUND_ENDED,
                        payload: { roomId: nextRoom.id },
                    };

                    this.broadcastToRoom(nextRoom, message);
                    return;
                }

                const drawer = this.socketMap.get(nextRoom.drawerId!);
                if (drawer) {
                    const wordOptionsMsg: ServerMessage = {
                        type: SERVER_EVENT_TYPE.WORD_OPTIONS,
                        payload: {
                            wordOptions: nextRoom.wordOptions,
                        },
                    };

                    this.sendToPlayer(drawer.id, wordOptionsMsg);
                }

                const nextDrawerMessage: ServerMessage = {
                    type: SERVER_EVENT_TYPE.NEXT_DRAWER,
                    payload: {
                        drawerId: nextRoom.drawerId,
                        round: nextRoom.round,
                    },
                };

                this.broadcastToRoom(room, nextDrawerMessage);
            }
            console.log('socket disconnected');
        } catch {
            this.sendErrorMessage(socket, 'Failed to close connection');
            return;
        }
    }

    private handleIncomingMessage(ws: CustomWebSocket, message: ClientMessage) {
        try {
            switch (message.type) {
                case CLIENT_EVENT_TYPE.CREATE_ROOM:
                    this.handleCreateRoom(ws, message.payload);
                    break;

                case CLIENT_EVENT_TYPE.JOIN_ROOM:
                    this.handleJoinRoom(ws, message.payload);
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

                case CLIENT_EVENT_TYPE.SUBMIT_GUESS:
                    this.handleSubmitGuess(ws, message.payload);
                    break;

                default:
                    this.sendErrorMessage(ws, 'Invalid message type');
            }
        } catch {
            this.sendErrorMessage(ws, 'Error handling message');
        }
    }

    private sendErrorMessage(socket: CustomWebSocket, message: string) {
        if (!socket.id) return;

        this.sendToPlayer(socket.id, {
            type: SERVER_EVENT_TYPE.SERVER_ERROR,
            payload: { message },
        });
    }

    private handleCreateRoom(socket: CustomWebSocket, payload: CreateRoomPayload) {
        try {
            const { username } = payload;

            if (!username || username.trim().length > 30) {
                this.sendErrorMessage(socket, 'Invalid username');
                return;
            }

            const playerId = uuid();

            socket.id = playerId;
            socket.username = username;

            const player: Player = {
                id: playerId,
                username,
                score: 0,
                hasGuessed: false,
            };

            const room = this.roomManager.createRoom(player);

            if (!room) {
                this.sendErrorMessage(socket, 'Failed to create room');
                return;
            }

            socket.roomId = room.id;
            this.socketMap.set(socket.id, socket);

            const message: ServerMessage = {
                type: SERVER_EVENT_TYPE.ROOM_CREATED,
                payload: {
                    roomId: room.id,
                },
            };

            this.sendToPlayer(socket.id, message);
            console.log(`Room created -------------> ${room.id}`);
        } catch {
            this.sendErrorMessage(socket, 'Internal server error');
            return;
        }
    }

    private handleJoinRoom(socket: CustomWebSocket, payload: JoinRoomPayload) {
        try {
            const { username, roomId } = payload;

            if (!username || !roomId) {
                this.sendErrorMessage(socket, 'Username or roomId missing');
                return;
            }

            const playerId = uuid();

            socket.id = playerId;
            socket.username = username;

            const player: Player = {
                id: playerId,
                username,
                score: 0,
                hasGuessed: false,
            };

            const room = this.roomManager.joinRoom(player, roomId);

            if (!room) {
                this.sendErrorMessage(socket, 'Room not found');
                return;
            }

            socket.roomId = roomId;
            this.socketMap.set(playerId, socket);

            const message: ServerMessage = {
                type: SERVER_EVENT_TYPE.ROOM_JOINED,
                payload: {
                    roomId: room.id,
                    players: Array.from(room.players.values()),
                    hostId: room.hostId,
                    drawerId: room.drawerId,
                    state: room.state,
                    round: room.round,
                },
            };
            this.broadcastToRoom(room, message);
            this.sendRoomState(socket.id, room);

            if (room.state === ROOM_STATE.DRAWING && room.drawingHistory.length > 0) {
                const canvasSyncMessage: ServerMessage = {
                    type: SERVER_EVENT_TYPE.CANVAS_SYNC,
                    payload: {
                        strokes: room.drawingHistory,
                    },
                };

                this.sendToPlayer(socket.id, canvasSyncMessage);
            }

            console.log(`JOined room -----------> ${roomId}`);
        } catch {
            this.sendErrorMessage(socket, 'Failed to join room');
            return;
        }
    }

    private handleLeaveRoom(socket: CustomWebSocket) {
        try {
            if (!socket.id || !socket.roomId) {
                this.sendErrorMessage(socket, 'Invalid session');
                return;
            }

            this.roomManager.leaveRoom(socket.id, socket.roomId);
            this.socketMap.delete(socket.id);

            const message: ServerMessage = {
                type: SERVER_EVENT_TYPE.ROOM_LEFT,
                payload: {
                    roomId: socket.roomId,
                },
            };

            const room = this.roomManager.getRoom(socket.roomId);
            if (!room) {
                this.sendErrorMessage(socket, 'Room not found');
                return;
            }

            this.broadcastToRoom(room, message);
            console.log('Player left');
        } catch {
            this.sendErrorMessage(socket, 'Failed to leave room');
            return;
        }
    }

    private handleStartGame(socket: CustomWebSocket) {
        try {
            if (!socket.id || !socket.roomId) {
                this.sendErrorMessage(socket, 'Invalid session');
                return;
            }

            const room = this.roomManager.startGame(socket.roomId, socket.id);

            if (!room) {
                this.sendErrorMessage(socket, 'Unable to start game');
                return;
            }

            const drawerSocket = this.socketMap.get(room.drawerId!);

            if (!drawerSocket) {
                this.sendErrorMessage(socket, 'Drawer socket not found');
                return;
            }

            const drawer_message: ServerMessage = {
                type: SERVER_EVENT_TYPE.WORD_OPTIONS,
                payload: {
                    wordOptions: room.wordOptions,
                },
            };

            const broadcast_message: ServerMessage = {
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
            };

            this.broadcastExceptSender(room, socket.id, broadcast_message);
            this.sendToPlayer(drawerSocket.id, drawer_message);

            console.log(`Started game`);
            return room;
        } catch {
            this.sendErrorMessage(socket, 'Failed to start game');
            return;
        }
    }

    private handleSelectWord(socket: CustomWebSocket, payload: SelectWordPayload) {
        try {
            const { word } = payload;
            if (!socket.id || !word) {
                this.sendErrorMessage(socket, 'Invalid request');
                return;
            }

            const room = this.roomManager.selectWord(socket.roomId!, socket.id, word);
            if (!room) {
                this.sendErrorMessage(socket, 'Word selection failed');
                return;
            }
            this.startRoundTimer(room);

            const message: ServerMessage = {
                type: SERVER_EVENT_TYPE.WORD_SELECTED,
                payload: {
                    drawerId: room.drawerId,
                    round: room.round,
                    roundStartTime: room.roundStartTime,
                },
            };
            this.broadcastToRoom(room, message);
        } catch {
            this.sendErrorMessage(socket, 'Failed to select word');
            return;
        }
    }

    private handleDrawStroke(socket: CustomWebSocket, payload: DrawPayload) {
        try {
            const { points, color, brushSize } = payload;

            if (!socket.id || !socket.roomId) {
                this.sendErrorMessage(socket, 'Invalid drawing request');
                return;
            }

            if (!points || !color || !brushSize) {
                this.sendErrorMessage(socket, 'Invalid drawing data');
                return;
            }

            const message: ServerMessage = {
                type: SERVER_EVENT_TYPE.DRAWING_EVENT,
                payload: {
                    points,
                    color,
                    brushSize,
                },
            };

            const room = this.roomManager.drawStroke(socket.roomId!, socket.id, payload as Stroke);
            if (!room) {
                this.sendErrorMessage(socket, 'Drawing failed');
                return;
            }

            this.broadcastExceptSender(room, socket.id, message);
        } catch {
            this.sendErrorMessage(socket, 'Failed to draw stroke');
            return;
        }
    }

    private handleSubmitGuess(socket: CustomWebSocket, payload: SubmitGuessPayload) {
        try {
            const { guess } = payload;

            if (!socket.id || !socket.roomId || !guess) {
                this.sendErrorMessage(socket, 'Invalid guess');
                return;
            }

            const result = this.roomManager.submitGuess(socket.roomId, socket.id, guess);

            if (!result) {
                this.sendErrorMessage(socket, 'Guess could not be processed');
                return;
            }

            const { room, correct, score, roundEnded, gameEnded } = result;
            if (correct) {
                const guessMessage = {
                    type: SERVER_EVENT_TYPE.PLAYER_GUESSED,
                    payload: {
                        playerId: socket.id,
                        username: socket.username,
                        guess: null,
                        correct,
                        score,
                    },
                };
                this.broadcastToRoom(room, guessMessage);
            } else {
                const guessMessage = {
                    type: SERVER_EVENT_TYPE.PLAYER_GUESSED,
                    payload: {
                        playerId: socket.id,
                        username: socket.username,
                        guess,
                        correct,
                        score,
                    },
                };
                this.broadcastToRoom(room, guessMessage);
            }

            // guess is correct and the user that guessed should be sent to everyone
            // the guess shouldnt be sent to everyone if the guess is correct
            if (roundEnded && !gameEnded) {
                clearTimeout(this.roundTimerMap.get(room.id));
                this.roundTimerMap.delete(room.id);

                const next = this.roomManager.nextTurn(room.id);
                if (!next) {
                    this.sendErrorMessage(socket, 'Next turn failed');
                    return;
                }

                const nextRoom = next.room;
                const drawerSocket = this.socketMap.get(nextRoom.drawerId!);

                if (drawerSocket) {
                    this.sendToPlayer(drawerSocket.id, {
                        type: SERVER_EVENT_TYPE.WORD_OPTIONS,
                        payload: nextRoom.wordOptions,
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
        } catch {
            this.sendErrorMessage(socket, 'Submit guess failed');
        }
    }

    private startRoundTimer(room: Room) {
        const roomId = room.id;

        if (this.roundTimerMap.has(roomId)) {
            clearTimeout(this.roundTimerMap.get(roomId)!);
        }

        const timer = setTimeout(() => {
            this.handleRoundTimeout(roomId);
        }, 60000); // 60 seconds

        this.roundTimerMap.set(roomId, timer);
    }

    private handleRoundTimeout(roomId: string) {
        const room = this.roomManager.getRoom(roomId);
        if (!room) return;

        const next = this.roomManager.nextTurn(roomId);
        if (!next) return;

        // this is the next round of the same room
        const nextRoom = next.room;

        if (next.gameEnded) {
            const message: ServerMessage = {
                type: SERVER_EVENT_TYPE.ROUND_ENDED,
                payload: {
                    roomId: nextRoom.id,
                },
            };

            this.broadcastToRoom(nextRoom, message);
            return;
        }

        const drawerSocket = this.socketMap.get(nextRoom.drawerId!);

        if (drawerSocket) {
            const wordOptionsMessage: ServerMessage = {
                type: SERVER_EVENT_TYPE.WORD_OPTIONS,
                payload: {
                    wordOptions: nextRoom.wordOptions,
                },
            };

            this.sendToPlayer(drawerSocket.id, wordOptionsMessage);
        }

        const nextDrawerMessage: ServerMessage = {
            type: SERVER_EVENT_TYPE.NEXT_DRAWER,
            payload: {
                drawerId: nextRoom.drawerId,
                round: nextRoom.round,
            },
        };

        this.broadcastToRoom(nextRoom, nextDrawerMessage);
    }

    private sendRoomState(playerId: string, room: Room) {
        const message: ServerMessage = {
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
        };

        this.sendToPlayer(playerId, message);
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
            if (!socket) continue;

            socket.send(data);
        }
    }

    private broadcastExceptSender(room: Room, excludePlayerId: string, message: unknown) {
        const data = JSON.stringify(message);

        for (const player of room.players.values()) {
            if (player.id === excludePlayerId) continue;

            const socket = this.socketMap.get(player.id);
            if (!socket) continue;

            socket.send(data);
        }
    }
}
