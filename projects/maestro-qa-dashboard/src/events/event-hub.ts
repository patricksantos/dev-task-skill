export class EventHub<T> {
  private readonly listeners = new Set<(event: T) => void>();

  publish(event: T): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: (event: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
