import type { DIFFICULTY_ENUM, GAME_STATE_ENUM } from '@doodle/types';

export interface RoomHash {
    id: string;
    hostId: string;
    status: GAME_STATE_ENUM;
    currentDrawer: string;
    currentWord: string;
    currentRound: number;
    totalRounds: number;
    maxPlayers: number;
    roundDuration: number;
    roundEndsAt: number;
    guessedPlayers: string[];
    drawerTimeoutEndsAt: number;
    difficulty: DIFFICULTY_ENUM;
    createdAt: number;
}
