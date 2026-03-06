import type { Player } from './player.types';

export interface Room {
    id: string;
    players: Map<string, Player>;
    hostId: string;
    drawerId: string | null;
    word: string | null;
    state: ROOM_STATE;
    round: number;
    maxRounds: number;
    drawerQueue: string[];
    drawingHistory: Stroke[];
    currentDrawerIndex: number;
    guessedPlayers: Set<string>;
    roundStartTime: number | null;
    wordOptions: string[];
}

export enum ROOM_STATE {
    WAITING = 'WAITING',
    WORD_SELECTION = 'WORD_SELECTION',
    DRAWING = 'DRAWING',
    ROUND_ENDED = 'ROUND_ENDED',
}

export interface Point {
    x: number;
    y: number;
}

export interface Stroke {
    points: Point[];
    color: string;
    brushSize: number;
}

// something like sync canvas should exist that will sync the canvas for a user that joins midgame
