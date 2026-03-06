import type {
    CanvasSyncPayload,
    CreateRoomPayload,
    DrawPayload,
    GameStartedPayload,
    JoinRoomPayload,
    LeaveRoomPayload,
    NextDrawerPayload,
    PlayerGuessedPayload,
    RoomIdPayload,
    RoomJoinedPayload,
    RoomStatePayload,
    RoundEndedPayload,
    SelectWordPayload,
    StartGamePayload,
    SubmitGuessPayload,
    WordOptionsPayload,
    WordSelectedPayload,
} from './socket.payload.types';

export interface ClientEvent<T = unknown> {
    type: CLIENT_EVENT_TYPE;
    payload: T;
}

export enum CLIENT_EVENT_TYPE {
    CREATE_ROOM = 'CREATE_ROOM',
    JOIN_ROOM = 'JOIN_ROOM',
    LEAVE_ROOM = 'LEAVE_ROOM',

    START_GAME = 'START_GAME',
    SELECT_WORD = 'SELECT_WORD',

    DRAW_STROKE = 'DRAW_STROKE',
    UNDO_STROKE = 'UNDO_STROKE',
    CLEAR_CANVAS = 'CLEAR_CANVAS',

    SUBMIT_GUESS = 'SUBMIT_GUESS',
}

export type ClientMessage =
    | { type: CLIENT_EVENT_TYPE.CREATE_ROOM; payload: CreateRoomPayload }
    | { type: CLIENT_EVENT_TYPE.JOIN_ROOM; payload: JoinRoomPayload }
    | { type: CLIENT_EVENT_TYPE.LEAVE_ROOM; payload: LeaveRoomPayload }
    | { type: CLIENT_EVENT_TYPE.START_GAME; payload: StartGamePayload }
    | { type: CLIENT_EVENT_TYPE.SELECT_WORD; payload: SelectWordPayload }
    | { type: CLIENT_EVENT_TYPE.DRAW_STROKE; payload: DrawPayload }
    | { type: CLIENT_EVENT_TYPE.UNDO_STROKE; payload: {} }
    | { type: CLIENT_EVENT_TYPE.CLEAR_CANVAS; payload: {} }
    | { type: CLIENT_EVENT_TYPE.SUBMIT_GUESS; payload: SubmitGuessPayload };

export enum SERVER_EVENT_TYPE {
    ROOM_CREATED = 'ROOM_CREATED',
    ROOM_JOINED = 'ROOM_JOINED',
    ROOM_LEFT = 'ROOM_LEFT',
    ROOM_STATE = 'ROOM_STATE',

    GAME_STARTED = 'GAME_STARTED',
    WORD_SELECTED = 'WORD_SELECTED',
    DRAWING_EVENT = 'DRAWING_EVENT',
    PLAYER_GUESSED = 'PLAYER_GUESSED',

    WORD_OPTIONS = 'WORD_OPTIONS',
    NEXT_DRAWER = 'NEXT_DRAWER',
    CANVAS_SYNC = 'CANVAS_SYNC',

    ROUND_ENDED = 'ROUND_ENDED',
    SERVER_ERROR = 'SERVER_ERROR',
}

export type ServerMessage =
    | { type: SERVER_EVENT_TYPE.ROOM_CREATED; payload: RoomIdPayload }
    | { type: SERVER_EVENT_TYPE.ROOM_JOINED; payload: RoomJoinedPayload }
    | { type: SERVER_EVENT_TYPE.ROOM_LEFT; payload: RoomIdPayload }
    | { type: SERVER_EVENT_TYPE.GAME_STARTED; payload: GameStartedPayload }
    | { type: SERVER_EVENT_TYPE.WORD_OPTIONS; payload: WordOptionsPayload }
    | { type: SERVER_EVENT_TYPE.WORD_SELECTED; payload: WordSelectedPayload }
    | { type: SERVER_EVENT_TYPE.DRAWING_EVENT; payload: DrawPayload }
    | { type: SERVER_EVENT_TYPE.PLAYER_GUESSED; payload: PlayerGuessedPayload }
    | { type: SERVER_EVENT_TYPE.NEXT_DRAWER; payload: NextDrawerPayload }
    | { type: SERVER_EVENT_TYPE.SERVER_ERROR; payload: { message: string } }
    | { type: SERVER_EVENT_TYPE.CANVAS_SYNC; payload: CanvasSyncPayload }
    | { type: SERVER_EVENT_TYPE.ROUND_ENDED; payload: RoundEndedPayload }
    | { type: SERVER_EVENT_TYPE.ROOM_STATE; payload: RoomStatePayload };
