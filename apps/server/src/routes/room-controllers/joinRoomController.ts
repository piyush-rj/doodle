import type { Request, Response } from "express";
import join_room_schema from "../../schemas/join_room_schema";
import RoomServices from "../../services/RoomServices";

export default async function joinRomController(req: Request, res: Response) {
    if (!req.userId) {
        res.status(403).json({
            message: 'user not found',
        });
        return;
    }
    const { data, success } = join_room_schema.safeParse(req.body);
    if (!success) {
        res.status(403).json({
            message: 'Invalid room join data',
        });
        return;
    }

    try {
        const room = await RoomServices.join_room(req.userId, data);
    } catch (error) {
        
    }
}