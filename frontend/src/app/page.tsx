"use client";
import { ChatLayout } from "@/components/chat/chat-layout";
import { ChatHeader } from "@/components/chat/ChatHeader.client";
import { useRef } from "react";

export default function Home() {
  // Generate a random session id that is not changed on re-renders
  const sessionIdRef = useRef(Math.floor(Math.random() * 100001));
  return (
    <main className="flex h-[calc(100dvh)] flex-col items-center justify-center p-4 md:px-24 py-16 gap-4">
      <ChatHeader sessionId={sessionIdRef.current} />
      <div className="z-10 border rounded-lg max-w-5xl w-full h-full text-sm lg:flex">
        <ChatLayout sessionId={sessionIdRef.current} />
      </div>
    </main>
  );
}
