import { useRef } from 'react';
import WebSocketClient from '../socket/socket.client';
import { SERVER_EVENT_TYPE } from '@doodle/types';

export const useWebSocket = () => {
    const socket = useRef<WebSocketClient | null>(null);

    function subscribeToHandler(type: SERVER_EVENT_TYPE, handler: (payload: unknown) => void) {
        if (!socket.current) {
            console.warn('no socket connection found to subscribe');
            return;
        }
        socket.current.subscribeTohandlers(type, handler);
    }

    function unsubscribeToHandler(type: SERVER_EVENT_TYPE, handler: (payload: unknown) => void) {
        if (!socket.current) {
            console.warn('no socket connection found to unsubscribe');
            return;
        }
        socket.current.unsubscribeToHandler(type, handler);
    }

    return {
        subscribeToHandler,
        unsubscribeToHandler,
    };
};
