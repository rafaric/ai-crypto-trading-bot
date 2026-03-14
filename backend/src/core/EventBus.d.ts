export type EventHandler<T = any> = (payload: T) => void;
export declare class EventBus {
    private emitter;
    constructor();
    /**
     * Subscribe to an event topic.
     * @param topic The event topic string.
     * @param handler The callback function to execute when the event is published.
     * @returns A function to unsubscribe this specific handler.
     */
    subscribe<T>(topic: string, handler: EventHandler<T>): () => void;
    /**
     * Publish an event to a topic.
     * @param topic The event topic string.
     * @param payload The data to send to subscribers.
     */
    publish<T>(topic: string, payload: T): void;
}
