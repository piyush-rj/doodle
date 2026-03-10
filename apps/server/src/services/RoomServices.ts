import { prisma } from "@doodle/database";
import { GAME_STATUS, type CreateRoomData, type JoinRoomData } from "@doodle/types";

export default class RoomServices {
    static async create_room(userId: string, payload: CreateRoomData) {
        try {
            const { maxRounds, maxPlayers, roundSecs } = payload;

            if (!payload || !userId) {
                console.error('Insufficient creds');
                return;
            }

            const room = await prisma.game.create({
                data: {
                    hostId: userId,
                    maxPlayers,
                    maxRounds,
                    roundSecs,
                    code: 'ROOM-CODE',
                    status: GAME_STATUS.WAITING,
                },
            });

            return room;
        } catch (error) {
            console.error('Failed to create room: ', error);
            return;
        }
    }

    static async join_room(userId: string, payload: JoinRoomData) {
        try {
            const { code } = payload;
            if (!payload || !userId) {
                console.error('Insufficient creds');
                return;
            }

            const room = await prisma.game.findUnique({
                where: {
                    code,
                },
            });

            if (!room) {
                console.error('Room not found');
                return;
            }

        } catch (error) {
            console.error('Failed to join room: ', error);
            return;
        }
    }

    static async startGame(gameId: string) {
        return prisma.game.update({
            where: { id: gameId },
            data: {
                status: GAME_STATUS.IN_PROGRESS,
                startedAt: new Date()
            },
        });
    }

    static async endGame(gameId: string) {
        return prisma.game.update({
            where: {
                id: gameId
            },
            data: {
                status: GAME_STATUS.ENDED,
                endedAt: new Date()
            },
        });
    }
}