"use client";

import { Mic, MicOff, Square, Volume2, Waves } from "lucide-react";
import { useRef, useState } from "react";

type SpeechRecognitionEventLike = { results: ArrayLike<{ 0: { transcript: string } }> };
type Recognition = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onend: (() => void) | null };
type RecognitionConstructor = new () => Recognition;
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

export default function Home() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string>();
  const recognitionRef = useRef<Recognition | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  function interrupt() {
    recognitionRef.current?.stop(); recognitionRef.current = null;
    requestRef.current?.abort(); requestRef.current = null;
    speechSynthesis.cancel(); setListening(false); setSpeaking(false);
  }

  async function ask(prompt: string) {
    requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller;
    setResponse(""); setError(undefined);
    try {
      const result = await fetch(`${API}/chat/stream`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }) });
      if (!result.ok || !result.body) throw new Error("Voice assistant API is unavailable.");
      const reader = result.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let answer = "";
      while (true) { const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true }); const events = buffer.split("\n\n"); buffer = events.pop() ?? ""; for (const event of events) { if (!event.startsWith("data: ")) continue; const payload = JSON.parse(event.slice(6)) as { token?: string }; if (payload.token) { answer += payload.token; setResponse(answer); } } }
      const utterance = new SpeechSynthesisUtterance(answer); utterance.onstart = () => setSpeaking(true); utterance.onend = () => setSpeaking(false); speechSynthesis.speak(utterance);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Voice request failed."); }
  }

  function startListening() {
    interrupt();
    const scope = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!Constructor) { setError("Speech recognition is not supported in this browser. Try Chrome or Edge."); return; }
    const recognition = new Constructor(); recognition.continuous = false; recognition.interimResults = true; recognition.lang = navigator.language;
    recognition.onresult = (event) => { const text = Array.from(event.results).map((result) => result[0].transcript).join(""); setTranscript(text); };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; setTranscript((current) => { if (current.trim()) void ask(current); return current; }); };
    recognitionRef.current = recognition; setListening(true); recognition.start();
  }

  return <main className="grid min-h-dvh place-items-center bg-[#e9ede8] p-5 text-[#15201c]"><section className="grid h-[min(760px,calc(100dvh-2.5rem))] w-full max-w-5xl overflow-hidden rounded-[2.5rem] bg-[#17231e] text-white shadow-[0_30px_100px_rgba(24,38,32,.2)] md:grid-cols-[1fr_360px]">
    <div className="flex flex-col p-8 md:p-12"><header className="flex items-center justify-between"><span className="flex items-center gap-3 font-semibold"><Waves className="text-[#d9f28c]" />Voxline</span><span className="rounded-full bg-white/8 px-3 py-2 text-xs text-white/55">Browser-native audio</span></header><div className="flex flex-1 flex-col justify-center"><p className="text-xs uppercase tracking-[.2em] text-white/35">Transcript</p><h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-[-.055em] md:text-6xl">{transcript || "Say what is on your mind."}</h1>{response ? <p className="mt-8 max-w-2xl text-base leading-7 text-white/60">{response}</p> : null}{error ? <p className="mt-5 text-sm text-[#ffb3a3]">{error}</p> : null}</div><p className="text-xs text-white/30">Interrupt at any moment. Audio stops immediately.</p></div>
    <aside className="flex flex-col items-center justify-center bg-[#dce9d5] p-8 text-[#17231e]"><div className={`grid h-44 w-44 place-items-center rounded-full transition-all duration-500 ${listening || speaking ? "scale-105 bg-[#ff6a4d] shadow-[0_0_0_24px_rgba(255,106,77,.12)]" : "bg-white"}`}>{listening ? <Mic className="h-12 w-12" /> : speaking ? <Volume2 className="h-12 w-12" /> : <MicOff className="h-12 w-12" />}</div><p className="mt-8 text-lg font-semibold">{listening ? "Listening…" : speaking ? "Speaking…" : "Ready when you are"}</p><div className="mt-7 flex gap-3"><button className="flex h-12 items-center gap-2 rounded-full bg-[#17231e] px-5 text-sm font-semibold text-white" onClick={startListening}><Mic className="h-4 w-4" />Start</button><button aria-label="Interrupt" className="grid h-12 w-12 place-items-center rounded-full bg-white" onClick={interrupt}><Square className="h-4 w-4" /></button></div></aside>
  </section></main>;
}
