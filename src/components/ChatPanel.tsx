import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User } from "lucide-react";

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "init-1",
    role: "assistant",
    text: "Bonjour. Une fois les données patient chargées, vous pourrez parcourir les segmentations critiques et échanger ici pour valider ou corriger l'analyse.",
  },
];

const ChatPanel = () => {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "Cette démo affiche l'interface de revue. La réponse réelle viendrait du backend (Med-Gemini / RAG) selon la segmentation affichée.",
        },
      ]);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/60 bg-ge-gradient relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-accent/20 blur-xl" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-primary-foreground/5 blur-lg" />
        <div className="relative">
          <h2 className="text-sm font-display font-semibold text-primary-foreground tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Discussion & validation
          </h2>
          <p className="text-xs text-primary-foreground/70 mt-1">
            Validez ou recentrez l'analyse. Posez des questions sur la segmentation.
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-ge-gradient-soft">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 animate-float-up ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                msg.role === "assistant"
                  ? "bg-secondary text-secondary-foreground shadow-ge-soft"
                  : "bg-ge-gradient text-primary-foreground shadow-ge"
              }`}
            >
              {msg.role === "assistant" ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>
            <div
              className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                msg.role === "assistant"
                  ? "rounded-2xl rounded-tl-md bg-card border border-border/60 text-foreground shadow-ge-soft"
                  : "rounded-2xl rounded-tr-md bg-ge-gradient text-primary-foreground shadow-ge"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/60 bg-card">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/50 focus-within:shadow-ge transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrire un message…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[40px] max-h-[120px] py-2"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-9 h-9 rounded-lg bg-ge-gradient text-primary-foreground flex items-center justify-center flex-shrink-0 hover:scale-105 hover:shadow-ge-lg active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
