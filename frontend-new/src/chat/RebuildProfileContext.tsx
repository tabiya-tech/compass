import React, { createContext, useContext, useRef } from "react";

interface RebuildProfileContextType {
  registerRebuildProfile: (fn: (() => void) | null) => void;
  triggerRebuildProfile: (() => void) | null;
}

const RebuildProfileContext = createContext<RebuildProfileContextType>({
  registerRebuildProfile: () => {},
  triggerRebuildProfile: null,
});

export const RebuildProfileProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const callbackRef = useRef<(() => void) | null>(null);

  const contextValue = React.useMemo(
    () => ({
      registerRebuildProfile: (fn: (() => void) | null) => {
        callbackRef.current = fn;
      },
      get triggerRebuildProfile() {
        return callbackRef.current;
      },
    }),
    []
  );

  return <RebuildProfileContext.Provider value={contextValue}>{children}</RebuildProfileContext.Provider>;
};

export const useRebuildProfile = () => useContext(RebuildProfileContext);
