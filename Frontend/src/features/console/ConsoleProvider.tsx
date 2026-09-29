/**
 * ============================================================================
 * CONSOLE PROVIDER — shared state for every console view
 * ============================================================================
 *
 * Owns:
 *   - navigation between the three views (Live chat / Incident memory /
 *     Simulated triage),
 *   - the chat session: sending messages, staged progress labels, the
 *     wake-up message for a sleeping Render instance, retry on failure,
 *   - the incident archive used by the memory explorer,
 *   - which response's recalled memories the side panel is showing.
 *
 * The backend URL itself is not configuration — it is compiled into
 * `src/services/agent/config.ts` (`DEFAULT_BACKEND_URL`), so there is no connection
 * screen. Failures surface inline with a Retry action instead.
 *
 * The provider sits above the whole console (see `pages/Console.tsx`), so a
 * preset fired from Simulated Triage can jump straight into the chat and a
 * record opened in the memory explorer can be recalled into the conversation.
 * ============================================================================
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  ApiError,
  fetchIncidents,
  resolveBaseUrl,
  sendChat,
  sendFeedback,
  toApiError,
  type FeedbackScope,
} from "@/services/agent";
import type {
  AgentAnswer,
  ChatMessage,
  IncidentRecord,
  MockOutage,
} from "@/domain/incident";

export type ConsoleView = "chat" | "memory" | "triage";

/** Progress label shown while a turn is in flight. */
export interface Stage {
  label: string;
  sub?: string;
}

interface ConsoleContextValue {
  /* navigation */
  view: ConsoleView;
  setView: (view: ConsoleView) => void;

  /* incident archive */
  incidents: IncidentRecord[];
  incidentsStatus: "loading" | "ready" | "error";
  incidentsError: ApiError | null;
  reloadIncidents: () => Promise<void>;
  selectedIncidentId: string | null;
  openIncident: (id: string) => void;
  closeIncident: () => void;

  /* chat */
  messages: ChatMessage[];
  isSending: boolean;
  stage: Stage | null;
  sendError: ApiError | null;
  send: (text: string) => Promise<void>;
  retryLast: () => Promise<void>;
  clearChat: () => void;
  injectPreset: (preset: MockOutage) => Promise<void>;
  askAboutIncident: (incident: IncidentRecord) => Promise<void>;
  rate: (messageId: string, helpful: boolean, scope?: FeedbackScope) => Promise<boolean>;

  /* memory panel focus */
  activeAnswer: AgentAnswer | null;
  activeMessageId: string | null;
  focusMemory: (messageId: string) => void;
}

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

/** After this long waiting on a live turn, switch to the wake-up message. */
const WAKE_UP_AFTER_MS = 4_000;

