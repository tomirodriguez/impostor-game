import { useState, useEffect } from "react";

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function useSessionId(): string {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    let id = localStorage.getItem("impostor-session-id");
    if (!id) {
      id = generateSessionId();
      localStorage.setItem("impostor-session-id", id);
    }
    setSessionId(id);
  }, []);

  return sessionId;
}
