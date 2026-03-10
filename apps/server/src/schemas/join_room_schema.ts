import z from "zod";

const join_room_schema = z.object({
    code: z.string(),
});

export default join_room_schema;