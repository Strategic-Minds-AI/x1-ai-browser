import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Image as ImageIcon, Mic, Square, Loader2, Globe, X } from "lucide-react";

export default function ChatShellInput({ onSend, onGenerateImage, onTranscribe, disabled, models, selectedModel, onModelChange, webSearch, onWebSearchChange }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("chat"); // chat | image
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    if (mode === "image") {
      onGenerateImage(text.trim());
    } else {
      onSend(text.trim(), { model: selectedModel, webSearch });
    }
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = handleStopRecording;
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      alert("Microphone access denied: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
    }
  };

  const handleStopRecording = async () => {
    setTranscribing(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const file = new File([blob], "voice.webm", { type: "audio/webm" });
      await onTranscribe(file, (transcribed) => {
        setText(transcribed);
        setMode("chat");
      });
    } catch (err) {
      alert("Transcription failed: " + err.message);
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="border-t bg-card p-4">
      {/* Mode + model bar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button
          onClick={() => setMode("chat")}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === "chat" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          Chat
        </button>
        <button
          onClick={() => setMode("image")}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${mode === "image" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <ImageIcon className="w-3 h-3" /> Image
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="text-xs rounded-md border border-input bg-transparent px-2 py-1"
        >
          {models.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <button
          onClick={() => onWebSearchChange(!webSearch)}
          className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${webSearch ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          title="Search the web for context (Gemini models only)"
        >
          <Globe className="w-3 h-3" /> Web
        </button>

        {mode === "image" && (
          <Badge variant="secondary" className="text-xs">Describe the image to generate</Badge>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2">
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={disabled || transcribing}
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${recording ? "bg-red-500 text-white animate-pulse" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          title={recording ? "Stop recording" : "Voice input"}
        >
          {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode === "image" ? "Describe the image you want to generate..." : "Message the Dream Factory AI..."}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm max-h-32 focus:outline-none focus:ring-1 focus:ring-ring"
          style={{ minHeight: "40px" }}
        />

        <Button onClick={handleSend} disabled={!text.trim() || disabled} size="icon" className="shrink-0 h-10 w-10">
          {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}