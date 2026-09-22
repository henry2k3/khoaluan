import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { socket } from '../realtime/socket.js';
import useSocketSession from '../realtime/useSocketSession.js';

const StaffRealtimeContext = createContext(null);
export function StaffRealtimeProvider({ token, children }) {
  const connection = useSocketSession({ enabled: !!token, token });
  const [notices, setNotices] = useState([]);
  const seen = useRef(new Set());
  useEffect(() => {
    seen.current.clear();
    setNotices([]);
    if (!token) return;
    function onCreated(data) {
      if (!data?.orderId || seen.current.has(data.orderId)) return;
      seen.current.add(data.orderId);
      if (seen.current.size > 100)
        seen.current.delete(seen.current.values().next().value);
      setNotices((previous) => [data, ...previous].slice(0, 5));
    }
    socket.on('order:created', onCreated);
    return () => socket.off('order:created', onCreated);
  }, [token]);
  return (
    <StaffRealtimeContext.Provider
      value={{ connection, notices, dismiss: () => setNotices([]) }}
    >
      {children}
    </StaffRealtimeContext.Provider>
  );
}
export const useStaffRealtime = () => useContext(StaffRealtimeContext);
