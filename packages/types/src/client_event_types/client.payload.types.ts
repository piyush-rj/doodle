import type { Stroke } from "../game_types/game.types";
import type { DIFFICULTY_ENUM } from "../game_types/game.enums";

export interface CreateRoomPayload {
    username: string;
    maxPlayers?: number;
    maxRounds?: number;
    difficulty?: DIFFICULTY_ENUM;
    sessionId?: string;
}

export interface JoinRoomPayload {
    roomId: string;
    username: string;
    sessionId?: string;
}

export interface LeaveRoomPayload {
    roomId: string;
}

export interface StartGamePayload {
    roomId: string;
}

export interface SelectWordPayload {
    roomId: string;
    word: string;
}

export interface DrawStrokePayload {
    roomId: string;
    stroke: Stroke;
}

export interface ClearCanvasPayload {
    roomId: string;
}

export interface UndoStrokePayload {
    roomId: string;
    strokeId: string;           // id of the stroke to remove
}

export interface SubmitGuessPayload {
    roomId: string;
    guess: string;
}

export interface ReconnectPayload {
    sessionId: string;
    roomId: string;
}

export interface ChatMessagePayload {
    roomId: string;
    message: string;
}

