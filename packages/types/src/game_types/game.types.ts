import type { DIFFICULTY_ENUM, GAME_STATE_ENUM } from './game.enums';

export interface Point {
    x: number;
    y: number;
}

export interface Stroke {
    id: string;
    points: Point[];
    color: string;
    size: number;
    timestamp: number; // ms — used for ordered canvas replay on reconnect
}

export interface Player {
    sessionId: string;
    username: string;
    score: number;
    isHost: boolean;
    hasGuessed: boolean;
    isConnected: boolean;
}

export interface GameState {
    state: GAME_STATE_ENUM;

    currentDrawer?: string; // session_id
    currentRound: number;

    totalRounds: number;
    roundStartTime?: number;
    roundDuration?: number;
}

export interface Room {
    id: string;
    hostId: string;
    players: Player[];
    gameState: GameState;
    maxPlayers: number;
    maxRounds: number;
    difficulty: DIFFICULTY_ENUM;
    drawingHistory: Stroke[];
    guessedPlayers: string[]; // sessionId[]
    createdAt: number;
}
