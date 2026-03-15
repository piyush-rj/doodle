import type { Player, Room, Stroke } from "../game_types/game.types";
import type { PLAYER_LEFT_REASON_ENUM } from "../game_types/game.enums";

export interface SessionInitPayload {
    sessionId: string;
}

export interface RoomCreatedPayload {
    room: Room;
}

export interface RoomJoinedPayload {
    room: Room;
    sessionId: string;
}

export interface PlayerJoinedPayload {
    player: Player;
}

export interface PlayerLeftPayload {
    sessionId: string;
    username: string;
    temporary: boolean; // true -> reconnect can be done, false -> left/ kicked
    reason: PLAYER_LEFT_REASON_ENUM;
}

export interface PlayerReconnectedPayload {
    player: Player;
}

export interface GameStartedPayload {
    firstDrawerId: string;
    firstDrawerUsername: string;
}

export interface RoundStartedPayload {
    drawerId: string;
    drawerUsername: string;
    roundNumber: number;
    totalRounds: number;
    roundDuration: number;
}

// sent to drawer
export interface WordToDrawPayload {
    word: string;
    timeLimit: number;
}

// sent to everyone except drawer
export interface WordHintPayload {
    drawerId: string;
    wordLength: number;
    hint: string;
    timeLimit: number;
}

export interface HintRevealedPayload {
    hint: string;
    revealedAt: number;
}

export interface RoundEndedPayload {
    word: string; // answer broadcast
    players: Player[]; // players and scores
}

export interface GameEndedPayload {
    players: Player[]; // final leaderboard
}


// sent to drawer
export interface WordOptionsPayload {
    words: string[];
    timeToSelect: number; // else autoselect
}

// broadcast to everyone except drawer
export interface WaitingForWordPayload {
    drawerId: string;
    drawerUsername: string;
}

export interface CanvasUpdatedPayload {
    stroke: Stroke;
}

export interface CanvasClearedPayload {
    roomId: string;
}

export interface StrokeUndonePayload {
    strokeId: string;
}

export interface PlayerGuessedPayload {
    sessionId: string;
    username: string;
    pointsEarned: number;
    guessedAt: number;
}

export interface ScoreUpdatedPayload {
    players: Player[];  // full updated player list with new scores
}


// Broadcast every ~5s to correct client-side timer drift
export interface TimerSyncPayload {
    timeRemaining: number;  // seconds
    serverTime: number;     // epoch ms — lets client calculate local drift
}

// Sent when the round ends because time ran out (vs all players guessing)
export interface TurnTimeoutPayload {
    word: string;           // reveal the word on timeout
}

export interface ServerChatMessagePayload {
    sessionId: string;
    username: string;
    message: string;
    timestamp: number;
    isSystem: boolean;
}

export interface ErrorPayload {
    code: string;
    message: string;
}