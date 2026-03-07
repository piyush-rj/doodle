import { ClientMessage, SERVER_EVENT_TYPE, ServerMessage } from '@doodle/types';

type Listener = (payload: unknown) => void;

export default class WebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private listeners: Map<SERVER_EVENT_TYPE, Listener[]> = new Map();
    private reconnectAttempts: number = 0;
    private reconnectDelay: number = 1000;
    private maxReconnectAttempts: number = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private maxReconnectDelay: number = 10000;
    private persistentReconnectDelay: number = 5000;
    private messageQueue: ClientMessage[] = [];
    private manualClose: boolean = false;
    private isConnected: boolean = false;
    private reconnectPayload: ClientMessage | null = null;

    constructor(url: string) {
        this.url = url;
        this.initConnection();
    }

    private initConnection() {
        if (this.manualClose) return;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('ws connected');

            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;

            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }

            if (this.reconnectPayload) {
                this.sendMessage(this.reconnectPayload);
            }
            this.flushQueue();
        };

        this.ws.onmessage = (event: MessageEvent<string>) => {
            try {
                const parsed: ServerMessage = JSON.parse(event.data);
                this.handleIncomingMessage(parsed);
            } catch (error) {
                console.error('Inavlid ws message: ', error);
                return;
            }
        };

        this.ws.onclose = () => {
            console.log('ws closed');

            this.isConnected = false;
            this.ws = null;
            if (!this.manualClose) {
                this.attemptRecconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('Websocket error: ', error);
        };
    }

    public handleIncomingMessage(parsedMessage: ServerMessage) {
        try {
            const { type, payload } = parsedMessage;
            const handlers = this.listeners.get(type);

            if (handlers) {
                handlers.forEach((handler) => handler(payload));
            }
        } catch (err) {
            console.error('Failed to process incoming message: ', err);
            return;
        }
    }

    public subscribeTohandlers(eventType: SERVER_EVENT_TYPE, handler: Listener) {
        try {
            if (!this.listeners.has(eventType)) {
                this.listeners.set(eventType, []);
            }
            if (!this.listeners.get(eventType)?.includes(handler)) {
                this.listeners.get(eventType)?.push(handler);
            }
        } catch (error) {
            console.error('Failed to subscribe to handler: ', error);
            return;
        }
    }

    public unsubscribeToHandler(eventType: SERVER_EVENT_TYPE, handler: Listener) {
        try {
            const handlers = this.listeners.get(eventType);
            if (!handlers) return;

            const index = handlers?.indexOf(handler);
            if (index !== -1) {
                handlers?.splice(index!, 1);
            }

            if (handlers?.length === 0) {
                this.listeners.delete(eventType);
            }
        } catch (err) {
            console.error('Failed to unsubscribe to handler: ', err);
            return;
        }
    }

    public close() {
        try {
            this.manualClose = true;

            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }

            if (
                this.ws &&
                (this.ws.readyState === WebSocket.OPEN ||
                    this.ws.readyState === WebSocket.CONNECTING)
            ) {
                this.ws.close(1000, 'Client closed connection');
            }

            this.isConnected = false;
            this.messageQueue = [];
            this.listeners.clear();
        } catch (err) {
            console.error('Failed to close the socket connection: ', err);
            return;
        }
    }

    public sendMessage(message: ClientMessage) {
        try {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(message));
            } else {
                this.messageQueue.push(message);
            }
        } catch (err) {
            console.error('Failed to send messagE: ', err);
            return;
        }
    }

    private attemptRecconnect() {
        if (this.manualClose) return;

        this.reconnectAttempts++;

        let delay: number;

        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            delay = this.reconnectDelay;
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        } else {
            console.warn(
                `Max reconnection attempts (${this.maxReconnectAttempts}) reached. Switching to persistent reconnection mode.`,
            );
            delay = this.persistentReconnectDelay;
            this.reconnectDelay = 1000;
        }
        this.reconnectTimeout = setTimeout(() => {
            if (!this.manualClose) {
                this.initConnection();
            }
        }, delay);
    }

    private flushQueue() {
        try {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

            while (this.messageQueue.length > 0) {
                const msg = this.messageQueue.shift();
                if (!msg) continue;
                this.ws.send(JSON.stringify(msg));
            }
        } catch (err) {
            console.error('Failed to clear the queue: ', err);
        }
    }

    public setReconnectPayload(payload: ClientMessage) {
        this.reconnectPayload = payload;
    }

    public getStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length,
            isManuallyClosed: this.manualClose,
        };
    }
}
