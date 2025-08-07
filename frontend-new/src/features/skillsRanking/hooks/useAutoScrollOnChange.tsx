import { useEffect, useRef } from "react";

/**
 * Hook to automatically scroll to the bottom when a dependency changes.
 * This is used to ensure new content is visible in chat-like interfaces.
 * @param dependency - The dependency to watch for changes
 */
export function useAutoScrollOnChange<T>(dependency: T): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, [dependency]);

  return ref;
}
