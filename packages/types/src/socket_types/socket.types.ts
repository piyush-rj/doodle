export interface SocketMessage<T> {
    id: string;
    payload: T;
    timestamp?: number;
}
