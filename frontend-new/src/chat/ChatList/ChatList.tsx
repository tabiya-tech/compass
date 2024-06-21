import React from "react";

const uniqueId = "0397ee51-f637-4453-9e2f-5cc8900c9554";
export const DATA_TEST_ID = {
  CHAT_LIST_CONTAINER: `chat-list-container-${uniqueId}`,
};

const ChatList = () => {
  return <div data-testid={DATA_TEST_ID.CHAT_LIST_CONTAINER}></div>;
};

export default ChatList;
