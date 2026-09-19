import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Volume2, Copy, Check, Loader2, User, Bot } from "lucide-react";

export default function ChatShellMessage({ message }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === "user";
  const isImage = message.metadata?.type === "image";
  const hasAudio = message.metadata?.audio_url;

  const readAloud = async () => {
    if (hasAudio) {
      setAudioUrl(message.metadata.audio_url);
      return;
    }
    setLoadingAudio(true);
    try {
      const res = await base44.integrations.Core.GenerateSpeech({
        text: message.content,
        voice: "storm",
      });
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
              <Image src={message.metadata.image_url} className="rounded-xl max-w-sm" fittingType="fit" />
              {message.content && <p className="text-sm text-muted-foreground italic">{message.content}</p>}
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        {/* Audio player */}
        {audioUrl && (
          <audio controls src={audioUrl} className="w-full max-w-sm" />
        )}

        {/* Action buttons for assistant messages */}
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
            {message.model_used && (
              <span className="text-xs text-muted-foreground px-2 py-1">{message.model_used}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}