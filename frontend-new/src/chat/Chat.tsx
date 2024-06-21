import React from "react";

const uniqueId = "b7ea1e82-0002-432d-a768-11bdcd186e1d";
export const DATA_TEST_ID = {
  CHAT_CONTAINER: `chat-container-${uniqueId}`,
};

const Chat = () => {
  return <div data-testid={DATA_TEST_ID.CHAT_CONTAINER}></div>;
};

export default Chat;
