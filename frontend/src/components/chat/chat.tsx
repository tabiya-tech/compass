import React, { useEffect, useMemo, useState } from "react";
import axios, { AxiosResponse } from "axios";
import { ChatList } from "./chat-list";
import { generateTabiyaMessageFromResponse, generateUserMessageFromResponse, Message } from "@/app/data";

interface ChatProps {
  isMobile: boolean;
  sessionId: number;
}

export function Chat({ isMobile, sessionId }: Readonly<ChatProps>) {
  const [messagesState, setMessagesState] = useState<Message[]>([]);

  const START_PROMPT = "~~~START_CONVERSATION~~~";

  // Helper function to add a new message
  const addMessage = (message: Message) => {
    setMessagesState((prevMessages) => [...prevMessages, message]);
  };

  // Typing state
  const setTyping = useMemo(
    () => (typing: boolean) => {
      if (typing) {
        addMessage({
          id: Math.floor(Math.random() * 1000),
          avatar: "/tabiya.png",
          name: "Tabiya",
          message: "Typing...",
        });
      } else {
        setMessagesState((prevMessages) => prevMessages.filter((message) => message.message !== "Typing..."));
      }
    },
    []
  );

  const getConversationFromHistory = useMemo(
    () => async (): Promise<AxiosResponse> => {
      console.log("Getting conversation history");
      setTyping(true);
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_COMPASS_URL}${process.env.NEXT_PUBLIC_COMPASS_ENDPOINT}?user_input=${START_PROMPT}&session_id=${sessionId}`
        );
        console.log({ data: response.data });
        setTyping(false);
        response.data.conversation_context.history.turns.forEach((historyItem: any) => {
          console.log(
            START_PROMPT,
            historyItem.input.message,
            historyItem.output.message_for_user,
            historyItem.input.message === START_PROMPT
          );
          const userMessage =
            historyItem.input.message !== START_PROMPT && generateUserMessageFromResponse(historyItem.input.message);
          const tabiyaMessage = generateTabiyaMessageFromResponse(historyItem.output.message_for_user);
          if (userMessage) addMessage(userMessage);
          addMessage(tabiyaMessage);
        });
        return response;
      } catch (error) {
        setTyping(false);
        console.error(error);
        throw error;
      }
    },
    [setTyping]
  );

  const getConversation = useMemo(
    () => async () => {
      console.log("Starting conversation");
      try {
        const response = await getConversationFromHistory();
        console.log({ data: response.data });
      } catch (error) {
        console.error(error);
      }
    },
    [getConversationFromHistory]
  );

  const sendMessage = async (newMessage: Message) => {
    addMessage(newMessage);
    setTyping(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_COMPASS_URL}${process.env.NEXT_PUBLIC_COMPASS_ENDPOINT}?user_input=${encodeURIComponent(newMessage.message)}&session_id=${sessionId}`
      );
      console.log({ data: response.data.last });
      const tabiyaResponse = generateTabiyaMessageFromResponse(response.data.last.message_for_user);
      addMessage(tabiyaResponse);
      setTyping(false);
    } catch (error) {
      console.error(error);
      setTyping(false);
    }
  };

  useEffect(() => {
    if (messagesState.length === 0) {
      getConversation();
    }
  }, [getConversation, messagesState.length]);

  return (
    <div className="flex flex-col justify-between w-full h-full">
      <ChatList messages={messagesState} sendMessage={sendMessage} isMobile={isMobile} />
    </div>
  );
}
