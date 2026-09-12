import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const CallContext = createContext(null);

/**
 * One call surface for the whole app.
 *
 * Every department dials the same way, so the modal is mounted once at the
 * shell and opened by target rather than re-implemented per section:
 *
 *   const { initiateCall } = useCall();
 *   initiateCall({ name, phone, leadType: 'AgentLead', leadId, source });
 *
 * `leadType` is what decides which outcomes the modal offers. An agent lead can
 * be progressed, diverted or escalated; a staff member can only be called and
 * logged — offering "Not interested" on a colleague would be nonsense.
 */
export function CallProvider({ children }) {
  const [target, setTarget] = useState(null);
  const [duplicate, setDuplicate] = useState(null);

  const initiateCall = useCallback((next) => {
    if (!next?.phone) return;
    setTarget(next);
  }, []);

  const closeCall = useCallback(() => setTarget(null), []);

  /** Raise the "this number already exists" prompt from anywhere. */
  const flagDuplicatePhone = useCallback((info) => setDuplicate(info), []);
  const clearDuplicatePhone = useCallback(() => setDuplicate(null), []);

  const value = useMemo(
    () => ({
      activeCallTarget: target,
      initiateCall,
      closeCall,
      duplicatePhone: duplicate,
      flagDuplicatePhone,
      clearDuplicatePhone,
    }),
    [target, initiateCall, closeCall, duplicate, flagDuplicatePhone, clearDuplicatePhone]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside a CallProvider');
  return ctx;
}

export default CallContext;
