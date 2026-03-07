import type { Player } from './player.types';
import type { ROOM_STATE, Stroke } from './room.types';

// <--------------- CLIENT PAYLOAD TYPES --------------->
export interface CreateRoomPayload {
    username: string;
    sessionId: string;
}

export interface JoinRoomPayload {
    sessionId: string;
    username: string;
    roomId: string;
}

export interface LeaveRoomPayload {
    roomId: string;
}

export interface StartGamePayload {
    roomId: string;
}

export interface DrawPayload {
    points: { x: number; y: number }[];
    color: string;
    brushSize: number;
}

export interface SubmitGuessPayload {
    guess: string;
}

export interface SelectWordPayload {
    word: string;
}

export interface ChatMessageClientPayload {
    message: string;
}

// <--------------- SERVER PAYLOAD TYPES --------------->
export interface RoomIdPayload {
    roomId: string;
}

export interface RoomJoinedPayload {
    roomId: string;
    players: Player[];
    hostId: string;
    drawerId: string | null;
    state: ROOM_STATE;
    round: number;
}

export interface WordOptionsPayload {
    wordOptions: string[];
}

export interface GameStartedPayload {
    roomId: string;
    players: Player[];
    hostId: string;
    drawerId: string | null;
    word: string | null;
    state: ROOM_STATE;
    round: number;
    maxRounds: number;
    drawingHistory: Stroke[];
}

export interface WordSelectedPayload {
    drawerId: string | null;
    round: number;
    roundStartTime: number | null;
}

export interface PlayerGuessedPayload {
    playerId: string;
    username: string;
    guess: string | null;
    correct: boolean;
    score: number;
}

export interface NextDrawerPayload {
    drawerId: string | null;
    round: number;
}

export interface CanvasSyncPayload {
    strokes: Stroke[];
}

export interface RoundEndedPayload {
    roomId: string;
}

export interface RoomStatePayload {
    roomId: string;
    players: Player[];
    hostId: string;
    drawerId: string | null;
    state: ROOM_STATE;
    round: number;
    maxRounds: number;
    drawingHistory: Stroke[];
    roundStartTime: number | null;
}

export interface ChatMessageServerPayload {
    playerId: string;
    username: string;
    correct: boolean;
    score?: number;
    message: string | null;
}
