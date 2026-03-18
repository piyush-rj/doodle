import { DIFFICULTY_ENUM, SERVER_EVENT_ENUM, type CreateRoomPayload } from '@doodle/types';
import { v4 as uuid } from 'uuid';
import type { CustomWebSocket } from '../types/socket.types';
import SessionService from '../services/SessionServices';
import RoomServices from '../services/RoomServices';
import SocketRegistry from '../socket/socket.registry';

export default class RoomHandlers {
    public async handleCreateRoom(socket: CustomWebSocket, payload: CreateRoomPayload) {
        if (!payload?.username) {
            return;
        }

        const sessionId = payload.sessionId ?? uuid();
        const roomId = uuid();

        await RoomServices.create({
            roomId,
            hostId: sessionId,
            maxPlayers: payload.maxPlayers ?? 8,
            totalRounds: payload.maxRounds ?? 3,
            roundDuration: 80,
            difficulty: payload.difficulty ?? DIFFICULTY_ENUM.MEDIUM,
        });
        await RoomServices.addPlauyer(roomId, sessionId);
        await SessionService.create({
            sessionId,
            username: payload.username,
            roomId,
            isConnected: true,
        });

        socket.sessionId = sessionId;
        socket.username = payload.username;
        socket.roomId = roomId;
        SocketRegistry.register(sessionId, socket);

        const room = await RoomServices.buildSnapshot(roomId);
        if (!room) return;

        SocketRegistry.send(sessionId, {
            type: SERVER_EVENT_ENUM.SESSION_INIT,
            payload: { sessionId },
        });
        SocketRegistry.send(sessionId, { type: SERVER_EVENT_ENUM.ROOM_CREATED, payload: { room } });
    }
}
