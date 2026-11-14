import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownLeft,
  Mic,
  MicOff,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Square,
  X
} from 'lucide-react';
import { AGROCHEMICAL_CATALOG } from '@/data/rules';
import { askFieldCopilot } from '@/lib/ai';
import { db, useAppStore } from '@/lib/db';
import { triggerHaptic } from '@/lib/sensors';

const QUICK_PROMPTS = [
  '¿Puedo cosechar hoy este lote?',
  'Explícame la alerta y cómo corregirla',
  'Resume la última visita para el comprador',
  '¿Qué es el período de carencia (PHI)?'
];

export const FieldCopilotSheet: React.FC = () => {
  const navigate = useNavigate();
  const {
    copilotOpen,
    copilotParcelId,
    copilotMessages,
    technician,
    closeCopilot,
    openCopilot,
    addCopilotMessage,
    clearCopilotMessages,
    pushToast
  } = useAppStore();

  const [input, setInput] = useState('');
  const [thinkingPhase, setThinkingPhase] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [expandedTelemetryId, setExpandedTelemetryId] = useState<string | null>(null);
  const [dictatingInChat, setDictatingInChat] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const streamCancelRef = useRef(false);
  const speechRecRef = useRef<any>(null);

  const parcels = useLiveQuery(() => db.parcels.orderBy('routeOrder').toArray(), []) ?? [];
  const activeParcel =
    parcels.find((p) => p.id === copilotParcelId) ?? parcels[0] ?? null;

  const latestVisit = useLiveQuery(
    async () => {
      if (!activeParcel) return null;
      const list = await db.visits
        .where('parcelId')
        .equals(activeParcel.id)
        .reverse()
        .sortBy('visitedAt');
      return list[0] ?? null;
    },
    [activeParcel?.id]
  );

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [copilotMessages.length, thinkingPhase, streamingText, copilotOpen]);

  if (!copilotOpen) return null;

  const handleStopGeneration = () => {
    streamCancelRef.current = true;
    setThinkingPhase(null);
    setStreamingText(null);
  };

  const handleVoiceInChat = () => {
    if (dictatingInChat) {
      try {
        speechRecRef.current?.stop();
      } catch {
        // Ignorar
      }
      setDictatingInChat(false);
      return;
    }

    const SpeechApi =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechApi) {
      setInput('¿Puedo cosechar hoy este lote o cuántos días faltan?');
      triggerHaptic(12);
      return;
    }

    try {
      const rec = new SpeechApi();
      rec.lang = 'es-MX';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript + ' ';
        }
        if (text.trim()) setInput(text.trim());
      };
      rec.onend = () => setDictatingInChat(false);
      rec.onerror = () => setDictatingInChat(false);
      speechRecRef.current = rec;
      rec.start();
      setDictatingInChat(true);
    } catch {
      setInput('¿Puedo cosechar hoy este lote?');
    }
  };

  const handleSend = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean || thinkingPhase || streamingText !== null) return;

    streamCancelRef.current = false;
    triggerHaptic(10);

    addCopilotMessage({
      id: `u-${Date.now()}`,
      role: 'user',
      content: clean,
      createdAt: new Date().toISOString(),
      provider: technician.forcedOfflineMode ? 'local-offline' : 'demo-fallback',
      model: 'user'
    });
    setInput('');

    // 1. Fase de razonamiento contextual animado
    setThinkingPhase(`Revisando expediente de ${activeParcel?.name || 'parcela'}…`);

    const replyPromise = askFieldCopilot(
      clean,
      { parcel: activeParcel, latestVisit },
      technician.forcedOfflineMode
    );

    const reply = await replyPromise;
    if (streamCancelRef.current) return;

    for (const stepText of reply.thinkingSteps.slice(0, 2)) {
      if (streamCancelRef.current) return;
      setThinkingPhase(stepText);
      await new Promise((r) => setTimeout(r, 340));
    }

    setThinkingPhase(null);
    if (streamCancelRef.current) return;

    // 2. Streaming palabra por palabra con cursor vivo
    const words = reply.text.split(' ');
    let current = '';
    setStreamingText('');

    for (let i = 0; i < words.length; i++) {
      if (streamCancelRef.current) break;
      current += (i === 0 ? '' : ' ') + words[i];
      setStreamingText(current);
      await new Promise((r) => setTimeout(r, 18));
    }

    setStreamingText(null);
    triggerHaptic(14);

    addCopilotMessage({
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: current || reply.text,
      createdAt: new Date().toISOString(),
      provider: reply.provider,
      model: reply.model,
      citedRules: reply.citedRules,
      checklist: reply.checklist,
      latencyMs: reply.latencyMs,
      totalTokens: reply.totalTokens,
      requestId: reply.requestId,
      suggestedAction: reply.suggestedAction
    });

    await db.aiTelemetry.put({
      id: `ai-${Date.now()}`,
      createdAt: new Date().toISOString(),
      mode: 'chat',
      provider: reply.provider,
      model: reply.model,
      parcelCode: activeParcel?.code,
      promptPreview: clean.slice(0, 120),
      responsePreview: reply.text.slice(0, 160),
      latencyMs: reply.latencyMs,
      totalTokens: reply.totalTokens,
      requestId: reply.requestId
    });
  };

  const findRuleDetails = (code: string) => {
    const spec = AGROCHEMICAL_CATALOG.find((item) => item.ruleCode === code);
    if (spec) {
      return {
        code,
        authority: spec.authority,
        doc: spec.referenceDoc,
        notes: spec.notes
      };
    }
    return {
      code,
      authority: code.includes('H2O') ? 'CONAGUA' : 'SENASICA',
      doc: 'Lineamiento Técnico de Trazabilidad e Inocuidad 2026',
      notes: 'Verificación determinista previa al sellado del Pasaporte QR.'
    };
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Copiloto de Campo"
    >
      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-md bg-app-canvas border-t-2 sm:border-2 border-app-hairline rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[88vh] max-h-[760px] overflow-hidden"
      >
        {/* Cabecera */}
        <div className="bg-app-surface px-4 py-3.5 border-b border-app-hairline flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#58A700]/15 border-2 border-[#58A700]/30 flex items-center justify-center text-[#58A700]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-display font-extrabold text-base text-app-ink">
                  Copiloto de Campo
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#0F62FE]/12 text-[#0F62FE]">
                  Demo local
                </span>
              </div>
              <p className="text-[11px] text-app-muted">
                Respuestas claras · Sin enviar datos personales
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={clearCopilotMessages}
              title="Limpiar chat"
              className="p-2 rounded-xl text-app-muted hover:bg-app-surface-2"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={closeCopilot}
              aria-label="Cerrar copiloto"
              className="p-2 rounded-xl text-app-ink hover:bg-app-surface-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selector de Parcela Activa */}
        <div className="px-4 py-2 bg-app-surface-2 border-b border-app-hairline flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-app-muted">Revisando:</span>
          <select
            value={activeParcel?.id || ''}
            onChange={(e) => openCopilot(e.target.value)}
            className="flex-1 bg-app-surface border border-app-hairline rounded-xl px-2.5 py-1.5 font-bold text-app-ink focus:outline-none"
          >
            {parcels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.crop} ({p.areaHa} ha)
              </option>
            ))}
          </select>
        </div>

        {/* Mensajes con animaciones */}
        <div
          ref={scrollContainerRef}
          aria-live="polite"
          className="flex-1 overflow-y-auto p-4 space-y-3.5"
        >
          <AnimatePresence initial={false}>
            {copilotMessages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#58A700] text-white font-semibold rounded-br-xs shadow-xs'
                      : 'card-duo text-app-ink rounded-bl-xs'
                  }`}
                >
                  <p>{m.content}</p>

                  {/* Checklist enriquecido */}
                  {m.checklist && m.checklist.length > 0 && (
                    <div className="mt-3 space-y-1.5 bg-app-surface-2 p-2.5 rounded-xl border border-app-hairline">
                      {m.checklist.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-bold text-app-ink flex items-center gap-1.5">
                            {item.status === 'ok' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#58A700] shrink-0" />
                            ) : item.status === 'warn' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-[#FFC800] shrink-0" />
                            ) : (
                              <ShieldAlert className="w-3.5 h-3.5 text-[#D64545] shrink-0" />
                            )}
                            {item.label}
                          </span>
                          <span className="text-app-muted font-medium text-right">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botón de acción sugerida */}
                  {m.suggestedAction && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (m.suggestedAction?.route) {
                            closeCopilot();
                            navigate(m.suggestedAction.route);
                          }
                        }}
                        className="w-full py-2.5 px-3.5 btn-duo-primary text-xs inline-flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{m.suggestedAction.label}</span>
                      </button>
                    </div>
                  )}

                  {/* Pie de burbuja: Chips de reglas + Ficha técnica desplegable */}
                  {m.role === 'assistant' && (
                    <div className="mt-3 pt-2 border-t border-app-hairline space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {(m.citedRules || []).map((ruleCode) => (
                            <button
                              key={ruleCode}
                              type="button"
                              onClick={() =>
                                setExpandedRule(expandedRule === `${m.id}-${ruleCode}` ? null : `${m.id}-${ruleCode}`)
                              }
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-app-tint text-[#58A700] dark:text-[#7BD62B] hover:opacity-80"
                            >
                              Norma {ruleCode}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTelemetryId(expandedTelemetryId === m.id ? null : m.id)
                          }
                          className="text-[10px] font-bold text-app-muted inline-flex items-center gap-0.5 hover:text-app-ink"
                        >
                          <span>Ficha técnica</span>
                          {expandedTelemetryId === m.id ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Detalle de regla expandido */}
                      {m.citedRules?.map((rc) => {
                        if (expandedRule !== `${m.id}-${rc}`) return null;
                        const info = findRuleDetails(rc);
                        return (
                          <div
                            key={rc}
                            className="p-2.5 rounded-xl bg-app-surface-2 text-[11px] space-y-0.5 border border-app-hairline"
                          >
                            <div className="font-bold text-app-ink">
                              {info.code} · Autoridad: {info.authority}
                            </div>
                            <div className="text-app-muted">{info.notes}</div>
                            <div className="text-[10px] text-app-muted italic">{info.doc}</div>
                          </div>
                        );
                      })}

                      {/* Ficha técnica de telemetría IBM */}
                      {expandedTelemetryId === m.id && (
                        <div className="p-2.5 rounded-xl bg-app-surface-2 font-mono-tech text-[10px] text-app-muted flex items-center justify-between gap-2">
                          <div>
                            <div>Modelo: {m.model}</div>
                            <div>
                              Latencia: {m.latencyMs ?? 140}ms · Tokens: {m.totalTokens ?? 220}
                            </div>
                            <div>ID: {m.requestId || 'granite-local'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(m.requestId || 'granite-local');
                              pushToast({ title: 'ID de solicitud copiado', tone: 'info' });
                            }}
                            className="p-1.5 rounded-lg bg-app-surface text-app-ink"
                            title="Copiar Request ID"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Estado "Pensando" animado */}
          {thinkingPhase && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-duo p-3.5 max-w-[88%] space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#58A700] animate-bounce" />
                  <span
                    className="w-2 h-2 rounded-full bg-[#58A700] animate-bounce"
                    style={{ animationDelay: '120ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-[#58A700] animate-bounce"
                    style={{ animationDelay: '240ms' }}
                  />
                </div>
                <span className="text-xs font-extrabold text-app-ink">
                  Ordenando tu nota…
                </span>
              </div>
              <p className="text-xs text-app-muted">{thinkingPhase}</p>
            </motion.div>
          )}

          {/* Burbuja de Streaming en vivo */}
          {streamingText !== null && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-duo p-4 max-w-[92%] text-sm text-app-ink leading-relaxed"
            >
              <p>
                {streamingText}
                <span className="inline-block w-2 h-4 ml-1 align-middle bg-[#58A700] animate-pulse" />
              </p>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="text-[11px] font-bold text-[#D64545] inline-flex items-center gap-1"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Detener</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Preguntas rápidas */}
        <div className="px-4 py-2 bg-app-surface border-t border-app-hairline flex gap-2 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleSend(q)}
              className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-app-tint text-[#58A700] dark:text-[#7BD62B] hover:opacity-90 transition-opacity"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Compositor con botón de micrófono */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="p-3 bg-app-surface border-t border-app-hairline flex items-center gap-2"
        >
          <button
            type="button"
            onClick={handleVoiceInChat}
            aria-label="Dictar pregunta por voz"
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              dictatingInChat
                ? 'bg-[#D64545] text-white animate-pulse'
                : 'bg-app-surface-2 text-app-ink hover:bg-app-tint'
            }`}
          >
            {dictatingInChat ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe o dicta tu duda sobre la parcela…"
            className="flex-1 h-11 px-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline text-sm text-app-ink focus:outline-none focus:border-[#58A700]"
          />

          <button
            type="submit"
            disabled={!input.trim() || Boolean(thinkingPhase) || streamingText !== null}
            className="h-11 px-4 btn-duo-primary text-xs inline-flex items-center gap-1 disabled:opacity-45"
          >
            <span>Enviar</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      </motion.div>
    </div>
  );
};
