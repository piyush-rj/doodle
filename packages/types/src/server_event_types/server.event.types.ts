import type { SERVER_EVENT_ENUM } from "./server.enums";
import type {
    SessionInitPayload,
    RoomCreatedPayload,
    RoomJoinedPayload,
    PlayerJoinedPayload,
    PlayerLeftPayload,
    PlayerReconnectedPayload,
    GameStartedPayload,
    RoundStartedPayload,
    WordToDrawPayload,
    WordHintPayload,
    HintRevealedPayload,
    RoundEndedPayload,
    GameEndedPayload,
    WordOptionsPayload,
    WaitingForWordPayload,
    CanvasUpdatedPayload,
    CanvasClearedPayload,
    StrokeUndonePayload,
    PlayerGuessedPayload,
    ScoreUpdatedPayload,
    TimerSyncPayload,
    TurnTimeoutPayload,
    ErrorPayload,
    ServerChatMessagePayload,
} from "./server.payload.types";

export type ServerEvent =
    | { type: SERVER_EVENT_ENUM.SESSION_INIT;        payload: SessionInitPayload }
    | { type: SERVER_EVENT_ENUM.ROOM_CREATED;        payload: RoomCreatedPayload }
    | { type: SERVER_EVENT_ENUM.ROOM_JOINED;         payload: RoomJoinedPayload }
    | { type: SERVER_EVENT_ENUM.PLAYER_JOINED;       payload: PlayerJoinedPayload }
    | { type: SERVER_EVENT_ENUM.PLAYER_LEFT;         payload: PlayerLeftPayload }
    | { type: SERVER_EVENT_ENUM.PLAYER_RECONNECTED;  payload: PlayerReconnectedPayload }
    | { type: SERVER_EVENT_ENUM.GAME_STARTED;        payload: GameStartedPayload }
    | { type: SERVER_EVENT_ENUM.ROUND_STARTED;       payload: RoundStartedPayload }
    | { type: SERVER_EVENT_ENUM.WORD_TO_DRAW;        payload: WordToDrawPayload }
    | { type: SERVER_EVENT_ENUM.WORD_HINT;           payload: WordHintPayload }
    | { type: SERVER_EVENT_ENUM.HINT_REVEALED;       payload: HintRevealedPayload }
    | { type: SERVER_EVENT_ENUM.ROUND_ENDED;         payload: RoundEndedPayload }
    | { type: SERVER_EVENT_ENUM.GAME_ENDED;          payload: GameEndedPayload }
    | { type: SERVER_EVENT_ENUM.WORD_OPTIONS;        payload: WordOptionsPayload }
    | { type: SERVER_EVENT_ENUM.WAITING_FOR_WORD;    payload: WaitingForWordPayload }
    | { type: SERVER_EVENT_ENUM.CANVAS_UPDATED;      payload: CanvasUpdatedPayload }
    | { type: SERVER_EVENT_ENUM.CANVAS_CLEARED;      payload: CanvasClearedPayload }
    | { type: SERVER_EVENT_ENUM.STROKE_UNDONE;       payload: StrokeUndonePayload }

    | { type: SERVER_EVENT_ENUM.PLAYER_GUESSED;      payload: PlayerGuessedPayload }
    | { type: SERVER_EVENT_ENUM.SCORE_UPDATED;       payload: ScoreUpdatedPayload }
    | { type: SERVER_EVENT_ENUM.CHAT_MESSAGE;        payload: ServerChatMessagePayload }

    | { type: SERVER_EVENT_ENUM.TIMER_SYNC;          payload: TimerSyncPayload }
    | { type: SERVER_EVENT_ENUM.TURN_TIMEOUT;        payload: TurnTimeoutPayload }

    | { type: SERVER_EVENT_ENUM.ERROR;               payload: ErrorPayload };


/** Extract the payload type for a specific server event */
export type ServerEventPayload<T extends SERVER_EVENT_ENUM> = Extract<
    ServerEvent,
    { type: T }
>["payload"];