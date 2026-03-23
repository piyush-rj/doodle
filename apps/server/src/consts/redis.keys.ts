export const keys = {
    session: (sessionId: string) => `session:${sessionId}`,
    room: (roomId: string) => `room:${roomId}`,
    roomPlayers: (roomId: string) => `room:${roomId}:players`,
    roomScores: (roomId: string) => `room:${roomId}:scores`,
    roomHistory: (roomId: string) => `room:${roomId}:history`,
    roomChannel: (roomId: string) => `pubsub:room:${roomId}`,
    roomWordOptions: (roomId: string) => `room:${roomId}:wordOptions`,
    scheduled: 'scheduled:events',
};

export const TTL = {
    SESSION: 600, // 10 min
    ROOM: 7200, // 2 hr
};
