import { EventEmitter } from 'events';

export type EventHandler<T = any> = (payload: T) => void;

export class EventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Subscribe to an event topic.
   * @param topic The event topic string.
   * @param handler The callback function to execute when the event is published.
   * @returns A function to unsubscribe this specific handler.
   */
  public subscribe<T>(topic: string, handler: EventHandler<T>): () => void {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler);
  }

  /**
   * Publish an event to a topic.
   * @param topic The event topic string.
   * @param payload The data to send to subscribers.
   */
  public publish<T>(topic: string, payload: T): void {
    this.emitter.emit(topic, payload);
  }
}
