export enum TARGET_USER_TYPE {
    ROOM = 'ROOM',
    PLAYER = 'PLAYER',
    EXCEPT = 'EXCEPT',
}

export interface TargetMessageType {
    type: TARGET_USER_TYPE;
    playerId?: string;
}
