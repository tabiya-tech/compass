// mute the console
import "src/_test_utilities/consoleMock";

import { AuthBroadcastChannel, AuthChannelMessage } from "src/auth/services/authBroadcastChannel/authBroadcastChannel";
import { act } from "src/_test_utilities/test-utils";

describe("AuthBroadcastChannel", () => {
  let authBroadcastChannel: AuthBroadcastChannel;

  // Mock BroadcastChannel
  beforeAll(() => {
    class MockBroadcastChannel {
      name: string;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(name: string) {
        this.name = name;
      }

      postMessage(message: any) {
        if (this.onmessage) {
          this.onmessage({ data: message } as MessageEvent);
        }
      }

      close() {
        this.onmessage = null;
      }
    }

    // @ts-ignore
    global.BroadcastChannel = MockBroadcastChannel;
  });

  beforeEach(() => {
    authBroadcastChannel = AuthBroadcastChannel.getInstance();
  });

  afterEach(() => {
    (AuthBroadcastChannel as any).instance = undefined;
  });

  test("should register listener and trigger it on broadcast", () => {
    // GIVEN a listener registered for LOGOUT_USER
    const mockCallback = jest.fn();
    authBroadcastChannel.registerListener(AuthChannelMessage.LOGOUT_USER, mockCallback);
    // Ensure the listener has not been called yet
    expect(mockCallback).not.toHaveBeenCalled();

    // WHEN broadcasting LOGOUT_USER message
    act(() => authBroadcastChannel.broadcast(AuthChannelMessage.LOGOUT_USER));

    // THEN listener should be called exactly once
    expect(mockCallback).toHaveBeenCalledTimes(1);
    // AND no errors or warnings should have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should register listener and return unsubscribe which removes the listener", () => {
    const mockCallback = jest.fn();

    // GIVEN a listener registered for LOGOUT_USER and an unsubscribe function returned
    const unsubscribe = authBroadcastChannel.registerListener(AuthChannelMessage.LOGOUT_USER, mockCallback);
    expect(typeof unsubscribe).toBe("function");
    expect(mockCallback).not.toHaveBeenCalled();

    // WHEN broadcasting LOGOUT_USER the first time
    act(() => authBroadcastChannel.broadcast(AuthChannelMessage.LOGOUT_USER));

    // THEN the listener should be called exactly once
    expect(mockCallback).toHaveBeenCalledTimes(1);

    // WHEN unsubscribing and broadcasting again
    unsubscribe();
    act(() => authBroadcastChannel.broadcast(AuthChannelMessage.LOGOUT_USER));

    // THEN the listener should NOT be called again
    expect(mockCallback).toHaveBeenCalledTimes(1);
    // AND no unexpected console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should not trigger listener after channel is closed", () => {
    // GIVEN a listener registered for LOGOUT_USER
    const mockCallback = jest.fn();
    authBroadcastChannel.registerListener(AuthChannelMessage.LOGOUT_USER, mockCallback);

    // WHEN closing the channel
    authBroadcastChannel.closeChannel();

    // AND broadcasting LOGOUT_USER message on a new instance
    const newInstance = AuthBroadcastChannel.getInstance();
    act(() => newInstance.broadcast(AuthChannelMessage.LOGOUT_USER));

    // THEN listener should NOT be called
    expect(mockCallback).not.toHaveBeenCalled();
    // AND no errors or warnings should have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle message events correctly", () => {
    // GIVEN a listener registered for LOGOUT_USER
    const mockCallback = jest.fn();
    authBroadcastChannel.registerListener(AuthChannelMessage.LOGOUT_USER, mockCallback);

    // WHEN simulating a message event from another tab
    const channel = (authBroadcastChannel as any).channel;
    act(() => channel.postMessage(AuthChannelMessage.LOGOUT_USER));

    // THEN the listener should be triggered
    expect(mockCallback).toHaveBeenCalledTimes(1);
    // AND no errors or warnings should have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should log error when broadcast fails", () => {
    // GIVEN a postMessage that throws an error
    jest.spyOn((authBroadcastChannel as any).channel, "postMessage").mockImplementation(() => {
      throw new Error("Broadcast failed");
    });

    // WHEN broadcasting a message
    authBroadcastChannel.broadcast(AuthChannelMessage.LOGOUT_USER);

    // THEN expect error to be logged
    expect(console.error).toHaveBeenCalledWith(new Error("Failed to broadcast message", { cause: expect.any(Error) }));
  });
});
