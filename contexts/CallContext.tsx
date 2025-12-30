import React, { createContext, useContext, useState, useCallback } from 'react';

interface ActiveCall {
  id: string;
  remoteUserId: string;
  remoteName: string;
  startedAt: Date;
}

interface CallContextType {
  activeCall: ActiveCall | null;
  setActiveCall: (call: ActiveCall | null) => void;
  clearActiveCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [activeCall, setActiveCallState] = useState<ActiveCall | null>(null);

  const setActiveCall = useCallback((call: ActiveCall | null) => {
    setActiveCallState(call);
  }, []);

  const clearActiveCall = useCallback(() => {
    setActiveCallState(null);
  }, []);

  return (
    <CallContext.Provider value={{ activeCall, setActiveCall, clearActiveCall }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

