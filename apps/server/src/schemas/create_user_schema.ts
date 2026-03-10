import { z } from 'zod';

const create_user_schema = z.object({
    username: z.string().min(1).max(30),
    avatarUrl: z.url(),
});

export default create_user_schema;