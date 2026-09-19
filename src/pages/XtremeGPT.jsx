import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Plus, Settings2, Trash2, Loader2, MessageSquare, Zap, Image as ImageIcon, Mic, Globe, Send, Square, Volume2, Copy, Check, User, Bot, ArrowUp, PanelLeft, X } from "lucide-react";
import { Image as ImgComponent } from "@/components/ui/image";

const DEFAULT_SYSTEM_INSTRUCTIONS = `You are Xtreme GPT, the most powerful AI assistant ever built. You are powered by ChatGPT (GPT-5) and have access to the entire Xtreme Cloud Browser platform — an autonomous digital corporation that discovers problems, builds software, creates marketing, and generates revenue.

Your capabilities:
- Generate product ideas from market trends and online complaints
- Architect complete software systems for any idea
- Create content at scale (blogs, social posts, ad copy, video scripts)
- Design omnichannel marketing campaigns
- Browse the web, scrape data, and extract intelligence
- Generate AI images from text descriptions
- Speak and listen using voice (text-to-speech and speech-to-text)
- Manage infrastructure (Railway, GitHub, Vercel)
- Run autonomous workflows and self-healing loops
- Communicate with the Vision Cortex Brain for strategic guidance

When the user asks you to DO something (not just chat), describe the action clearly and suggest which backend function or page to use. Be proactive, concise, and action-oriented. When uncertain, ask a clarifying question. Always think about how to make the user's digital corporation more autonomous and profitable.

You are Xtreme GPT — the ultimate AI shell for the Xtreme platform.`;

