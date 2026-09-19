import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Plus, Settings2, Trash2, Loader2, MessageSquare, Bot, Zap, Image as ImageIcon, Mic, Globe, Send, Square, Volume2, Copy, Check, User } from "lucide-react";
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
    } catch (err) {
      alert("Speech generation failed: " + err.message);
    } finally {
      setLoadingAudio(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-2.5 ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          {isImage && message.metadata?.image_url ? (
            <div className="space-y-2">
              <ImgComponent src={message.metadata.image_url} className="rounded-xl max-w-sm" fittingType="fit" />
              {message.content && <p className="text-sm text-muted-foreground italic">{message.content}</p>}
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>
        {audioUrl && <audio controls src={audioUrl} className="w-full max-w-sm" />}
        {!isUser && !isImage && (
          <div className="flex items-center gap-1">
            <button onClick={readAloud} disabled={loadingAudio} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors">
              {loadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
              {audioUrl ? "Playing" : "Read aloud"}
            </button>
            <button onClick={copyText} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {message.model_used && <span className="text-xs text-muted-foreground px-2 py-1">{message.model_used}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function InputBar({ onSend, onGenerateImage, onTranscribe, disabled, selectedModel, onModelChange, webSearch, onWebSearchChange }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("chat");
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
          await onTranscribe(file, (transcribed) => { setText(transcribed); setMode("chat"); });
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

  return (
    <div className="border-t p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setMode("chat")} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === "chat" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>Chat</button>
        <button onClick={() => setMode("image")} className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${mode === "image" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}><ImageIcon className="w-3 h-3" /> Image</button>
        <div className="h-4 w-px bg-border mx-1" />
        <select value={selectedModel} onChange={(e) => onModelChange(e.target.value)} className="text-xs rounded-md border border-input bg-transparent px-2 py-1">
          {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button onClick={() => onWebSearchChange(!webSearch)} className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${webSearch ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/80"}`} title="Search the web for context (Gemini models only)">
          <Globe className="w-3 h-3" /> Web
        </button>
      </div>
      <div className="flex items-end gap-2">
        <button onClick={recording ? stopRecording : startRecording} disabled={disabled || transcribing} className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${recording ? "bg-red-500 text-white animate-pulse" : "bg-muted text-muted-foreground hover:bg-muted/80"}`} title={recording ? "Stop recording" : "Voice input"}>
          {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown} placeholder={mode === "image" ? "Describe the image you want to generate..." : "Message Xtreme GPT..."} disabled={disabled} rows={1} className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm max-h-32 focus:outline-none focus:ring-1 focus:ring-ring" style={{ minHeight: "40px" }} />
        <Button onClick={handleSend} disabled={!text.trim() || disabled} size="icon" className="shrink-0 h-10 w-10">
          {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
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
  const [systemInstructions, setSystemInstructions] = useState(() => localStorage.getItem("xtremegpt_system") || DEFAULT_SYSTEM_INSTRUCTIONS);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
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

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  useEffect(() => { localStorage.setItem("xtremegpt_model", selectedModel); }, [selectedModel]);
  useEffect(() => { localStorage.setItem("xtremegpt_system", systemInstructions); }, [systemInstructions]);
  useEffect(() => { if (webSearch && !WEB_SEARCH_MODELS.includes(selectedModel)) setSelectedModel("gemini_3_flash"); }, [webSearch]);

  const createConversation = () => {
    const id = `conv_${Date.now()}`;
    setConversations([{ id, messages: [], last_at: new Date().toISOString() }, ...conversations]);
    setActiveId(id);
    setMessages([]);
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

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] overflow-hidden rounded-xl border bg-card">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r flex-col">
        <div className="p-3 border-b">
          <Button onClick={createConversation} className="w-full gap-2"><Plus className="w-4 h-4" /> New Chat</Button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center p-4">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <div key={c.id} onClick={() => setActiveId(c.id)} className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${activeId === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="text-sm truncate flex-1">{c.messages[0]?.content?.substring(0, 30) || "New chat"}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center"><Zap className="w-5 h-5 text-primary-foreground" /></div>
            <div>
              <p className="font-heading font-bold text-base flex items-center gap-1.5">
                Xtreme GPT
                <Badge variant="secondary" className="text-xs gap-1"><Sparkles className="w-2.5 h-2.5" /> {MODELS.find((m) => m.value === selectedModel)?.label || "Auto"}</Badge>
                {webSearch && <Badge className="text-xs gap-1"><Globe className="w-2.5 h-2.5" /> Web</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">{activeId ? `${messages.length} messages` : "Image, voice, agent system, multi-model"}</p>
            </div>
          </div>
          <Sheet open={instructionsOpen} onOpenChange={setInstructionsOpen}>
            <SheetTrigger asChild><Button variant="outline" size="sm" className="gap-1.5"><Settings2 className="w-3.5 h-3.5" /> System Instructions</Button></SheetTrigger>
            <SheetContent className="w-[500px] sm:w-[540px] overflow-auto">
              <SheetHeader><SheetTitle>System Instructions</SheetTitle></SheetHeader>
              <div className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">These instructions control how Xtreme GPT behaves. Edit them to customize the AI's personality, capabilities, and rules.</p>
                <textarea value={systemInstructions} onChange={(e) => setSystemInstructions(e.target.value)} rows={20} className="w-full rounded-lg border border-input bg-transparent p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring" />
                <div className="flex gap-2">
                  <Button onClick={() => setSystemInstructions(DEFAULT_SYSTEM_INSTRUCTIONS)} variant="outline" size="sm">Reset to default</Button>
                  <Button onClick={() => setInstructionsOpen(false)} size="sm">Save & Close</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
          {!activeId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-4"><Zap className="w-8 h-8 text-primary-foreground" /></div>
              <h2 className="text-2xl font-heading font-bold mb-2">Xtreme GPT</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-6">The most powerful AI shell — image generation, voice input/output, web search, multi-model support, and full access to the Xtreme platform.</p>
              <Button onClick={createConversation} className="mt-2 gap-2" size="lg"><Plus className="w-4 h-4" /> Start New Chat</Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-muted-foreground mb-2">Send a message, generate an image, or use voice input.</p>
              <p className="text-xs text-muted-foreground">Xtreme GPT has full access to the Xtreme platform and can help with ideas, content, marketing, and more.</p>
            </div>
          ) : (
            <>
              {messages.map((m, i) => <MessageBubble key={m.id || i} message={m} />)}
              {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Xtreme GPT is working...</div>}
            </>
          )}
        </div>

        {error && <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">{error}</div>}

        <InputBar onSend={handleSend} onGenerateImage={handleGenerateImage} onTranscribe={handleTranscribe} disabled={busy} selectedModel={selectedModel} onModelChange={setSelectedModel} webSearch={webSearch} onWebSearchChange={setWebSearch} />
      </div>
    </div>
  );
}