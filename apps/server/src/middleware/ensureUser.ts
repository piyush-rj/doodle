import { prisma } from "@doodle/database";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import create_user_schema from "../schemas/create_user_schema";

export default async function ensureUser(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.session;

    if (token) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
                userId: string;
                username: string;
            };

            const user = await prisma.user.findUnique({
                where: { id: payload.userId }
            });

            if (user) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastSeenAt: new Date() },
                });
                req.userId = payload.userId;
                return next();
            }
        } catch { }
    }

    const { success, data } = create_user_schema.safeParse(req.body);
    if (!success) {
        res.status(400).json({ success: false, message: "username is required" });
        return;
    }

    try {
        const user = await prisma.user.create({
            data: {
                username: data.username,
                avatarUrl: "",
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
            },
        });

        const newToken = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET!,
            { expiresIn: "24h" }
        );

        res.cookie("session", newToken, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24,
            path: "/",
        });

        req.userId = user.id;
        return next();
    } catch (error) {
        console.error("ensure user error: ", error);
        res.status(500).json({ success: false, message: "Failed to create user" });
    }
}