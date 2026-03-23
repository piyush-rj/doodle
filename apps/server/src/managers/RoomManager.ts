import {
    DIFFICULTY_ENUM,
    GAME_STATE_ENUM,
    PLAYER_LEFT_REASON_ENUM,
    SERVER_EVENT_ENUM,
    type CreateRoomPayload,
    type DrawStrokePayload,
    type JoinRoomPayload,
    type LeaveRoomPayload,
    type ReconnectPayload,
    type SelectWordPayload,
    type StartGamePayload,
    type SubmitGuessPayload,
    type UndoStrokePayload,
    type ChatMessagePayload,
} from '@doodle/types';
import { v4 as uuid } from 'uuid';
import type { CustomWebSocket } from '../types/socket.types';
import SessionService from '../services/SessionServices';
import RoomServices from '../services/RoomServices';
import SocketRegistry from '../socket/socket.registry';
import PubSubService from '../services/PubSubService';
import pickWordOptions from '../consts/words';

export default class RoomManager {
    private readonly DRAW_RATE_LIMIT_MS = 15;
    private lastDrawTime = new Map<string, number>();

    public async handleCreateRoom(socket: CustomWebSocket, payload: CreateRoomPayload) {
        if (!payload?.username) return;

        // use existing sessionId from client if they have one, else generate new
        const sessionId = payload.sessionId ?? uuid();
        const roomId = uuid();

        // save the room to redis
        await RoomServices.create({
            roomId,
            hostId: sessionId,
            maxPlayers: payload.maxPlayers ?? 8,
            totalRounds: payload.maxRounds ?? 3,
            roundDuration: 80,
            difficulty: payload.difficulty ?? DIFFICULTY_ENUM.MEDIUM,
        });

        // add the creator to the room's player set and scores
        await RoomServices.addPlayer(roomId, sessionId);

        // save the player identity to redis
        await SessionService.create({
            sessionId,
            username: payload.username,
            roomId,
            isConnected: true,
        });

        socket.sessionId = sessionId;
        socket.username = payload.username;
        socket.roomId = roomId;

        // add to the local socket map
        SocketRegistry.register(sessionId, socket);

        // subscribe to roomId
        await PubSubService.subscribe(roomId);

        // build the full room object to send back to the client
        const room = await RoomServices.buildSnapshot(roomId);
        if (!room) return;

        // send their session id first so the client can store it
        SocketRegistry.send(sessionId, {
            type: SERVER_EVENT_ENUM.SESSION_INIT,
            payload: { sessionId },
        });

        // send the full room state
        SocketRegistry.send(sessionId, {
            type: SERVER_EVENT_ENUM.ROOM_CREATED,
            payload: { room },
        });
    }

    public async handleJoinRoom(socket: CustomWebSocket, payload: JoinRoomPayload) {
        const { roomId, username } = payload;

        // check id room exists
        const room = await RoomServices.get(roomId);
        if (!room) {
            SocketRegistry.send(socket.sessionId!, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
            });
            return;
        }

