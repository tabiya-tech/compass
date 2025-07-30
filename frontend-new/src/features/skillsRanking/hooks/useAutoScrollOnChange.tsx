import { useEffect, useRef } from "react";

/**
 * I think it is independent of the feature, we can move it outside of this feature.
 * @param dependency
 */
export function useAutoScrollOnChange<T>(
  dependency: T
): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, [dependency]);

  return ref;
}