const CHANNEL_NAME = "auth-channel";

export enum AuthChannelMessage {
  LOGOUT_USER = "LOGOUT_USER",
  // Add more events here in the future
}

export class AuthBroadcastChannel {
  private readonly channel: BroadcastChannel;
  private static instance: AuthBroadcastChannel;
  private listeners: Partial<Record<AuthChannelMessage, (() => void)[]>> = {};

  private constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = this.handleMessage;
  }

  static getInstance(): AuthBroadcastChannel {
    if (!AuthBroadcastChannel.instance) {
      AuthBroadcastChannel.instance = new AuthBroadcastChannel();
    }
    return AuthBroadcastChannel.instance;
  }

  /**
   * Register a listener for a specific message
   */
  registerListener(message: AuthChannelMessage, callback: () => void) {
    const listeners = (this.listeners[message] ??= []);
    listeners.push(callback);

    // Return an unsubscribe function
    return () => {
      const arr = this.listeners[message];
      if (!arr) return;
      const idx = arr.indexOf(callback);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  /**
   * Broadcast a message to other tabs
   */
  broadcast(message: AuthChannelMessage) {
    try {
      this.channel.postMessage(message);
    } catch (err) {
      console.error(new Error("Failed to broadcast message", { cause: err }));
    }
  }

  /**
   * Close the channel
   */
  closeChannel() {
    this.listeners = {};
    try {
      this.channel.close();
    } catch {
      /* no-op */
    }
    AuthBroadcastChannel.instance = undefined!;
  }

  /**
   * Internal message handler
   */
  private readonly handleMessage = (event: MessageEvent) => {
    const message = event.data as AuthChannelMessage;
    this.listeners[message]?.forEach((cb) => cb());
  };
}
