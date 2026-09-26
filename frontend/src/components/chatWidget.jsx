import { useEffect, useRef, useState } from "react";
import axios from "../lib/axios";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // What's actually shown on screen — only ever { role: "user" | "assistant", content }
  const [displayMessages, setDisplayMessages] = useState([]);

  // Opaque conversation state returned by the backend (includes tool
  // calls/results). We just store it and send it back next request —
  // it is NEVER rendered.
  const [history, setHistory] = useState([]);

  const bottomRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayMessages, loading, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setDisplayMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("/chat", {
        message: trimmed,
        history, // opaque — forwarded as-is, not displayed
      });

      setDisplayMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.message },
      ]);
      setHistory(res.data.history || []);
    } catch (err) {
      console.error("Chat error:", err);
      setDisplayMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err.response?.data?.message ||
            "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setDisplayMessages([]);
    setHistory([]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="w-80 sm:w-96 h-[28rem] bg-white rounded-xl shadow-2xl border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
            <div>
              <p className="font-semibold text-sm">Salon Assistant</p>
              <p className="text-xs text-blue-100">
                Ask about salons, services & availability
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNewChat}
                title="New chat"
                className="text-blue-100 hover:text-white text-xs px-2 py-1 rounded hover:bg-blue-700 transition"
              >
                New
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="text-blue-100 hover:text-white w-7 h-7 flex items-center justify-center rounded hover:bg-blue-700 transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
            {displayMessages.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-6">
                Try: "What salons do you have?" or "Any slots free tomorrow
                at Glow Salon for a haircut?"
              </p>
            )}

            {displayMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white border text-gray-800 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border text-gray-500 text-sm px-3 py-2 rounded-lg rounded-bl-none">
                  Typing...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="border-t p-2 flex items-center gap-2 bg-white"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={loading}
              className="flex-1 border rounded-full px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-700 transition disabled:bg-gray-300"
            >
              ➤
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition text-2xl"
          title="Chat with us"
        >
          💬
        </button>
      )}
    </div>
  );
}
