import z from "zod";

const create_room_schema = z.object({
    username: z.string().min(1).max(30),
    maxRounds: z.number().min(1).max(5).default(3),
    maxPlayers: z.number().min(2).max(8),
    roundSecs: z.number(),
});

export default create_room_schema;  