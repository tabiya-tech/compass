import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios, { AxiosResponse } from "axios";
import { ChatList } from "./chat-list";
import { generateTabiyaMessageFromResponse, generateUserMessageFromResponse, Message } from "@/app/data";

interface ChatProps {
  isMobile: boolean;
  sessionId: number;
}

export function Chat({ isMobile, sessionId }: Readonly<ChatProps>) {
  const [messagesState, setMessagesState] = useState<Message[]>([]);
  const [initialized, setInitialized] = useState<boolean>(false);

  const START_PROMPT = "~~~START_CONVERSATION~~~";

  // Helper function to add a new message
  const addMessage = (message: Message) => {
    setMessagesState((prevMessages) => [...prevMessages, message]);
  };

  // Helper function to construct the compass url
  const constructCompassUrl = useCallback(
    (userInput: string) => {
      const urlSearchParams = new URLSearchParams(window.location.search);
      const availableEndpoints = JSON.parse(process.env.NEXT_PUBLIC_AVAILABLE_COMPASS_ENDPOINTS!) || [];
      if (urlSearchParams.has("compass_endpoint")) {
        // if the endpoint is not in the available endpoints, return the default endpoint
        if (!availableEndpoints.includes(urlSearchParams.get("compass_endpoint"))) {
          console.log(`Invalid compass endpoint from query params: ${urlSearchParams.get("compass_endpoint")}`);
          console.log(`Using default compass endpoint: ${process.env.NEXT_PUBLIC_DEFAULT_COMPASS_ENDPOINT}/`);
          return `${process.env.NEXT_PUBLIC_COMPASS_URL}/${process.env.NEXT_PUBLIC_DEFAULT_COMPASS_ENDPOINT}?user_input=${encodeURIComponent(userInput)}&session_id=${sessionId}`;
        }
        console.log(`Using compass endpoint from query params: ${urlSearchParams.get("compass_endpoint")}`);
        return `${process.env.NEXT_PUBLIC_COMPASS_URL}/${urlSearchParams.get("compass_endpoint")}?user_input=${encodeURIComponent(userInput)}&session_id=${sessionId}`;
      } else {
        return `${process.env.NEXT_PUBLIC_COMPASS_URL}/${process.env.NEXT_PUBLIC_DEFAULT_COMPASS_ENDPOINT}?user_input=${encodeURIComponent(userInput)}&session_id=${sessionId}`;
      }
    },
    [sessionId]
  );

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
        const response = await axios.get(constructCompassUrl(START_PROMPT));
        console.log({ data: response.data });
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
        console.error(error);
        addMessage(generateTabiyaMessageFromResponse("I'm sorry, I'm having trouble connecting to the server. Please try again later."));
        throw error;
      } finally {
        setTyping(false);
      }
    },
    [setTyping, constructCompassUrl]
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
      const response = await axios.get(constructCompassUrl(newMessage.message));
      if (response.data.messages_for_user) {
        console.log("New interface detected, using new message format");
        console.log({ data: response.data.messages_for_user });
        response.data.messages_for_user.forEach((message: any) => {
          addMessage(generateTabiyaMessageFromResponse(message));
        });
      }else {
        console.log("Using old message format");
        console.log({ data: response.data.last });
        addMessage(generateTabiyaMessageFromResponse(response.data.last.message_for_user));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setTyping(false);
    }
  };

  useEffect(() => {
    if (!initialized) {
      getConversation().then(() => setInitialized(true));
    }
  }, [getConversation, initialized]);

  return (
    <div className="flex flex-col justify-between w-full h-full">
      <ChatList messages={messagesState} sendMessage={sendMessage} isMobile={isMobile} />
    </div>
  );
}
