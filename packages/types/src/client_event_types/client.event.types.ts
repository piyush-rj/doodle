import type { CLIENT_EVENT_ENUM } from "./client.event.enums";
import type {
    CreateRoomPayload,
    JoinRoomPayload,
    LeaveRoomPayload,
    StartGamePayload,
    SelectWordPayload,
    DrawStrokePayload,
    ClearCanvasPayload,
    UndoStrokePayload,
    SubmitGuessPayload,
    ReconnectPayload,
    ChatMessagePayload,
} from "./client.payload.types";

export type ClientEvent =
    | { type: CLIENT_EVENT_ENUM.CREATE_ROOM;   payload: CreateRoomPayload }
    | { type: CLIENT_EVENT_ENUM.JOIN_ROOM;     payload: JoinRoomPayload }
    | { type: CLIENT_EVENT_ENUM.LEAVE_ROOM;    payload: LeaveRoomPayload }
    | { type: CLIENT_EVENT_ENUM.START_GAME;    payload: StartGamePayload }
    | { type: CLIENT_EVENT_ENUM.SELECT_WORD;   payload: SelectWordPayload }
    | { type: CLIENT_EVENT_ENUM.DRAW_STROKE;   payload: DrawStrokePayload }
    | { type: CLIENT_EVENT_ENUM.CLEAR_CANVAS;  payload: ClearCanvasPayload }
    | { type: CLIENT_EVENT_ENUM.UNDO_STROKE;   payload: UndoStrokePayload }
    | { type: CLIENT_EVENT_ENUM.SUBMIT_GUESS;  payload: SubmitGuessPayload }
    | { type: CLIENT_EVENT_ENUM.RECONNECT;     payload: ReconnectPayload }
    | { type: CLIENT_EVENT_ENUM.CHAT_MESSAGE;  payload: ChatMessagePayload };


export type ClientEventPayload<T extends CLIENT_EVENT_ENUM> = Extract<
    ClientEvent,
    { type: T }
>["payload"];