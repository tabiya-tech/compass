import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CircleBackslashIcon } from "@radix-ui/react-icons";
import axios from "axios";

interface ChatHeaderProps {
  sessionId: number;
}
export const ChatHeader = ({ sessionId }: Readonly<ChatHeaderProps>) => {
  const clearConversation = async () => {
    try {
      console.log(`${process.env.NEXT_PUBLIC_COMPASS_URL}/${process.env.NEXT_PUBLIC_DEFAULT_COMPASS_ENDPOINT}?user_input==&clear_memory=true&session_id=${sessionId}`)
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_COMPASS_URL}/${process.env.NEXT_PUBLIC_DEFAULT_COMPASS_ENDPOINT}?user_input==&clear_memory=true&session_id=${sessionId}`
      );
      console.log({ data: response.data }, "Conversation Cleared");
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <div className="flex flex-row justify-between max-w-5xl w-full ">
      <div className="flex flex-row justify-start items-center gap-2">
        <span className="text-4xl font-bold">Tabiya</span>
        <Link
          href="#"
          className="text-4xl font-bold bg-gradient-to-r from-lime-500 to-lime-400 bg-clip-text text-transparent"
        >
          Compass
        </Link>
      </div>
      <Button
        size="lg"
        onClick={clearConversation}
        className="flex flex-row gap-2 p-4 bg-[#002147] hover:bg-[#002147cf] active:bg-[#002147]"
      >
        Clear <CircleBackslashIcon />
      </Button>
    </div>
  );
};
