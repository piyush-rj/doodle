import type { CustomWebSocket } from '../../../../apps/server/src/types/socket_types';

export interface Player {
    id: string;
    username: string;
    score: number;
    // think about this
    hasGuessed: boolean;
}
