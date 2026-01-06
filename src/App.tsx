import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Game from "./pages/Game";
import Local from "./pages/Local";
import "./App.css";

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:code" element={<Game />} />
        <Route path="/local" element={<Local />} />
      </Routes>
    </div>
  );
}

export default App;