const uid = () => `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Compiled-in agent service (see `src/services/agent/`). */
const BACKEND_URL = resolveBaseUrl();

export function ConsoleProvider({ children }: { children: ReactNode }) {
  /* ---------------------------------------------------------------- nav */
  const [view, setView] = useState<ConsoleView>("chat");

  /* ---------------------------------------------------------- incident log */
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [incidentsStatus, setIncidentsStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [incidentsError, setIncidentsError] = useState<ApiError | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  /* ----------------------------------------------------------------- chat */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const sendingRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  /** Session id is minted on first use (inside a handler), never during render. */
  const sessionIdRef = useRef<string | null>(null);
  const getSessionId = useCallback(() => {
    sessionIdRef.current ??= `sess-${Math.random().toString(36).slice(2, 10)}`;
    return sessionIdRef.current;
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /* --------------------------------------------------------- memory archive */

  const reloadIncidents = useCallback(async () => {
    setIncidentsStatus("loading");
    setIncidentsError(null);
    try {
      const list = await fetchIncidents(BACKEND_URL);
      setIncidents(list);
      setIncidentsStatus("ready");
    } catch (error) {
      setIncidentsError(toApiError(error));
      setIncidentsStatus("error");
    }
  }, []);

  // Boot: load the memory archive (also warms a sleeping Render instance).
  // Scheduled one tick out so the effect body itself performs no synchronous
  // state updates — the "loading" state is set inside the task.
  useEffect(() => {
    const boot = window.setTimeout(() => {
      void reloadIncidents();
    }, 0);
    return () => window.clearTimeout(boot);
  }, [reloadIncidents]);

  /* ----------------------------------------------------------- chat turns */

  /**
   * Run one agent turn for `text`. The user message is appended by `send`
   * (or reused by `retryLast`), and exactly one agent message lands on success.
   */
  const runTurn = useCallback(
    async (text: string) => {
      sendingRef.current = true;
      setIsSending(true);
      setSendError(null);

      try {
        setStage({ label: "Contacting the agent…" });

        // Render free-tier instances sleep; flip to an explicit wake-up
        // message if the request is still pending after a few seconds.
        const wakeTimer = window.setTimeout(() => {
          setStage({
            label: "Waking up the agent service…",
            sub: "The first request after a quiet period can take 30–50 seconds.",
          });
        }, WAKE_UP_AFTER_MS);
        timersRef.current.push(wakeTimer);

        const history = messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.text,
        }));

        let answer: AgentAnswer;
        try {
          answer = await sendChat(BACKEND_URL, {
            sessionId: getSessionId(),
            message: text,
            history,
          });
        } finally {
          window.clearTimeout(wakeTimer);
        }

        setMessages((previous) => [
          ...previous.map((message) => ({ ...message, animate: false })),
          {
            id: uid(),
            role: "agent",
            text: answer.reply,
            at: Date.now(),
            answer,
            animate: true,
          },
        ]);
        setActiveMessageId(null); // panel follows the newest response
      } catch (error) {
        setSendError(toApiError(error));
      } finally {
        clearTimers();
        setStage(null);
        setIsSending(false);
        sendingRef.current = false;
      }
    },
    [clearTimers, getSessionId, messages],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sendingRef.current) return;
      setMessages((previous) => [
        ...previous,
        { id: uid(), role: "user", text, at: Date.now() },
      ]);
      await runTurn(text);
    },
    [runTurn],
  );

  /** Re-run the turn after a failure without duplicating the user message. */
  const retryLast = useCallback(async () => {
    if (sendingRef.current) return;
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    if (!lastUserMessage) return;
    await runTurn(lastUserMessage.text);
  }, [messages, runTurn]);

  const clearChat = useCallback(() => {
    if (sendingRef.current) return;
    setMessages([]);
    setSendError(null);
    setActiveMessageId(null);
    sessionIdRef.current = null; // a fresh id is minted on the next turn
    toast.info("Session cleared", { description: "New conversation started" });
  }, []);

  /** View C → View A: fire a preset outage into the live chat. */
  const injectPreset = useCallback(
    async (preset: MockOutage) => {
      setView("chat");
      await send(preset.log);
    },
    [send],
  );

  /** Memory drawer → chat: ask the agent to recall a stored incident. */
  const askAboutIncident = useCallback(
    async (incident: IncidentRecord) => {
      setView("chat");
      await send(
        `Review ${incident.id} from memory — "${incident.title}". Does it apply to what I'm seeing now?`,
      );
    },
    [send],
  );

  /* -------------------------------------------------------- response rating */

  /**
   * Rate one agent response. The verdict is stored by the service as memory
   * (a helpful answer is ranked up for future recall, an unhelpful one is
   * kept as a counter-example) and recorded on the message so the buttons
   * stay locked to it.
   *
   * Returns whether the verdict was stored. The response renders the outcome
   * inline next to its own buttons — no toast, and a failed rating leaves the
   * buttons live so it can be retried.
   */
  const rate = useCallback(
    async (messageId: string, helpful: boolean, scope: FeedbackScope = "top") => {
      const target = messages.find((message) => message.id === messageId);
      const incident = target?.answer?.incident;
      const incidentId = target?.answer?.incidentId;
      if (!incident || !incidentId) return false;

      const stamp = (verdict: boolean) =>
        setMessages((previous) =>
          previous.map((message) =>
            message.id === messageId ? { ...message, feedback: verdict } : message,
          ),
        );

      try {
        await sendFeedback(BACKEND_URL, incident, incidentId, helpful, scope);
        stamp(helpful);
        // The rating lands in the archive as a new memory document.
        void reloadIncidents();
        return true;
      } catch {
        return false;
      }
    },
    [messages, reloadIncidents],
  );

  /* ---------------------------------------------------- memory panel focus */

  const activeAnswer = useMemo(() => {
    if (activeMessageId) {
      const focused = messages.find(
        (message) => message.id === activeMessageId && message.answer,
      );
      if (focused?.answer) return focused.answer;
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role === "agent" && message.answer) return message.answer;
    }
    return null;
  }, [activeMessageId, messages]);

  const focusMemory = useCallback((messageId: string) => setActiveMessageId(messageId), []);

  const openIncident = useCallback((id: string) => {
    setSelectedIncidentId(id);
    setView("memory");
  }, []);

  const closeIncident = useCallback(() => setSelectedIncidentId(null), []);

  const value = useMemo<ConsoleContextValue>(
    () => ({
      view,
      setView,
      incidents,
      incidentsStatus,
      incidentsError,
      reloadIncidents,
      selectedIncidentId,
      openIncident,
      closeIncident,
      messages,
      isSending,
      stage,
      sendError,
      send,
      retryLast,
      clearChat,
      injectPreset,
      askAboutIncident,
      rate,
      activeAnswer,
      activeMessageId,
      focusMemory,
    }),
    [
      view, incidents, incidentsStatus, incidentsError, reloadIncidents,
      selectedIncidentId, openIncident, closeIncident, messages, isSending,
      stage, sendError, send, retryLast, clearChat, injectPreset,
      askAboutIncident, rate, activeAnswer, activeMessageId, focusMemory,
    ],
  );

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

/** Access console state. Must be used inside `<ConsoleProvider>`. */
export function useConsole(): ConsoleContextValue {
  const context = useContext(ConsoleContext);
  if (!context) {
    throw new Error("useConsole must be used within a ConsoleProvider");
  }
  return context;
}
