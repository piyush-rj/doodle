import { ROOM_STATE, type Player, type Room, type Stroke } from '@doodle/types';
import { v4 as uuid } from 'uuid';
import { WORD_LIST } from '../../utils/words';

export default class RoomManager {
    private roomsMapping: Map<string, Room>;

    constructor() {
        this.roomsMapping = new Map();
    }

    createRoom(host: Player): Room | undefined {
        if (!host?.id) return;

        const roomId = uuid();

        const room: Room = {
            id: roomId,
            players: new Map([[host.id, host]]),
            hostId: host.id,
            drawerId: null,
            word: null,
            state: ROOM_STATE.WAITING,
            round: 0,
            drawerQueue: [],
            maxRounds: 3,
            drawingHistory: [],
            currentDrawerIndex: 0,
            guessedPlayers: new Set(),
            roundStartTime: null,
            wordOptions: [],
        };

        this.roomsMapping.set(roomId, room);
        return room;
    }

    joinRoom(player: Player, roomId: string): Room | undefined {
        if (!player?.id || !roomId) return;

        const room = this.roomsMapping.get(roomId);
        if (!room) return;

        room.players.set(player.id, player);
        return room;
    }

    getRoom(roomId: string): Room | undefined {
        if (!roomId) return undefined;
        return this.roomsMapping.get(roomId);
    }

    leaveRoom(playerId: string, roomId: string): boolean {
        if (!playerId || !roomId) return false;

        const room = this.roomsMapping.get(roomId);
        if (!room) return false;

        room.players.delete(playerId);
        if (room.players.size === 0) {
            this.roomsMapping.delete(roomId);
            return true;
        }

        if (room.hostId === playerId) {
            const nextHost = room.players.keys().next().value;
            room.hostId = nextHost!;
        }
        return true;
    }

    startGame(roomId: string, playerId: string) {
        const room = this.roomsMapping.get(roomId);
        if (!room) {
            console.error('No room found for the given id');
            return;
        }

        if (room.hostId !== playerId) {
            console.error('only hosts can start the game');
            return;
        }

        if (room.state !== ROOM_STATE.WAITING) {
            console.error('Game is already in progress');
            return;
        }

        const playerIds = Array.from(room.players.keys());
        if (playerIds.length < 2) {
            console.error('Need atleast 2 players to start the game');
            return;
        }

        room.drawerQueue = playerIds;
        room.currentDrawerIndex = 0;
        room.drawerId = playerIds[0]!;
        room.round = 1;
        room.state = ROOM_STATE.WORD_SELECTION;

        room.guessedPlayers.clear();
        room.wordOptions = this.getRandomWords(3);
        return room;
    }

    selectWord(roomId: string, playerId: string, word: string) {
        const room = this.roomsMapping.get(roomId);
        if (!room) {
            console.error('Invalid room id');
            return;
        }

        if (room.state !== ROOM_STATE.WORD_SELECTION) {
            console.error('Not in word selection state');
            return;
        }

        if (playerId !== room.drawerId) {
            console.error('You are not the drawer');
            return;
        }

        if (!room.wordOptions.includes(word)) {
            console.error('Inalid word selected');
            return;
        }

        room.word = word;
        room.state = ROOM_STATE.DRAWING;
        room.roundStartTime = Date.now();
        room.wordOptions = [];
        room.drawingHistory = [];
        room.guessedPlayers.clear();

        return room;
    }

    drawStroke(roomId: string, playerId: string, stroke: Stroke) {
        const room = this.roomsMapping.get(roomId);
        if (!room) {
            console.error('Room doesnt exist for the given id');
            return;
        }

        if (room.state !== ROOM_STATE.DRAWING) {
            console.error('Not in drawing state');
            return;
        }

        if (room.drawerId !== playerId) {
            console.error('You are not the drawer');
            return;
        }

        room.drawingHistory.push(stroke);
        return room;
    }

    submitGuess(roomId: string, playerId: string, guess: string) {
        const room = this.roomsMapping.get(roomId);
        if (!room) return;

        if (room.state !== ROOM_STATE.DRAWING) return;

        if (room.drawerId === playerId) return;

        if (room.guessedPlayers.has(playerId)) return;

        const normalizedGuess = guess.trim().toLowerCase();
        const normalizedWord = room.word?.toLowerCase();

        let correct: boolean = false;
        let score = 0;
        let roundEnded = false;
        let gameEnded = false;

        if (normalizedGuess === normalizedWord) {
            correct = true;

            const elapsed = Math.floor((Date.now() - room.roundStartTime!) / 1000);

            const roundDuration = 60;
            const remaining = Math.max(0, roundDuration - elapsed);

            const baseScore = 100;
            const minScore = 10;

            score = Math.max(minScore, Math.floor(baseScore * (remaining / roundDuration)));

            const player = room.players.get(playerId);
            if (player) {
                player.score += score;
            }

            const drawer = room.players.get(room.drawerId!);
            if (drawer) {
                drawer.score += Math.floor(score * 0.5);
            }

            room.guessedPlayers.add(playerId);

            if (room.guessedPlayers.size === room.players.size - 1) {
                roundEnded = true;

                if (
                    room.currentDrawerIndex === room.drawerQueue.length - 1 &&
                    room.round === room.maxRounds
                ) {
                    gameEnded = true;
                }
            }
        }

        return {
            room,
            correct,
            score,
            roundEnded,
            gameEnded,
        };
    }

    nextTurn(roomId: string) {
        const room = this.roomsMapping.get(roomId);
        if (!room) return;

        room.currentDrawerIndex++;

        // if all players finished drawing this round
        if (room.currentDrawerIndex >= room.drawerQueue.length) {
            room.currentDrawerIndex = 0;
            room.round++;

            if (room.round > room.maxRounds) {
                room.state = ROOM_STATE.ROUND_ENDED;
                return { room, gameEnded: true };
            }
        }

        room.drawerId = room.drawerQueue[room.currentDrawerIndex]!;
        room.state = ROOM_STATE.WORD_SELECTION;

        room.word = null;
        room.wordOptions = this.getRandomWords(3);
        room.drawingHistory = [];
        room.guessedPlayers.clear();
        room.roundStartTime = null;

        return {
            room,
            gameEnded: false,
        };
    }

    private getRandomWords(count: number): string[] {
        const shuffled = [...WORD_LIST].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}
