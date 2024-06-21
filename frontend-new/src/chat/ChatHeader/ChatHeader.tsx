import React from "react";

const uniqueId = "7413b63a-887b-4f41-b930-89e9770db12b";
export const DATA_TEST_ID = {
  CHAT_HEADER_CONTAINER: `chat-header-container-${uniqueId}`,
};

const ChatHeader = () => {
  return <div data-testid={DATA_TEST_ID.CHAT_HEADER_CONTAINER}></div>;
};

export default ChatHeader;
