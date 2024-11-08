export interface Message {
  id: number;
  avatar: string;
  name: string;
  message: string;
}

export interface User {
  id: number;
  avatar: string;
  messages: Message[];
  name: string;
}

export const generateUserMessageFromResponse = (message: any): Message => {
  return {
    id: Math.floor(Math.random() * 1000),
    avatar: "https://api.dicebear.com/8.x/lorelei/svg?seed=User",
    name: "User",
    message: message,
  };
};

export const generateTabiyaMessageFromResponse = (message: any): Message => {
  return {
    id: Math.floor(Math.random() * 1000),
    avatar: "/poc-ui/tabiya.png",
    name: "Tabiya",
    message: message,
  };
};

export const tabiyaCompassUser: User = {
  id: 1,
  avatar: "/poc-ui/tabiya.png",
  name: "Tabiya",
  messages: [],
};
