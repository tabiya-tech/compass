const CHANNEL_NAME = "auth-channel";

export enum AuthChannelMessage {
  LOGOUT_USER = "LOGOUT_USER",
  LOGIN_USER = "LOGIN_USER",
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
    } catch (e) {
      // ignore error
      console.error(new Error("Failed to close AuthBroadcastChanel", { cause: e }));
    }

    AuthBroadcastChannel.instance = undefined!;
  }

  /**
   * Internal message handler
   */
  private readonly handleMessage = (event: MessageEvent) => {
    const message = event.data as AuthChannelMessage;

    this.listeners[message]?.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        // ignore the error so that at least other listeners can be called
        console.error(new Error(`Failed to handle AuthBroadcastChanel.message: ${message}`, { cause: e }));
      }
    });
  };
}
