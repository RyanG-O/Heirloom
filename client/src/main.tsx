import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConversationProvider } from "@elevenlabs/react";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* @elevenlabs/react v1: useConversation() must be inside ConversationProvider */}
    <ConversationProvider>
      <App />
    </ConversationProvider>
  </StrictMode>,
);
