"use client";

import * as React from "react";
import type { AgentQuestion } from "./schema";
import type { AgentQuestionMessages, VoiceTranscriber } from "./types";

function MicrophoneIcon({ recording }: { recording: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="muzluk-agent-questions__small-icon">
      {recording ? <path d="M5 10h10M10 5v10" /> : <path d="M7.2 8.8V5.9a2.8 2.8 0 0 1 5.6 0v2.9a2.8 2.8 0 0 1-5.6 0Zm-2 0a4.8 4.8 0 0 0 9.6 0M10 13.6V17M7.4 17h5.2" />}
    </svg>
  );
}

export function VoiceAnswer({
  compact = false,
  disabled,
  locale,
  messages,
  question,
  transcribe,
  onText,
  onError,
}: {
  compact?: boolean;
  disabled: boolean;
  locale: string;
  messages: AgentQuestionMessages;
  question: AgentQuestion;
  transcribe?: VoiceTranscriber;
  onText: (value: string) => void;
  onError: (message: string | null) => void;
}) {
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const [supported, setSupported] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setSupported(Boolean(
      transcribe &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof window.MediaRecorder !== "undefined",
    ));
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [transcribe]);

  if (!supported || !transcribe) return null;
  const transcribeRecording = transcribe;

  async function start() {
    if (disabled || busy || recording) return;
    onError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        setBusy(true);
        void transcribeRecording(blob, { question, locale })
          .then((text) => onText(text.trim()))
          .catch(() => onError(messages.voiceError))
          .finally(() => setBusy(false));
      });
      recorder.start();
      setRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      onError(messages.voiceError);
      setRecording(false);
    }
  }

  function stop() {
    if (!recording || recorderRef.current?.state !== "recording") return;
    recorderRef.current.stop();
  }

  return (
    <button
      type="button"
      className={compact ? "muzluk-agent-questions__voice muzluk-agent-questions__voice--compact" : "muzluk-agent-questions__voice"}
      disabled={disabled || busy}
      aria-label={busy ? messages.transcribing : recording ? messages.recording : messages.record}
      aria-pressed={recording}
      onClick={() => recording ? stop() : void start()}
    >
      <MicrophoneIcon recording={recording} />
      {!compact || busy || recording ? <span>{busy ? messages.transcribing : recording ? messages.recording : messages.record}</span> : null}
    </button>
  );
}
