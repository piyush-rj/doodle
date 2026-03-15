export enum GAME_STATE_ENUM {
    WAITING = 'WAITING',
    WORD_SELECTION = 'WORD_SELECTION',
    DRAWING = 'DRAWING',
    ROUND_END = 'ROUND_END',
    GAME_END = 'GAME_END',
}

export enum DIFFICULTY_ENUM {
    EASY = 'EASY',
    MEDIUM = 'MEDIUM',
    HARD = 'HARD',
}

export enum PLAYER_LEFT_REASON_ENUM {
    DISCONNECT = 'DISCONNECT',
    LEAVE = 'LEAVE',
    // todo: add kick here
}
