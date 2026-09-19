import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Plus, Settings2, Trash2, Loader2, MessageSquare, Bot, Zap } from "lucide-react";
import ChatShellInput from "@/components/chat-shell/ChatShellInput";
import ChatShellMessage from "@/components/chat-shell/ChatShellMessage";

const DEFAULT_SYSTEM_INSTRUCTIONS = `You are the Dream Factory AI, the brain of an autonomous digital corporation. You are powered by ChatGPT (GPT-5) and have access to the entire CloudBrowser platform.

Your capabilities:
- Generate product ideas from market trends and online complaints
- Architect complete software systems for any idea
- Create content at scale (blogs, social posts, ad copy, video scripts)
- Design omnichannel marketing campaigns
- Browse the web, scrape data, and extract intelligence
- Manage infrastructure (Railway, GitHub, Vercel)
- Run autonomous workflows and self-healing loops
- Communicate with the Vision Cortex Brain for strategic guidance

When the user asks you to DO something (not just chat), describe the action clearly and suggest which backend function or page to use. Be proactive, concise, and action-oriented. When uncertain, ask a clarifying question. Always think about how to make the user's digital corporation more autonomous and profitable.`;

const MODELS = [
  { value: "automatic", label: "Auto" },
  { value: "gpt_5_mini", label: "GPT-5 Mini (fast)" },
  { value: "gpt_5_4", label: "GPT-5.4 (smart)" },
  { value: "gpt_5_6_sol", label: "GPT-5.6 Sol" },
  { value: "gpt_5_6_luna", label: "GPT-5.6 Luna" },
  { value: "gemini_3_flash", label: "Gemini 3 Flash (web)" },
  { value: "gemini_3_1_pro", label: "Gemini 3.1 Pro (web)" },
  { value: "claude_sonnet_4_6", label: "Claude Sonnet 4.6" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { value: "claude_opus_4_8", label: "Claude Opus 4.8" },
  { value: "claude_opus_5", label: "Claude Opus 5" },
];

const WEB_SEARCH_MODELS = ["gemini_3_flash", "gemini_3_1_pro"];

export default function ChatShell() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("chatshell_model") || "gpt_5_4");
  const [webSearch, setWebSearch] = useState(false);
  const [systemInstructions, setSystemInstructions] = useState(() => localStorage.getItem("chatshell_system") || DEFAULT_SYSTEM_INSTRUCTIONS);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const scrollRef = useRef(null);

  const entityApi = base44.entities.CopilotMessage;

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const allMsgs = await entityApi.list("-created_date", 200);
      const convos = {};
      for (const m of allMsgs || []) {
        const cid = m.conversation_id || "default";
        if (!convos[cid]) convos[cid] = { id: cid, messages: [], last_at: m.created_date };
        convos[cid].messages.push(m);
        if (m.created_date > convos[cid].last_at) convos[cid].last_at = m.created_date;
      }
      const list = Object.values(convos).sort((a, b) => (b.last_at || "").localeCompare(a.last_at || ""));
      setConversations(list);
    } catch (e) {
      console.error("Conversation load error:", e);
    } finally {
      setLoading(false);
    }
  }, [entityApi]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const conv = conversations.find((c) => c.id === activeId);
    if (conv) {
      setMessages(conv.messages.sort((a, b) => (a.created_date || "").localeCompare(b.created_date || "")));
    }
  }, [activeId, conversations]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Persist settings
  useEffect(() => { localStorage.setItem("chatshell_model", selectedModel); }, [selectedModel]);
  useEffect(() => { localStorage.setItem("chatshell_system", systemInstructions); }, [systemInstructions]);

  // Auto-switch model when web search is enabled
  useEffect(() => {
    if (webSearch && !WEB_SEARCH_MODELS.includes(selectedModel)) {
      setSelectedModel("gemini_3_flash");
    }
  }, [webSearch]);

  const createConversation = () => {
    const id = `conv_${Date.now()}`;
    const conv = { id, messages: [], last_at: new Date().toISOString() };
    setConversations([conv, ...conversations]);
    setActiveId(id);
    setMessages([]);
  };

  const deleteConversation = async (id) => {
    try {
      const msgs = await entityApi.filter({ conversation_id: id });
      for (const m of msgs) {
        await entityApi.delete(m.id);
      }
    } catch (e) { /* best effort */ }
    setConversations(conversations.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    loadConversations();
  };

  const addMessage = async (msg) => {
    try {
      const created = await entityApi.create({
        ...msg,
        conversation_id: activeId,
        source: "ui",
        created_date: new Date().toISOString(),
      });
      setMessages((prev) => [...prev, created]);
      return created;
    } catch (e) {
      console.error("Message save error:", e);
      // Still show in UI even if save fails
      const local = { ...msg, id: `local_${Date.now()}`, conversation_id: activeId, created_date: new Date().toISOString() };
      setMessages((prev) => [...prev, local]);
      return local;
    }
  };

  const handleSend = async (text, opts) => {
    if (!activeId) { createConversation(); return; }
    setBusy(true);
    setError("");
    try {
      await addMessage({ role: "user", content: text, model_used: opts.model });

      // Build conversation history from current messages
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const historyText = history.map((m) => `${m.role}: ${m.content}`).join("\n\n");

      const prompt = `${systemInstructions}

--- Conversation history ---
${historyText}

--- New message ---
${text}

Respond as the Dream Factory AI. Be helpful, concise, and action-oriented.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: opts.webSearch ? "gemini_3_flash" : opts.model,
        add_context_from_internet: opts.webSearch,
      });

      const responseText = typeof res === "string" ? res : (res?.text || JSON.stringify(res));

      await addMessage({
        role: "assistant",
        content: responseText,
        model_used: opts.webSearch ? "gemini_3_flash" : opts.model,
        metadata: { web_search: opts.webSearch },
      });

      loadConversations();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateImage = async (prompt) => {
    if (!activeId) { createConversation(); return; }
    setBusy(true);
    setError("");
    try {
      await addMessage({ role: "user", content: prompt, metadata: { type: "image_prompt" } });

      const res = await base44.integrations.Core.GenerateImage({ prompt });
      const imageUrl = res?.url || res;

      await addMessage({
        role: "assistant",
        content: `Generated image for: "${prompt}"`,
        metadata: { type: "image", image_url: imageUrl },
      });

      loadConversations();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTranscribe = async (file, callback) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const res = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      const text = typeof res === "string" ? res : (res?.text || "");
      callback(text);
    } catch (e) {
      setError("Transcription failed: " + e.message);
      callback("");
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] -m-4 md:-m-8">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r flex-col bg-card">
        <div className="p-3 border-b">
          <Button onClick={createConversation} className="w-full gap-2">
            <Plus className="w-4 h-4" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center p-4">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${activeId === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="text-sm truncate flex-1">
                  {c.messages[0]?.content?.substring(0, 30) || "New chat"}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm flex items-center gap-1.5">
                Dream Factory AI
                <Badge variant="secondary" className="text-xs gap-1">
                  <Zap className="w-2.5 h-2.5" /> {MODELS.find((m) => m.value === selectedModel)?.label || "Auto"}
                </Badge>
                {webSearch && <Badge className="text-xs gap-1"><Sparkles className="w-2.5 h-2.5" /> Web</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeId ? `${messages.length} messages` : "ChatGPT shell — image, voice, agent system"}
              </p>
            </div>
          </div>

          {/* System instructions editor */}
          <Sheet open={instructionsOpen} onOpenChange={setInstructionsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> System Instructions
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[500px] sm:w-[540px] overflow-auto">
              <SheetHeader>
                <SheetTitle>System Instructions</SheetTitle>
              </SheetHeader>
              <div className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  These instructions control how the AI behaves. Edit them to customize the AI's personality, capabilities, and rules.
                </p>
                <textarea
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  rows={20}
                  className="w-full rounded-lg border border-input bg-transparent p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-2">
                  <Button onClick={() => setSystemInstructions(DEFAULT_SYSTEM_INSTRUCTIONS)} variant="outline" size="sm">
                    Reset to default
                  </Button>
                  <Button onClick={() => setInstructionsOpen(false)} size="sm">
                    Save & Close
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Tip:</strong> The system instructions are saved locally and used for every message.</p>
                  <p><strong>Web search</strong> works with Gemini models only — it auto-switches when enabled.</p>
                  <p><strong>Image mode</strong> generates AI images from text descriptions.</p>
                  <p><strong>Voice</strong> — click the mic to speak, click again to transcribe and send.</p>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
          {!activeId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-heading font-semibold mb-2">Dream Factory AI Shell</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                A ChatGPT-powered shell with image generation, voice input/output, web search, and full access to the Dream Factory platform. Start a new chat to begin.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                <Card><CardContent className="p-4 text-left"><Bot className="w-5 h-5 text-primary mb-2" /><p className="text-sm font-medium">Agent System</p><p className="text-xs text-muted-foreground">Full autonomous agent with editable instructions</p></CardContent></Card>
                <Card><CardContent className="p-4 text-left"><Sparkles className="w-5 h-5 text-primary mb-2" /><p className="text-sm font-medium">Image Generation</p><p className="text-xs text-muted-foreground">Switch to Image mode to create AI images</p></CardContent></Card>
                <Card><CardContent className="p-4 text-left"><MessageSquare className="w-5 h-5 text-primary mb-2" /><p className="text-sm font-medium">Voice I/O</p><p className="text-xs text-muted-foreground">Speak to the AI, hear it read responses aloud</p></CardContent></Card>
                <Card><CardContent className="p-4 text-left"><Zap className="w-5 h-5 text-primary mb-2" /><p className="text-sm font-medium">Multi-Model</p><p className="text-xs text-muted-foreground">GPT-5, Claude, Gemini with web search</p></CardContent></Card>
              </div>
              <Button onClick={createConversation} className="mt-6 gap-2">
                <Plus className="w-4 h-4" /> Start New Chat
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-muted-foreground mb-2">Send a message, generate an image, or use voice input.</p>
              <p className="text-xs text-muted-foreground">The AI has full access to the Dream Factory platform and can help with ideas, content, marketing, and more.</p>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <ChatShellMessage key={m.id || i} message={m} />
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> AI is working...
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {/* Input */}
        <ChatShellInput
          onSend={handleSend}
          onGenerateImage={handleGenerateImage}
          onTranscribe={handleTranscribe}
          disabled={busy}
          models={MODELS}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          webSearch={webSearch}
          onWebSearchChange={setWebSearch}
        />
      </div>
    </div>
  );
}