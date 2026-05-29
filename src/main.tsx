import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "@/lib/native";

// Inicializa os plugins nativos do Capacitor (no-op na web).
void initNative();

createRoot(document.getElementById("root")!).render(<App />);
