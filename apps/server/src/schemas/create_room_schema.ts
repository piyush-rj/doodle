import { DIFFICULTY_ENUM, GAME_STATE_ENUM } from '@doodle/types';
import { z } from 'zod';

export const room_schema = z.object({
    id: z.string(),
    hostId: z.string(),
    status: z.enum(GAME_STATE_ENUM),
    currentDrawer: z.string(),
    currentWord: z.string(),
    currentRound: z.string().transform(Number),
    totalRounds: z.string().transform(Number),
    maxPlayers: z.string().transform(Number),
    roundDuration: z.string().transform(Number),
    roundEndsAt: z.string().transform(Number),
    drawerTimeoutEndsAt: z.string().transform(Number),
    difficulty: z.enum(DIFFICULTY_ENUM),
    createdAt: z.string().transform(Number),
});

export default room_schema;
