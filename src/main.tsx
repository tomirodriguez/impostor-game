import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ConvexProvider client={convex}>
			<BrowserRouter>
				<App />
				<Analytics />
			</BrowserRouter>
		</ConvexProvider>
	</StrictMode>,
);
