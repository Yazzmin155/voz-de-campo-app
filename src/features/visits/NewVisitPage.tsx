import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileCheck2,
  MapPin,
  Mic,
  MicOff,
  Minus,
  PenTool,
  Plus,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
  Wand2
} from 'lucide-react';
import { CameraCaptureModal } from '@/components/field/CameraCaptureModal';
import { SignaturePadModal } from '@/components/field/SignaturePadModal';
import { AGROCHEMICAL_CATALOG, VOICE_DEMO_PRESETS } from '@/data/rules';
import { extractFieldNoteWithGranite } from '@/lib/ai';
import { evaluateAgronomicCompliance } from '@/lib/compliance';
import {
  buildPassportVerificationUrl,
  canonicalizePassportPayload,
  computeSha256Hex
} from '@/lib/crypto';
import { db, useAppStore } from '@/lib/db';
import {
  captureFieldGps,
  classifyMediaError,
  GpsFixResult,
  requestScreenWakeLock,
  SensorErrorDetail,
  triggerHaptic
} from '@/lib/sensors';
import {
  ActivityType,
  CropType,
  PassportCanonicalPayload,
  PassportRecord,
  VisitRecord
} from '@/types/domain';

export const NewVisitPage: React.FC = () => {
  const { parcelId: routeParcelId } = useParams<{ parcelId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { technician, pushToast } = useAppStore();

  const parcels = useLiveQuery(() => db.parcels.orderBy('routeOrder').toArray(), []) ?? [];

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedParcelId, setSelectedParcelId] = useState<string>(
    routeParcelId || 'parcel-4b'
  );
  const selectedParcel =
    parcels.find((p) => p.id === selectedParcelId) ?? parcels[0] ?? null;

  // Estado de Voz y Sensores
  const [voiceTranscript, setVoiceTranscript] = useState<string>(
    VOICE_DEMO_PRESETS[0].transcript
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [waveBars, setWaveBars] = useState<number[]>(
    Array.from({ length: 16 }, () => 18)
  );
  const [audioClipDataUrl, setAudioClipDataUrl] = useState<string | undefined>(undefined);
  const [micError, setMicError] = useState<SensorErrorDetail | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedBy, setExtractedBy] = useState<'ibm-granite' | 'local-deterministic' | 'manual'>(
    'ibm-granite'
  );
  const [confidence, setConfidence] = useState<number>(0.95);

  // Parámetros Agronómicos
  const [activity, setActivity] = useState<ActivityType>('aplicacion_fitosanitaria');
  const [agrochemicalProduct, setAgrochemicalProduct] = useState<string>('Abamectina 1.8 CE');
  const [dosePerHa, setDosePerHa] = useState<number>(1.1);
  const [doseUnit, setDoseUnit] = useState<'L/ha' | 'kg/ha' | 'mL/ha' | 'g/ha'>('L/ha');
  const [treatedAreaHa, setTreatedAreaHa] = useState<number>(3.5);
  const [waterVolumeM3, setWaterVolumeM3] = useState<number>(180);
  const [daysBeforeHarvest, setDaysBeforeHarvest] = useState<number>(6);
  const [pestOrTarget, setPestOrTarget] = useState<string>(
    'Ácaro blanco (Polyphagotarsonemus latus)'
  );

  // Evidencia: Foto sellada, Firma en Canvas y GPS
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [evidenceStamped, setEvidenceStamped] = useState<boolean>(true);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const [producerConfirmed, setProducerConfirmed] = useState<boolean>(true);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(undefined);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

  const [gpsFix, setGpsFix] = useState<GpsFixResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Referencias de audio y wake lock
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const speechRecRef = useRef<any>(null);
  const releaseWakeLockRef = useRef<(() => Promise<void>) | null>(null);

  // Leer parámetros de ruta (?step=2, ?fixPhi=15)
  useEffect(() => {
    if (routeParcelId) {
      setSelectedParcelId(routeParcelId);
    }
    const stepParam = searchParams.get('step');
    if (stepParam === '2') setWizardStep(2);
    if (stepParam === '3') setWizardStep(3);

    const fixPhiParam = searchParams.get('fixPhi');
    if (fixPhiParam) {
      const parsedDays = parseInt(fixPhiParam, 10);
      if (!Number.isNaN(parsedDays)) {
        setDaysBeforeHarvest(parsedDays);
        setWizardStep(3);
      }
    }
  }, [routeParcelId, searchParams]);

  // Actualizar datos base y capturar GPS al elegir parcela
  useEffect(() => {
    if (!selectedParcel) return;
    setTreatedAreaHa(selectedParcel.areaHa);
    setPhotoDataUrl(selectedParcel.imageUrl);
    captureFieldGps(selectedParcel.coordinates).then((fix) => {
      setGpsFix(fix);
    });
  }, [selectedParcel?.id]);

  // Contador de segundos durante grabación
  useEffect(() => {
    if (!isRecording) {
      setRecordSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setRecordSeconds((s) => {
        if (s >= 89) {
          stopRecordingSession();
          return 90;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      stopRecordingSession(false);
    };
  }, []);

  const currentCrop: CropType = selectedParcel?.crop || 'Limón Persa';

  const complianceReport = evaluateAgronomicCompliance({
    crop: currentCrop,
    activity,
    agrochemicalProduct: activity === 'aplicacion_fitosanitaria' ? agrochemicalProduct : null,
    dosePerHa: activity === 'aplicacion_fitosanitaria' ? dosePerHa : null,
    doseUnit,
    treatedAreaHa,
    waterVolumeM3,
    daysBeforeHarvest,
    producerConfirmed
  });

  const matchedCatalogSpec = AGROCHEMICAL_CATALOG.find(
    (s) => s.productName === agrochemicalProduct
  );
  const requiredPhiDays = matchedCatalogSpec
    ? matchedCatalogSpec.phiDaysByCrop[currentCrop] ?? matchedCatalogSpec.defaultPhiDays
    : 0;

  const stopRecordingSession = (autoExtract = true) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    try {
      speechRecRef.current?.stop();
    } catch {
      // Ignorar
    }
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // Ignorar
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (releaseWakeLockRef.current) {
      releaseWakeLockRef.current();
      releaseWakeLockRef.current = null;
    }
    setIsRecording(false);
    setWaveBars(Array.from({ length: 16 }, () => 18));

    if (autoExtract) {
      handleRunGraniteExtraction(voiceTranscript, false);
    }
  };

  const startRecordingSession = async () => {
    setMicError(null);
    triggerHaptic(16);

    releaseWakeLockRef.current = await requestScreenWakeLock();

    // 1. Iniciar Web Speech API en paralelo si existe
    const SpeechApi =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechApi) {
      try {
        const rec = new SpeechApi();
        rec.lang = 'es-MX';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript + ' ';
          }
          if (transcript.trim()) {
            setVoiceTranscript(transcript.trim());
          }
        };
        speechRecRef.current = rec;
        rec.start();
      } catch {
        // Continuar con MediaRecorder
      }
    }

    // 2. Intentar captura real con getUserMedia + AnalyserNode + MediaRecorder
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        mediaStreamRef.current = stream;

        // Onda en tiempo real con AnalyserNode
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateWave = () => {
            analyser.getByteFrequencyData(dataArray);
            const nextBars = Array.from({ length: 16 }, (_, idx) => {
              const val = dataArray[idx] || 12;
              return Math.max(14, Math.min(96, Math.round((val / 255) * 96)));
            });
            setWaveBars(nextBars);
            animFrameRef.current = requestAnimationFrame(updateWave);
          };
          animFrameRef.current = requestAnimationFrame(updateWave);
        }

        // Grabador de clip de audio
        if (typeof MediaRecorder !== 'undefined') {
          const chunks: BlobPart[] = [];
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = (ev) => {
            if (ev.data.size > 0) chunks.push(ev.data);
          };
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Url = String(reader.result);
              setAudioClipDataUrl(base64Url);

              // Ruta opcional: intentar transcripción con Watson STT si está configurada
              const rawBase64 = base64Url.split(',')[1];
              if (rawBase64 && navigator.onLine && !technician.forcedOfflineMode) {
                try {
                  const sttRes = await fetch('/api/ai/stt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audioBase64: rawBase64 })
                  });
                  if (sttRes.ok) {
                    const sttData = await sttRes.json();
                    if (sttData.transcript) {
                      setVoiceTranscript(sttData.transcript);
                    }
                  }
                } catch {
                  // Mantener transcripción local
                }
              }
            };
            reader.readAsDataURL(blob);
          };
          recorder.start();
        }

        setIsRecording(true);
        return;
      } catch (err) {
        setMicError(classifyMediaError(err, 'micrófono'));
      }
    }

    // 3. Fallback asistido con onda simulada para que nunca quede un botón muerto
    setIsRecording(true);
    const animateFallback = () => {
      setWaveBars(
        Array.from({ length: 16 }, () => Math.floor(20 + Math.random() * 68))
      );
      animFrameRef.current = requestAnimationFrame(animateFallback);
    };
    animFrameRef.current = requestAnimationFrame(animateFallback);
  };

  const handleRunGraniteExtraction = async (
    textToParse = voiceTranscript,
    advanceStep = true
  ) => {
    if (!textToParse.trim()) return;
    setIsExtracting(true);
    triggerHaptic(14);

    const res = await extractFieldNoteWithGranite(
      textToParse,
      currentCrop,
      selectedParcel?.areaHa || 3.5,
      technician.forcedOfflineMode
    );

    const p = res.parsed;
    setActivity(p.activity);
    if (p.agrochemicalProduct) setAgrochemicalProduct(p.agrochemicalProduct);
    if (p.dosePerHa !== null) setDosePerHa(p.dosePerHa);
    if (p.doseUnit) setDoseUnit(p.doseUnit);
    if (p.treatedAreaHa !== null) setTreatedAreaHa(p.treatedAreaHa);
    if (p.waterVolumeM3 !== null) setWaterVolumeM3(p.waterVolumeM3);
    if (p.daysBeforeHarvest !== null) setDaysBeforeHarvest(p.daysBeforeHarvest);
    if (p.pestOrTarget) setPestOrTarget(p.pestOrTarget);
    setConfidence(p.confidence);
    setExtractedBy(res.provider === 'local-offline' ? 'local-deterministic' : 'ibm-granite');

    await db.aiTelemetry.put({
      id: `ai-ext-${Date.now()}`,
      createdAt: new Date().toISOString(),
      mode: 'extract',
      provider: res.provider,
      model: res.model,
      parcelCode: selectedParcel?.code,
      promptPreview: textToParse.slice(0, 120),
      responsePreview: JSON.stringify({
        product: p.agrochemicalProduct,
        dosePerHa: p.dosePerHa,
        daysBeforeHarvest: p.daysBeforeHarvest
      }),
      latencyMs: res.latencyMs,
      totalTokens: res.totalTokens,
      requestId: res.requestId
    });

    setIsExtracting(false);
    if (advanceStep) {
      setWizardStep(2);
    }
  };

  const handleLoadPreset = (preset: (typeof VOICE_DEMO_PRESETS)[number]) => {
    triggerHaptic(10);
    setSelectedParcelId(preset.parcelId);
    setVoiceTranscript(preset.transcript);
    handleRunGraniteExtraction(preset.transcript, false);
    pushToast({
      title: 'Caso de demostración cargado',
      description: 'Toca "Siguiente: Confirmar datos" para ver lo que entendió del dictado.',
      tone: 'info'
    });
  };

  const handleSaveVisitAndPassport = async (issuePassportNow: boolean) => {
    if (!selectedParcel || isSaving) return;

    if (issuePassportNow && !complianceReport.canIssuePassport) {
      pushToast({
        title: 'El Escudo Legal bloqueó el Pasaporte',
        description: 'Reprograma la fecha de cosecha arriba antes de sellar el lote.',
        tone: 'danger'
      });
      return;
    }

    setIsSaving(true);
    triggerHaptic([14, 30, 18]);

    const nowIso = new Date().toISOString();
    const visitId = `visit-${selectedParcel.code.toLowerCase()}-${Date.now().toString(36)}`;
    const passportId = issuePassportNow
      ? `PASS-2026-${selectedParcel.code.replace('LOTE-', '')}-${Math.floor(10 + Math.random() * 89)}`
      : undefined;

    const finalCoords = gpsFix || {
      ...selectedParcel.coordinates,
      source: 'parcel-polygon' as const
    };

    const visitRecord: VisitRecord = {
      id: visitId,
      parcelId: selectedParcel.id,
      parcelCode: selectedParcel.code,
      parcelName: selectedParcel.name,
      producerId: selectedParcel.producerId,
      producerName: selectedParcel.producerName,
      crop: selectedParcel.crop,
      technicianId: technician.id,
      technicianCip: technician.cipCode,
      visitedAt: nowIso,
      activity,
      voiceTranscript,
      audioClipDataUrl,
      extractedBy,
      extractionConfidence: confidence,
      agrochemicalProduct:
        activity === 'aplicacion_fitosanitaria' ? agrochemicalProduct : null,
      activeIngredient:
        activity === 'aplicacion_fitosanitaria'
          ? matchedCatalogSpec?.activeIngredient || agrochemicalProduct
          : null,
      dosePerHa: activity === 'aplicacion_fitosanitaria' ? dosePerHa : null,
      doseUnit: activity === 'aplicacion_fitosanitaria' ? doseUnit : null,
      treatedAreaHa,
      waterVolumeM3,
      soilMoisturePct: 60,
      daysBeforeHarvest,
      requiredPhiDays,
      pestOrTarget,
      photoDataUrl: photoDataUrl || selectedParcel.imageUrl,
      evidenceStamped,
      producerConfirmed,
      producerConfirmationName: selectedParcel.producerName,
      signatureDataUrl,
      coordinates: finalCoords,
      notes: 'Registrado en Voz de Campo v2',
      compliance: complianceReport,
      passportId,
      syncStatus: 'pending'
    };

    let createdPassport: PassportRecord | null = null;

    if (issuePassportNow && passportId) {
      const canonicalPayload: PassportCanonicalPayload = {
        passportId,
        version: 1,
        issuedAt: nowIso,
        parcelCode: selectedParcel.code,
        parcelName: selectedParcel.name,
        producerName: selectedParcel.producerName,
        cooperativeCode: 'SAC-PAC-2026',
        crop: selectedParcel.crop,
        areaHa: treatedAreaHa,
        visitId,
        visitedAt: nowIso,
        technicianCip: technician.cipCode,
        agrochemicalProduct: visitRecord.agrochemicalProduct,
        activeIngredient: visitRecord.activeIngredient,
        dosePerHa: visitRecord.dosePerHa,
        doseUnit: visitRecord.doseUnit,
        daysBeforeHarvest,
        requiredPhiDays,
        waterVolumeM3,
        complianceStatus: complianceReport.overallStatus,
        complianceScore: complianceReport.score,
        coordinates: {
          lat: finalCoords.lat,
          lng: finalCoords.lng
        }
      };

      const canonicalString = canonicalizePassportPayload(canonicalPayload);
      const sha256Hash = await computeSha256Hex(canonicalString);
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://voz-de-campo.vercel.app';
      const qrVerificationData = buildPassportVerificationUrl(
        origin,
        canonicalPayload,
        sha256Hash
      );

      createdPassport = {
        id: passportId,
        parcelId: selectedParcel.id,
        parcelCode: selectedParcel.code,
        parcelName: selectedParcel.name,
        producerName: selectedParcel.producerName,
        buyerName: 'Centro de Acopio AgroExport Pacífico · Recepción Certificada',
        buyerAvatarUrl: '/media/avatar-comprador.webp',
        crop: selectedParcel.crop,
        lotWeightTons: Number((treatedAreaHa * 9.2).toFixed(1)),
        visitId,
        issuedAt: nowIso,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'valid',
        sha256Hash,
        canonicalPayload,
        qrVerificationData,
        aiNarrativeSummary: `Lote ${selectedParcel.name} (${selectedParcel.crop}, ${treatedAreaHa} ha) verificado por ${technician.cipCode}. Manejo con ${visitRecord.agrochemicalProduct || 'práctica limpia'} y ${daysBeforeHarvest} días previos a cosecha (norma: ${requiredPhiDays}d). Sello SHA-256 íntegro.`,
        syncStatus: 'pending'
      };
    }

    const firstCritical = complianceReport.checks.find((c) => c.severity === 'critical');

    await db.transaction(
      'rw',
      [db.visits, db.parcels, db.passports, db.syncQueue],
      async () => {
        await db.visits.put(visitRecord);

        if (complianceReport.overallStatus === 'critical') {
          const existingPassports = await db.passports
            .where('parcelId')
            .equals(selectedParcel.id)
            .toArray();
          for (const ep of existingPassports) {
            await db.passports.update(ep.id, { status: 'requires_reissue' });
          }
        }

        await db.parcels.update(selectedParcel.id, {
          lastVisitDate: nowIso,
          complianceStatus: complianceReport.overallStatus,
          complianceScore: complianceReport.score,
          activeAlertTitle: firstCritical ? firstCritical.message : undefined,
          activeAlertRuleCode: firstCritical ? firstCritical.ruleCode : undefined,
          syncStatus: 'pending'
        });

        if (createdPassport) {
          await db.passports.put(createdPassport);
        }

        await db.syncQueue.put({
          id: `sync-${Date.now()}`,
          entityType: createdPassport ? 'passport' : 'visit',
          entityId: createdPassport ? createdPassport.id : visitRecord.id,
          parcelCode: selectedParcel.code,
          summary: createdPassport
            ? `Pasaporte QR ${createdPassport.id} (${selectedParcel.crop})`
            : `Visita en ${selectedParcel.name} (${selectedParcel.crop})`,
          createdAt: nowIso,
          status: 'pending',
          targetEndpoint: 'watsonx.data · bronze_agro_field_events_v2',
          payloadPreview: createdPassport
            ? (createdPassport.canonicalPayload as unknown as Record<string, unknown>)
            : {
                visit_id: visitRecord.id,
                parcel_code: visitRecord.parcelCode,
                crop: visitRecord.crop,
                product: visitRecord.agrochemicalProduct,
                dose_per_ha: visitRecord.dosePerHa,
                days_before_harvest: visitRecord.daysBeforeHarvest,
                compliance_score: complianceReport.score
              }
        });
      }
    );

    setIsSaving(false);

    if (createdPassport) {
      pushToast({
        title: `¡Pasaporte QR ${createdPassport.id} creado!`,
        description: 'Sello SHA-256 generado y listo para escanear.',
        tone: 'success'
      });
      navigate(`/pasaportes/${createdPassport.id}`);
    } else {
      pushToast({
        title: 'Visita guardada en tu teléfono',
        description: `${selectedParcel.name} actualizada.`,
        tone: 'success'
      });
      navigate(`/parcelas/${selectedParcel.id}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra superior del Wizard con Progreso */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (wizardStep > 1) {
              setWizardStep((s) => (s - 1) as 1 | 2 | 3);
            } else {
              navigate('/inicio');
            }
          }}
          className="w-10 h-10 rounded-2xl bg-app-surface-2 flex items-center justify-center text-app-ink shrink-0"
          aria-label="Paso anterior o salir"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Barra de progreso tipo Duolingo */}
        <div className="flex-1 h-3.5 rounded-full bg-app-surface-2 p-0.5 overflow-hidden border border-app-hairline">
          <motion.div
            animate={{ width: `${(wizardStep / 3) * 100}%` }}
            transition={{ duration: 0.25 }}
            className="h-full rounded-full bg-gradient-to-r from-[#58A700] to-[#7BD62B]"
          />
        </div>

        <span className="text-xs font-extrabold text-app-muted shrink-0">
          Paso {wizardStep}/3
        </span>
      </div>

      {/* Selector de Parcela */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-app-surface border border-app-hairline text-xs">
        <span className="font-bold text-app-muted flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-[#58A700]" />
          Parcela:
        </span>
        <select
          value={selectedParcelId}
          onChange={(e) => setSelectedParcelId(e.target.value)}
          className="bg-transparent font-extrabold text-app-ink focus:outline-none text-right"
        >
          {parcels.map((p) => (
            <option key={p.id} value={p.id} className="bg-app-surface text-app-ink">
              {p.name} · {p.crop} ({p.areaHa} ha)
            </option>
          ))}
        </select>
      </div>

      <AnimatePresence mode="wait">
        {/* PASO 1: ESCUCHAR / DICTAR CON ONDA REAL */}
        {wizardStep === 1 && (
          <motion.section
            key="step-1"
            data-tour="voice-capture-step"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className="card-duo p-5 space-y-4"
          >
            <div className="text-center space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#58A700] dark:text-[#7BD62B]">
                Paso 1 · Captura por voz
              </span>
              <h1 className="font-display font-extrabold text-2xl text-app-ink">
                Cuéntame qué hiciste hoy en la parcela
              </h1>
              <p className="text-xs text-app-muted">
                Menciona el producto aplicado, la dosis, el riego y en cuántos días planean cosechar
              </p>
            </div>

            {/* Botón Circular de Micrófono + Onda de Audio Real */}
            <div className="py-3 flex flex-col items-center justify-center space-y-4">
              <div className="relative flex items-center justify-center">
                {isRecording && (
                  <>
                    <motion.span
                      animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="absolute w-24 h-24 rounded-full bg-[#D64545]"
                    />
                    <motion.span
                      animate={{ scale: [1, 1.2], opacity: [0.35, 0] }}
                      transition={{ duration: 1.2, delay: 0.3, repeat: Infinity }}
                      className="absolute w-24 h-24 rounded-full bg-[#D64545]"
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={() =>
                    isRecording ? stopRecordingSession(true) : startRecordingSession()
                  }
                  className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    isRecording
                      ? 'bg-[#D64545] border-b-4 border-[#AB3030] text-white'
                      : 'bg-[#58A700] border-b-4 border-[#438200] text-white'
                  }`}
                >
                  {isRecording ? (
                    <MicOff className="w-9 h-9" />
                  ) : (
                    <Mic className="w-9 h-9" />
                  )}
                  <span className="text-[11px] font-extrabold mt-1">
                    {isRecording ? `00:${String(recordSeconds).padStart(2, '0')}` : 'Tocar'}
                  </span>
                </button>
              </div>

              {/* Onda de 16 barras */}
              <div className="h-10 flex items-center justify-center gap-1">
                {waveBars.map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${isRecording ? h : 18}%` }}
                    className={`w-1.5 rounded-full transition-all duration-75 ${
                      isRecording ? 'bg-[#58A700]' : 'bg-app-hairline'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Banner de Error de Permiso si aplica */}
            {micError && (
              <div className="p-3.5 rounded-2xl bg-[#FFC800]/20 border border-[#FFC800] text-xs space-y-1">
                <div className="font-extrabold text-app-ink flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-[#D64545]" />
                  <span>{micError.title}</span>
                </div>
                <p className="text-app-muted">{micError.instructions}</p>
              </div>
            )}

            {/* Reproductor del clip grabado si existe */}
            {audioClipDataUrl && (
              <div className="p-2.5 rounded-2xl bg-app-surface-2 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#58A700] shrink-0" />
                <audio controls src={audioClipDataUrl} className="h-8 w-full" />
              </div>
            )}

            {/* Chips de Casos de Prueba (1 toque) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-extrabold uppercase text-app-muted block">
                O elige un ejemplo rápido (1 toque):
              </span>
              <div className="flex flex-col gap-1.5">
                {VOICE_DEMO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleLoadPreset(preset)}
                    className="text-left text-xs font-bold px-3.5 py-2.5 rounded-2xl bg-app-surface-2 hover:bg-app-tint text-app-ink transition-colors flex items-center justify-between"
                  >
                    <span>{preset.label}</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#58A700] shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Texto editable */}
            <div>
              <label className="block text-xs font-bold text-app-muted mb-1">
                Nota transcrita (puedes editarla):
              </label>
              <textarea
                rows={3}
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline text-sm font-medium text-app-ink focus:outline-none focus:border-[#58A700]"
              />
            </div>

            <button
              type="button"
              disabled={isExtracting || !voiceTranscript.trim()}
              onClick={() => handleRunGraniteExtraction(voiceTranscript, true)}
              className="w-full py-3.5 px-4 btn-duo-primary text-sm inline-flex items-center justify-center gap-2"
            >
              <Wand2 className="w-4 h-4" />
              <span>
                {isExtracting
                  ? 'Ordenando lo que dictaste…'
                  : 'Siguiente: Confirmar datos extraídos'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.section>
        )}

        {/* PASO 2: CONFIRMAR DATOS CON STEPPERS + FOTO SELLADA + FIRMA */}
        {wizardStep === 2 && (
          <motion.section
            key="step-2"
            data-tour="confirm-step"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className="card-duo p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#58A700] dark:text-[#7BD62B]">
                  Paso 2 · Confirmación
                </span>
                <h1 className="font-display font-extrabold text-xl text-app-ink">
                  Esto entendió del dictado
                </h1>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-app-tint text-[#58A700] dark:text-[#7BD62B] text-xs font-extrabold">
                {Math.round(confidence * 100)}% precisión
              </span>
            </div>

            {/* Selector de Producto */}
            <div className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline space-y-1.5">
              <label className="text-xs font-extrabold text-app-muted block">
                Producto aplicado en {currentCrop}
              </label>
              <select
                value={agrochemicalProduct}
                onChange={(e) => setAgrochemicalProduct(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-app-surface border border-app-hairline text-sm font-extrabold text-app-ink"
              >
                {AGROCHEMICAL_CATALOG.map((item) => (
                  <option key={item.id} value={item.productName}>
                    {item.productName} (Espera: {item.phiDaysByCrop[currentCrop] ?? item.defaultPhiDays}d)
                  </option>
                ))}
              </select>
            </div>

            {/* Steppers grandes y cómodos */}
            <div className="grid grid-cols-2 gap-3">
              {/* Días para cosecha */}
              <div className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline space-y-2">
                <span className="text-xs font-extrabold text-app-muted block">
                  Días para cosechar
                </span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDaysBeforeHarvest((d) => Math.max(0, d - 1))}
                    className="w-9 h-9 rounded-xl bg-app-surface border border-app-hairline flex items-center justify-center text-app-ink"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span
                    className={`font-display font-extrabold text-xl ${
                      daysBeforeHarvest < requiredPhiDays
                        ? 'text-[#D64545]'
                        : 'text-[#58A700] dark:text-[#7BD62B]'
                    }`}
                  >
                    {daysBeforeHarvest} d
                  </span>
                  <button
                    type="button"
                    onClick={() => setDaysBeforeHarvest((d) => d + 1)}
                    className="w-9 h-9 rounded-xl bg-app-surface border border-app-hairline flex items-center justify-center text-app-ink"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[11px] font-bold text-app-muted block text-center">
                  Mínimo requerido: {requiredPhiDays} d
                </span>
              </div>

              {/* Dosis por hectárea */}
              <div className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline space-y-2">
                <span className="text-xs font-extrabold text-app-muted block">
                  Dosis ({doseUnit})
                </span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setDosePerHa((v) => Math.max(0.1, Number((v - 0.1).toFixed(1))))
                    }
                    className="w-9 h-9 rounded-xl bg-app-surface border border-app-hairline flex items-center justify-center text-app-ink"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-display font-extrabold text-xl text-app-ink">
                    {dosePerHa}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDosePerHa((v) => Number((v + 0.1).toFixed(1)))
                    }
                    className="w-9 h-9 rounded-xl bg-app-surface border border-app-hairline flex items-center justify-center text-app-ink"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[11px] font-bold text-app-muted block text-center">
                  Máx: {matchedCatalogSpec?.maxDosePerHa ?? 1.5} {doseUnit}
                </span>
              </div>
            </div>

            {/* Evidencia Fotográfica Sellada + Firma del Productor en Canvas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCameraModalOpen(true)}
                className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline flex items-center gap-3 text-left hover:bg-app-tint transition-colors"
              >
                {photoDataUrl && (
                  <img
                    src={photoDataUrl}
                    alt="Evidencia"
                    className="w-12 h-12 rounded-xl object-cover border border-app-hairline shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-app-ink flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-[#58A700]" />
                    <span>Foto con Sello</span>
                  </div>
                  <div className="text-[11px] text-app-muted truncate">
                    {evidenceStamped ? 'Sello GPS + Cédula activo' : 'Toca para tomar foto'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSignatureModalOpen(true)}
                className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline flex items-center gap-3 text-left hover:bg-app-tint transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-white border border-app-hairline flex items-center justify-center overflow-hidden shrink-0">
                  {signatureDataUrl ? (
                    <img
                      src={signatureDataUrl}
                      alt="Firma"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <PenTool className="w-5 h-5 text-[#58A700]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-app-ink">
                    {signatureDataUrl ? 'Firma capturada' : 'Firmar conformidad'}
                  </div>
                  <div className="text-[11px] text-app-muted truncate">
                    {selectedParcel?.producerName}
                  </div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                setWizardStep(3);
              }}
              className="w-full py-3.5 px-4 btn-duo-primary text-sm inline-flex items-center justify-center gap-2"
            >
              <span>Siguiente: Ver veredicto del Escudo Legal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.section>
        )}

        {/* PASO 3: VEREDICTO DEL ESCUDO LEGAL Y SELLO DE PASAPORTE QR */}
        {wizardStep === 3 && (
          <motion.section
            key="step-3"
            data-tour="shield-step"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className={`card-duo p-5 space-y-4 border-2 ${
              complianceReport.canIssuePassport ? 'border-[#58A700]' : 'border-[#D64545]'
            }`}
          >
            {/* Encabezado de Veredicto */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 ${
                  complianceReport.canIssuePassport
                    ? 'bg-[#58A700]/20 text-[#58A700]'
                    : 'bg-[#D64545]/15 text-[#D64545]'
                }`}
              >
                {complianceReport.canIssuePassport ? (
                  <ShieldCheck className="w-7 h-7" />
                ) : (
                  <ShieldAlert className="w-7 h-7" />
                )}
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-app-muted">
                  Paso 3 · Escudo Legal ({complianceReport.score}/100)
                </span>
                <h1 className="font-display font-extrabold text-xl text-app-ink leading-tight">
                  {complianceReport.canIssuePassport
                    ? '¡Lote aprobado para cosecha y acopio!'
                    : 'Espera: aún no se puede cosechar este lote'}
                </h1>
              </div>
            </div>

            {/* Reglas evaluadas */}
            <div className="space-y-2.5">
              {complianceReport.checks.map((chk) => (
                <div
                  key={chk.ruleCode}
                  className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-app-ink flex items-center gap-1.5">
                      {chk.severity === 'critical' ? (
                        <ShieldAlert className="w-4 h-4 text-[#D64545]" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#58A700]" />
                      )}
                      {chk.title}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-app-surface text-app-muted">
                      {chk.authority}
                    </span>
                  </div>

                  <p className="text-xs text-app-muted leading-relaxed">{chk.message}</p>

                  {chk.severity === 'critical' && daysBeforeHarvest < requiredPhiDays && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic([12, 24, 16]);
                        setDaysBeforeHarvest(requiredPhiDays + 1);
                        pushToast({
                          title: `¡Cosecha reprogramada a ${requiredPhiDays + 1} días!`,
                          description: 'El Escudo Legal ahora aprueba el lote.',
                          tone: 'success'
                        });
                      }}
                      className="w-full py-2.5 px-3 btn-duo-amber text-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Reprogramar cosecha a {requiredPhiDays + 1} días (1 toque)</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Botones de cierre */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={!complianceReport.canIssuePassport || isSaving}
                onClick={() => handleSaveVisitAndPassport(true)}
                className="w-full py-3.5 px-4 btn-duo-primary text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <QrCode className="w-5 h-5" />
                <span>Sellar y Emitir Pasaporte QR SHA-256</span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveVisitAndPassport(false)}
                className="w-full py-3 px-4 btn-duo-secondary text-xs inline-flex items-center justify-center gap-2"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Guardar solo visita (sin emitir pasaporte)</span>
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Modales de Cámara y Firma */}
      <CameraCaptureModal
        open={cameraModalOpen}
        stampMeta={{
          parcelCode: selectedParcel?.code || 'LOTE-4B',
          technicianCip: technician.cipCode,
          lat: gpsFix?.lat ?? selectedParcel?.coordinates.lat ?? 24.7642,
          lng: gpsFix?.lng ?? selectedParcel?.coordinates.lng ?? -107.6948,
          accuracyM: gpsFix?.accuracyM ?? 1.4
        }}
        onClose={() => setCameraModalOpen(false)}
        onCapturePhoto={(dataUrl, stamped) => {
          setPhotoDataUrl(dataUrl);
          setEvidenceStamped(stamped);
          pushToast({
            title: stamped ? 'Foto capturada con sello de evidencia' : 'Foto guardada',
            tone: 'success'
          });
        }}
      />

      <SignaturePadModal
        open={signatureModalOpen}
        producerName={selectedParcel?.producerName || 'Productor'}
        parcelCode={selectedParcel?.code || 'LOTE-4B'}
        onClose={() => setSignatureModalOpen(false)}
        onSaveSignature={(sigUrl) => {
          setSignatureDataUrl(sigUrl);
          setProducerConfirmed(true);
          pushToast({
            title: 'Firma del productor registrada',
            tone: 'success'
          });
        }}
      />
    </div>
  );
};
