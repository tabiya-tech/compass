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
    this.channel.close();
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