        // check if room has empty slots
        const roomPlayers = await RoomServices.getPlayerCount(roomId);
        if (roomPlayers >= room.maxPlayers) {
            SocketRegistry.send(socket.sessionId!, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: { code: 'ROOM_FULL', message: 'Room is full' },
            });
            return;
        }

        const sessionId = payload.sessionId ?? uuid();

        // add player to the room and save their session
        await RoomServices.addPlayer(roomId, sessionId);
        await SessionService.create({ sessionId, username, roomId, isConnected: true });

        socket.sessionId = sessionId;
        socket.username = username;
        socket.roomId = roomId;

        SocketRegistry.register(sessionId, socket);
        await PubSubService.subscribe(roomId);

        const player = {
            sessionId,
            username,
            score: 0,
            isHost: false,
            hasGuessed: false,
            isConnected: true,
        };

        // tell everyone else in the room a new player arrived
        await PubSubService.publish(roomId, {
            type: SERVER_EVENT_ENUM.PLAYER_JOINED,
            payload: { player },
        });

        // build a new snapshot
        const room_snapshot = await RoomServices.buildSnapshot(roomId);
        if (!room_snapshot) return;

        SocketRegistry.send(sessionId, {
            type: SERVER_EVENT_ENUM.SESSION_INIT,
            payload: { sessionId },
        });

        // send room state to the joinee
        SocketRegistry.send(sessionId, {
            type: SERVER_EVENT_ENUM.ROOM_JOINED,
            payload: { room: room_snapshot, sessionId },
        });
    }

    public async handleLeaveRoom(socket: CustomWebSocket, payload: LeaveRoomPayload) {
        const { roomId } = payload;
        if (!socket.sessionId || !roomId) return;

        SocketRegistry.remove(socket.sessionId);
        await SessionService.delete(socket.sessionId);
        await RoomServices.removePlayer(roomId, socket.sessionId);

        const remainingPlayers = await RoomServices.getPlayerIds(roomId);

        // if nobody is left, delete the room entirely
        if (remainingPlayers.length === 0) {
            await RoomServices.delete(roomId);
            await PubSubService.unsubscribe(roomId);
            return;
        }

        // if the host left, give host to the next person in the list
        const room = await RoomServices.get(roomId);
        if (room?.hostId === socket.sessionId) {
            await RoomServices.transferHost(roomId, remainingPlayers[0]!);
        }

        // publish the msg that a player left the room
        await PubSubService.publish(roomId, {
            type: SERVER_EVENT_ENUM.PLAYER_LEFT,
            payload: {
                sessionId: socket.sessionId,
                username: socket.username!,
                temporary: false,
                reason: PLAYER_LEFT_REASON_ENUM.LEAVE,
            },
        });
    }

    public async handleReconnect(socket: CustomWebSocket, payload: ReconnectPayload) {
        const { sessionId, roomId } = payload;

        // check if the session is still alive in redis (10 min ttl)
        const session = await SessionService.get(sessionId);
        if (!session) {
            SocketRegistry.send(socket.sessionId!, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: { code: 'SESSION_EXPIRED', message: 'Session expired. Please rejoin' },
            });
            return;
        }

        // make sure the room user was in still exists
        const room = await RoomServices.get(roomId);
        if (!room) {
            SocketRegistry.send(socket.sessionId!, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
            });
            return;
        }

        // if user was drawer, cancel the 10s skip timer
        if (room.currentDrawer === sessionId) {
            await RoomServices.clearDrawerTimeout(roomId);
        }

        // mark them as connected again
        await SessionService.markReconnected(sessionId);

        socket.sessionId = sessionId;
        socket.username = session.username;
        socket.roomId = roomId;

        SocketRegistry.register(sessionId, socket);
        await PubSubService.subscribe(roomId);

        // send the full room state to client side
        const room_snapshot = await RoomServices.buildSnapshot(roomId);
        if (!room_snapshot) return;

        SocketRegistry.send(sessionId, {
            type: SERVER_EVENT_ENUM.SESSION_INIT,
            payload: { sessionId },
        });

        SocketRegistry.send(sessionId, {
            type: SERVER_EVENT_ENUM.ROOM_JOINED,
            payload: { room: room_snapshot, sessionId },
        });

        // replay every stroke
        const history = await RoomServices.getHistory(roomId);
        for (const stroke of history) {
            SocketRegistry.send(sessionId, {
                type: SERVER_EVENT_ENUM.CANVAS_UPDATED,
                payload: { stroke },
            });
        }

        // tell everyone else this player is back
        await PubSubService.publish(roomId, {
            type: SERVER_EVENT_ENUM.PLAYER_RECONNECTED,
            payload: {
                player: {
                    sessionId,
                    username: session.username,
                    score: room_snapshot.players.find((p) => p.sessionId === sessionId)?.score ?? 0,
                    isHost: room.hostId === sessionId,
                    hasGuessed: false,
                    isConnected: true,
                },
            },
        });
    }

    public async handleStartGame(socket: CustomWebSocket, payload: StartGamePayload) {
        const { roomId } = payload;
        if (!socket.sessionId || !roomId) return;

        // get room
        const room = await RoomServices.get(roomId);
        if (!room) {
            SocketRegistry.send(socket.sessionId, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
            });
            return;
        }

        // host check
        if (room.hostId !== socket.sessionId) {
            SocketRegistry.send(socket.sessionId, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: { code: 'NOT_HOST', message: 'Only the host can start the game' },
            });
            return;
        }

        // player count check (min 2 players)
        const playerCount = await RoomServices.getPlayerCount(roomId);
        if (playerCount < 2) {
            SocketRegistry.send(socket.sessionId, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: { code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 2 players' },
            });
            return;
        }

        // first player is first drawer
        const playerIds = await RoomServices.getPlayerIds(roomId);
        const firstDrawerId = playerIds[0]!;
        const firstDrawerSession = await SessionService.get(firstDrawerId);
        const firstDrawerUsername = firstDrawerSession?.username ?? '';

        // update room status
        await RoomServices.updateStatus(roomId, GAME_STATE_ENUM.WORD_SELECTION);

        // tell everyone the game started and who draws first
        await PubSubService.publish(roomId, {
            type: SERVER_EVENT_ENUM.GAME_STARTED,
            payload: { firstDrawerId, firstDrawerUsername },
        });

        // generate word and store to validate later
        const words = pickWordOptions();
        await RoomServices.setWordOptions(roomId, words);

        // send word choices to the drawer
        SocketRegistry.send(firstDrawerId, {
            type: SERVER_EVENT_ENUM.WORD_OPTIONS,
            payload: { words, timeToSelect: 15 },
        });

        // broadcast everyone word selection stage
        await PubSubService.publish(roomId, {
            type: SERVER_EVENT_ENUM.WAITING_FOR_WORD,
            payload: { drawerId: firstDrawerId, drawerUsername: firstDrawerUsername },
        });
    }

    public async handleSelectWord(socket: CustomWebSocket, payload: SelectWordPayload) {
        const { roomId, word } = payload;
        if (!socket.sessionId || !roomId) return;

        try {
            // get room
            const room = await RoomServices.get(roomId);
            if (!room) {
                SocketRegistry.send(socket.sessionId, {
                    type: SERVER_EVENT_ENUM.ERROR,
                    payload: {
                        code: 'ROOM_NOT_FOUND',
                        message: 'Room not found',
                    },
                });
                return;
            }

            // only the current drawer can select a word
            if (room.currentDrawer !== socket.sessionId) {
                SocketRegistry.send(socket.sessionId, {
                    type: SERVER_EVENT_ENUM.ERROR,
                    payload: {
                        code: 'NOT_DRAWER',
                        message: 'You are not the drawer',
                    },
                });
                return;
            }

            // validate the word
            const validWords = await RoomServices.getWordOptions(roomId);
            if (!validWords || !validWords.includes(word)) {
                SocketRegistry.send(socket.sessionId, {
                    type: SERVER_EVENT_ENUM.ERROR,
                    payload: {
                        code: 'INVALID_WORD',
                        message: 'Invalid word selection',
                    },
                });
                return;
            }

            // start the round — set word, drawer androundEndsAt in redis
            const roundEndsAt = await RoomServices.startRound(roomId, {
                drawerId: socket.sessionId,
                word,
                roundNumber: room.currentRound + 1,
                roundDuration: room.roundDuration,
            });

            // TODO: SchedulerService.schedule({ type: 'round', roomId }, roundEndsAt);

            const drawerSession = await SessionService.get(socket.sessionId);

            // send the word to the drawer
            SocketRegistry.send(socket.sessionId, {
                type: SERVER_EVENT_ENUM.WORD_TO_DRAW,
                payload: { word, timeLimit: room.roundDuration },
            });

            // tell everyone the round started and who is drawing
            await PubSubService.publish(roomId, {
                type: SERVER_EVENT_ENUM.ROUND_STARTED,
                payload: {
                    drawerId: socket.sessionId,
                    drawerUsername: drawerSession?.username ?? '',
                    roundNumber: room.currentRound + 1,
                    totalRounds: room.totalRounds,
                    roundDuration: room.roundDuration,
                },
            });

            // send word length and hint
            const hint = word.replace(/\S/g, '_');
            await PubSubService.publish(roomId, {
                type: SERVER_EVENT_ENUM.WORD_HINT,
                payload: {
                    drawerId: socket.sessionId,
                    wordLength: word.length,
                    hint,
                    timeLimit: room.roundDuration,
                },
            });
        } catch (err) {
            console.error('failed to select word:', err);
            SocketRegistry.send(socket.sessionId, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: { code: 'SELECT_WORD_ERROR', message: 'Failed to select the word' },
            });
        }
    }

    public async handleDrawStroke(socket: CustomWebSocket, payload: DrawStrokePayload) {
        const { sessionId, roomId } = socket;
        if (!sessionId || !roomId) return;

        try {
            // drop strokes that come in faster than 15ms to avoid flooding
            const now = Date.now();
            const last = this.lastDrawTime.get(sessionId) ?? 0;
            if (now - last < this.DRAW_RATE_LIMIT_MS) return;
            this.lastDrawTime.set(sessionId, now);

            const room = await RoomServices.get(roomId);
            if (!room) return;

            // only the active drawer can send strokes
            if (room.currentDrawer !== sessionId) return;

            // save to redis so the reconnecting players can replay the canvas
            await RoomServices.pushStroke(roomId, payload.stroke);

            // serialise once then send to everyone except the drawer
            const playerIds = await RoomServices.getPlayerIds(roomId);
            const data = JSON.stringify({
                type: SERVER_EVENT_ENUM.CANVAS_UPDATED,
                payload: { stroke: payload.stroke },
            });

            for (const sid of playerIds) {
                if (sid === sessionId) continue;
                SocketRegistry.sendRaw(sid, data);
            }
        } catch (err) {
            console.error('failed to draw stroke:', err);
        }
    }

    public async handleClearCanvas(socket: CustomWebSocket) {
        const { sessionId, roomId } = socket;
        if (!sessionId || !roomId) return;

        try {
            const room = await RoomServices.get(roomId);
            if (!room) return;

            // only the drawer can clear the canvas
            if (room.currentDrawer !== sessionId) return;

            // clear history so reconnecting players dont see cleared strokes
            await RoomServices.clearHistory(roomId);

            await PubSubService.publish(roomId, {
                type: SERVER_EVENT_ENUM.CANVAS_CLEARED,
                payload: { roomId },
            });
        } catch (err) {
            console.error('clear canvas error:', err);
        }
    }

    public async handleUndoStroke(socket: CustomWebSocket, payload: UndoStrokePayload) {
        const { sessionId, roomId } = socket;
        if (!sessionId || !roomId) return;

        try {
            const room = await RoomServices.get(roomId);
            if (!room) return;

            // only the drawer can undo
            if (room.currentDrawer !== sessionId) return;

            // remove the specific stroke from redis history
            await RoomServices.removeHistory(roomId, payload.strokeId);

            await PubSubService.publish(roomId, {
                type: SERVER_EVENT_ENUM.STROKE_UNDONE,
                payload: { strokeId: payload.strokeId },
            });
        } catch (err) {
            console.error('undo stroke failed:', err);
        }
    }

    public async handleSubmitGuess(socket: CustomWebSocket, payload: SubmitGuessPayload) {
        const { sessionId, roomId, username } = socket;
        if (!sessionId || !roomId) return;

        try {
            const room = await RoomServices.get(roomId);
            if (!room) return;

            // drawer should not be abnle to guess their own word
            if (room.currentDrawer === sessionId) return;

            // ignore if they already guessed correctly this round
            if (room.guessedPlayers?.includes(sessionId)) return;

            const guess = payload.guess.trim().toLowerCase();
            const word = room.currentWord.toLowerCase();
            const correct = guess === word;

            if (!correct) {
                // wrong guess msg is broadcasted
                await PubSubService.publish(roomId, {
                    type: SERVER_EVENT_ENUM.CHAT_MESSAGE,
                    payload: {
                        sessionId,
                        username: username ?? '',
                        message: payload.guess,
                        timestamp: Date.now(),
                        isSystem: false,
                    },
                });
                return;
            }

            // earlier guesses earn more points based on time remaining
            const timeLeft = Math.max(0, room.roundEndsAt - Date.now());
            const points = Math.round(100 + (timeLeft / 1000) * 2);

            // update score in the sorted set and mark them as guessed
            await RoomServices.incrementScore(roomId, sessionId, points);
            await RoomServices.addGuessedPlayer(roomId, sessionId);

            // tell everyone this player got it right
            await PubSubService.publish(roomId, {
                type: SERVER_EVENT_ENUM.PLAYER_GUESSED,
                payload: {
                    sessionId,
                    username: username ?? '',
                    pointsEarned: points,
                    guessedAt: Date.now(),
                },
            });

            // send the updated leaderboard to everyone
            const leaderboard = await RoomServices.getLeaderboard(roomId);
            const players = await buildPlayerList(roomId, leaderboard);

            await PubSubService.publish(roomId, {
                type: SERVER_EVENT_ENUM.SCORE_UPDATED,
                payload: { players },
            });

            // check if every guesser has now guessed correctly
            const playerIds = await RoomServices.getPlayerIds(roomId);
            const guessers = playerIds.filter((id) => id !== room.currentDrawer);
            const guessedSoFar = (room.guessedPlayers ?? []).concat(sessionId);
            const everyoneGuessed = guessers.every((id) => guessedSoFar.includes(id));

            // end the round if everyone has guessed the word
            if (everyoneGuessed) {
                await RoomServices.updateStatus(roomId, GAME_STATE_ENUM.ROUND_END);
                await RoomServices.clearHistory(roomId);

                await PubSubService.publish(roomId, {
                    type: SERVER_EVENT_ENUM.ROUND_ENDED,
                    payload: { word: room.currentWord, players },
                });
            }
        } catch (err) {
            console.error('[handleSubmitGuess] error:', err);
            SocketRegistry.send(sessionId, {
                type: SERVER_EVENT_ENUM.ERROR,
                payload: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
            });
        }
    }

    public async handleChatMessage(socket: CustomWebSocket, payload: ChatMessagePayload) {
        const { sessionId, roomId, username } = socket;
        if (!sessionId || !roomId) return;

        const message = payload.message?.trim();
        if (!message) return;

        // broadcast the message to everyone in the room
        await PubSubService.publish(roomId, {
            type: SERVER_EVENT_ENUM.CHAT_MESSAGE,
            payload: {
                sessionId,
                username: username ?? '',
                message,
                timestamp: Date.now(),
                isSystem: false,
            },
        });
    }
}

async function buildPlayerList(
    roomId: string,
    leaderboard: Array<{ sessionId: string; score: number }>,
) {
    const scoreMap = new Map(leaderboard.map((s) => [s.sessionId, s.score]));

    // fetch the room once so we can check who the host is
    const room = await RoomServices.get(roomId);

    return Promise.all(
        leaderboard.map(async ({ sessionId }) => {
            // fetch each player's session to get their username and connection status
            const session = await SessionService.get(sessionId);
            return {
                sessionId,
                username: session?.username ?? '',
                score: scoreMap.get(sessionId) ?? 0,
                isHost: room?.hostId === sessionId,
                hasGuessed: true,
                isConnected: session?.isConnected ?? false,
            };
        }),
    );
}
