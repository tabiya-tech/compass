import React from "react";

const uniqueId = "2a76494f-351d-409d-ba58-e1b2cfaf2a53";
export const DATA_TEST_ID = {
  CHAT_MESSAGE_FIELD_CONTAINER: `chat-message-field-container-${uniqueId}`,
};

const ChatMessageField = () => {
  return <div data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER}></div>;
};

export default ChatMessageField;
