import { GAME_STATE_ENUM, SERVER_EVENT_ENUM } from '@doodle/types';
import RoomServices from '../services/RoomServices';
import PubSubService from '../services/PubSubService';
import SchedulerService from '../services/SchedulerService';

export async function handleRoundExpired(roomId: string) {
    const room = await RoomServices.get(roomId);
    if (!room || room.status !== GAME_STATE_ENUM.DRAWING) return;

    // guard: round may have already ended early (everyone guessed)
    if (Date.now() < room.roundEndsAt) return;

    await RoomServices.updateStatus(roomId, GAME_STATE_ENUM.ROUND_END);
    await RoomServices.clearHistory(roomId);

    await PubSubService.publish(roomId, {
        type: SERVER_EVENT_ENUM.ROUND_ENDED,
        payload: { word: room.currentWord, players: [] },
    });
}

export async function handleDrawerTimeoutExpired(sessionId: string, roomId: string) {
    const room = await RoomServices.get(roomId);
    if (!room || room.status !== GAME_STATE_ENUM.DRAWING) return;

    // guard: drawer reconnected within the 10s window
    if (room.currentDrawer !== sessionId || room.drawerTimeoutEndsAt === 0) return;

    await RoomServices.clearDrawerTimeout(roomId);

    await PubSubService.publish(roomId, {
        type: SERVER_EVENT_ENUM.TURN_TIMEOUT,
        payload: { word: room.currentWord },
    });
}

export function startScheduler() {
    setInterval(async () => {
        const due = await SchedulerService.getDue();

        for (const event of due) {
            if (event.type === 'round') handleRoundExpired(event.roomId);
            if (event.type === 'drawer') handleDrawerTimeoutExpired(event.sessionId, event.roomId);
        }
    }, 1000);
}
