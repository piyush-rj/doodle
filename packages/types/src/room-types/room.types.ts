export interface CreateRoomData {
    maxRounds: number;
    maxPlayers: number;
    roundSecs: number;
}

export interface JoinRoomData {
    code: string;
}