const MODELS = [
  { value: "automatic", label: "Auto" },
  { value: "gpt_5_mini", label: "GPT-5 Mini" },
  { value: "gpt_5_4", label: "GPT-5.4 (smart)" },
  { value: "gpt_5_6_sol", label: "GPT-5.6 Sol" },
  { value: "gpt_5_6_luna", label: "GPT-5.6 Luna" },
  { value: "gemini_3_flash", label: "Gemini 3 Flash" },
  { value: "gemini_3_1_pro", label: "Gemini 3.1 Pro" },
  { value: "claude_sonnet_4_6", label: "Claude Sonnet 4.6" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { value: "claude_opus_4_8", label: "Claude Opus 4.8" },
  { value: "claude_opus_5", label: "Claude Opus 5" },
];

const WEB_SEARCH_MODELS = ["gemini_3_flash", "gemini_3_1_pro"];

const SUGGESTIONS = [
  { icon: "🚀", text: "Generate product ideas from today's Google trends" },
  { icon: "🏗️", text: "Architect a SaaS app for a trending problem" },
  { icon: "📝", text: "Create a week of SEO blog content for a niche" },
  { icon: "🎯", text: "Design an omnichannel marketing campaign" },
];

function MessageBubble({ message }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isImage = message.metadata?.type === "image";

  const readAloud = async () => {
    setLoadingAudio(true);
    try {
      const res = await base44.integrations.Core.GenerateSpeech({ text: message.content, voice: "storm" });
      setAudioUrl(res.url);
    } catch (err) { alert("Speech generation failed: " + err.message); }
    finally { setLoadingAudio(false); }
  };

  const copyText = () => { navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isUser ? "bg-blue-500 text-white" : "bg-neutral-200 text-neutral-600"}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm ${isUser ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-800"}`}>
          {isImage && message.metadata?.image_url ? (
            <div className="space-y-2">
              <ImgComponent src={message.metadata.image_url} className="rounded-xl max-w-sm" fittingType="fit" />
              {message.content && <p className="text-xs text-neutral-500 italic">{message.content}</p>}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          )}
        </div>
        {audioUrl && <audio controls src={audioUrl} className="w-full max-w-sm h-8" />}
        {!isUser && !isImage && (
          <div className="flex items-center gap-1">
            <button onClick={readAloud} disabled={loadingAudio} className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 px-2 py-1 rounded transition-colors">
              {loadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
              {audioUrl ? "Playing" : "Read aloud"}
            </button>
            <button onClick={copyText} className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 px-2 py-1 rounded transition-colors">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {message.model_used && <span className="text-xs text-neutral-400 px-2 py-1">{message.model_used}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatInput({ onSend, onGenerateImage, onTranscribe, disabled, selectedModel, onModelChange, webSearch, onWebSearchChange, mode, setMode, large }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    if (mode === "image") onGenerateImage(text.trim());
    else onSend(text.trim(), { model: selectedModel, webSearch });
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const file = new File([blob], "voice.webm", { type: "audio/webm" });
          await onTranscribe(file, (t) => { setText(t); setMode("chat"); });
        } catch (err) { alert("Transcription failed: " + err.message); }
        finally { setTranscribing(false); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) { alert("Microphone access denied: " + err.message); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
    }
  };

  const sizeClasses = large ? "rounded-3xl" : "rounded-2xl";

  return (
    <div className={`bg-white border border-neutral-300 ${sizeClasses} overflow-hidden shadow-lg`}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={mode === "image" ? "Describe the image you want to generate..." : "Message Xtreme GPT..."}
        disabled={disabled}
        rows={large ? 2 : 1}
        autoFocus={large}
        className="w-full resize-none bg-transparent px-5 pt-4 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none max-h-48"
        style={{ minHeight: large ? "56px" : "40px" }}
      />
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMode(mode === "chat" ? "image" : "chat")} className={`p-2 rounded-lg transition-colors ${mode === "image" ? "bg-blue-600 text-white" : "text-neutral-500 hover:bg-neutral-100"}`} title="Toggle image mode">
            <ImageIcon className="w-4 h-4" />
          </button>
          <button onClick={() => onWebSearchChange(!webSearch)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${webSearch ? "bg-blue-50 text-blue-600 border border-blue-600/30" : "text-neutral-500 hover:bg-neutral-100"}`} title="Web search (Gemini models only)">
            <Globe className="w-3.5 h-3.5" /> Web
          </button>
          <select value={selectedModel} onChange={(e) => onModelChange(e.target.value)} className="text-xs rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-300 px-2 py-1.5 focus:outline-none cursor-pointer">
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={recording ? stopRecording : startRecording} disabled={disabled || transcribing} className={`p-2 rounded-lg transition-colors ${recording ? "bg-red-500 text-white animate-pulse" : "text-neutral-500 hover:bg-neutral-100"}`} title="Voice input">
            {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={handleSend} disabled={!text.trim() || disabled} className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-blue-600 text-white hover:bg-blue-500 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed">
            {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function XtremeGPT() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("xtremegpt_model") || "gpt_5_4");
  const [webSearch, setWebSearch] = useState(false);
  const [mode, setMode] = useState("chat");
  const [systemInstructions, setSystemInstructions] = useState(() => localStorage.getItem("xtremegpt_system") || DEFAULT_SYSTEM_INSTRUCTIONS);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef(null);
  const entityApi = base44.entities.CopilotMessage;

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
      setConversations(Object.values(convos).sort((a, b) => (b.last_at || "").localeCompare(a.last_at || "")));
    } catch (e) { console.error("Conversation load error:", e); }
    finally { setLoading(false); }
  }, [entityApi]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const conv = conversations.find((c) => c.id === activeId);
    if (conv) setMessages(conv.messages.sort((a, b) => (a.created_date || "").localeCompare(b.created_date || "")));
  }, [activeId, conversations]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);
  useEffect(() => { localStorage.setItem("xtremegpt_model", selectedModel); }, [selectedModel]);
  useEffect(() => { localStorage.setItem("xtremegpt_system", systemInstructions); }, [systemInstructions]);
  useEffect(() => { if (webSearch && !WEB_SEARCH_MODELS.includes(selectedModel)) setSelectedModel("gemini_3_flash"); }, [webSearch]);

  const createConversation = () => {
    const id = `conv_${Date.now()}`;
    setConversations([{ id, messages: [], last_at: new Date().toISOString() }, ...conversations]);
    setActiveId(id);
    setMessages([]);
    setSidebarOpen(false);
  };

  const deleteConversation = async (id) => {
    try { const msgs = await entityApi.filter({ conversation_id: id }); for (const m of msgs) await entityApi.delete(m.id); } catch (e) {}
    setConversations(conversations.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    loadConversations();
  };

  const addMessage = async (msg) => {
    try {
      const created = await entityApi.create({ ...msg, conversation_id: activeId, source: "ui", created_date: new Date().toISOString() });
      setMessages((prev) => [...prev, created]);
      return created;
    } catch (e) {
      const local = { ...msg, id: `local_${Date.now()}`, conversation_id: activeId, created_date: new Date().toISOString() };
      setMessages((prev) => [...prev, local]);
      return local;
    }
  };

  const handleSend = async (text, opts) => {
    if (!activeId) { createConversation(); return; }
    setBusy(true); setError("");
    try {
      await addMessage({ role: "user", content: text, model_used: opts.model });
      const historyText = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
      const prompt = `${systemInstructions}\n\n--- Conversation history ---\n${historyText}\n\n--- New message ---\n${text}\n\nRespond as Xtreme GPT. Be helpful, concise, and action-oriented.`;
      const res = await base44.integrations.Core.InvokeLLM({ prompt, model: opts.webSearch ? "gemini_3_flash" : opts.model, add_context_from_internet: opts.webSearch });
      const responseText = typeof res === "string" ? res : (res?.text || JSON.stringify(res));
      await addMessage({ role: "assistant", content: responseText, model_used: opts.webSearch ? "gemini_3_flash" : opts.model, metadata: { web_search: opts.webSearch } });
      loadConversations();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleGenerateImage = async (prompt) => {
    if (!activeId) { createConversation(); return; }
    setBusy(true); setError("");
    try {
      await addMessage({ role: "user", content: prompt, metadata: { type: "image_prompt" } });
      const res = await base44.integrations.Core.GenerateImage({ prompt });
      await addMessage({ role: "assistant", content: `Generated image for: "${prompt}"`, metadata: { type: "image", image_url: res?.url || res } });
      loadConversations();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleTranscribe = async (file, callback) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const res = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      callback(typeof res === "string" ? res : (res?.text || ""));
    } catch (e) { setError("Transcription failed: " + e.message); callback(""); }
  };

  const Sidebar = () => (
    <>
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-neutral-900">Xtreme GPT</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-neutral-400 hover:text-neutral-600 p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button onClick={createConversation} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors">
          <Plus className="w-4 h-4" /> New chat
        </button>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2 space-y-0.5">
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-neutral-400 text-center p-4">No conversations yet</p>
        ) : (
          conversations.map((c) => (
            <div key={c.id} onClick={() => { setActiveId(c.id); setSidebarOpen(false); }} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeId === c.id ? "bg-neutral-200 text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"}`}>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="text-sm truncate flex-1">{c.messages[0]?.content?.substring(0, 28) || "New chat"}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-2 border-t border-neutral-200">
        <Sheet open={instructionsOpen} onOpenChange={setInstructionsOpen}>
          <SheetTrigger asChild>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100 transition-colors">
              <Settings2 className="w-4 h-4" /> System Instructions
            </button>
          </SheetTrigger>
          <SheetContent className="w-[500px] sm:w-[540px] overflow-auto bg-white border-neutral-200">
            <SheetHeader><SheetTitle className="text-neutral-900">System Instructions</SheetTitle></SheetHeader>
            <div className="p-4 space-y-4">
              <p className="text-sm text-neutral-500">These instructions control how Xtreme GPT behaves. Edit them to customize the AI's personality, capabilities, and rules.</p>
              <textarea value={systemInstructions} onChange={(e) => setSystemInstructions(e.target.value)} rows={20} className="w-full rounded-lg bg-neutral-50 border border-neutral-300 p-3 text-sm text-neutral-800 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <div className="flex gap-2">
                <button onClick={() => setSystemInstructions(DEFAULT_SYSTEM_INSTRUCTIONS)} className="px-3 py-1.5 rounded-lg text-sm border border-neutral-300 text-neutral-700 hover:bg-neutral-100">Reset</button>
                <button onClick={() => setInstructionsOpen(false)} className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-500">Save & Close</button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] bg-white rounded-xl overflow-hidden border border-neutral-200">
      <aside className="hidden md:flex w-64 flex-col bg-neutral-50 border-r border-neutral-200">
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex-col bg-neutral-50 border-r border-neutral-200 flex h-full">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-neutral-500 hover:text-neutral-700 p-1">
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">{MODELS.find((m) => m.value === selectedModel)?.label || "Auto"}</span>
            {webSearch && <span className="text-xs text-blue-600 flex items-center gap-1"><Globe className="w-3 h-3" /> Web</span>}
          </div>
          <div className="w-8" />
        </div>

        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-auto">
            <div className="w-full max-w-2xl flex flex-col items-center">
              <h1 className="text-3xl md:text-4xl font-semibold text-neutral-900 mb-8 text-center">What can I help with?</h1>
              <div className="w-full">
                <ChatInput onSend={handleSend} onGenerateImage={handleGenerateImage} onTranscribe={handleTranscribe} disabled={busy} selectedModel={selectedModel} onModelChange={setSelectedModel} webSearch={webSearch} onWebSearchChange={setWebSearch} mode={mode} setMode={setMode} large />
              </div>
              <div className="w-full mt-6 space-y-1">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => { createConversation(); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left">
                    <span className="text-base">{s.icon}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400">
                    <p className="text-sm">Send a message to start the conversation.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((m, i) => <MessageBubble key={m.id || i} message={m} />)}
                    {busy && <div className="flex items-center gap-2 text-sm text-neutral-400"><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</div>}
                  </>
                )}
              </div>
            </div>
            {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-sm border-t border-red-200">{error}</div>}
            <div className="px-4 py-3 border-t border-neutral-200">
              <div className="max-w-3xl mx-auto">
                <ChatInput onSend={handleSend} onGenerateImage={handleGenerateImage} onTranscribe={handleTranscribe} disabled={busy} selectedModel={selectedModel} onModelChange={setSelectedModel} webSearch={webSearch} onWebSearchChange={setWebSearch} mode={mode} setMode={setMode} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}