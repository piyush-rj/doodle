import { Router } from "express";
import createRoomController from "./room-controllers/createRoomController";
import ensureUser from "../middleware/ensureUser";

const router = Router();

router.post('/create-room', ensureUser, createRoomController);

export default router;