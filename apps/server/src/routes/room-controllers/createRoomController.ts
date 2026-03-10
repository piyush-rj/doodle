import { prisma } from "@doodle/database";
import type { Request, Response } from "express";
import create_room_schema from "../../schemas/create_room_schema";
import { GAME_STATUS } from "../../../../../packages/types/src";
import RoomServices from "../../services/RoomServices";

export default async function createRoomController(req: Request, res: Response) {
    if(!req.userId) {
        res.status(400).json({
            message: 'Failed to create user',
        });
        return;
    }
        
    const { data,success} = create_room_schema.safeParse(req.body);
    if (!success) {
        res.status(403).json({
            message: "Invalid room creation data.",
        });
        return;
    }

    try {
        await prisma.game.deleteMany({
            where: {
                hostId: req.userId,
                status: { in: [GAME_STATUS.WAITING, GAME_STATUS.IN_PROGRESS] },
            },
        });

        const room = await RoomServices.create_room(req.userId, data);
        if (!room) {
            res.status(503).json({
                message: 'Failed to create room',
            });
            return;
        }

        res.status(201).json({
            room,
            message: 'Created room successfully',
        });
    } catch (error) {
        console.error('CREATE_ROOM_ERROR: ',error);
        return;
    }
}