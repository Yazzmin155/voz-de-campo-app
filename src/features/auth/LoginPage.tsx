import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Mic,
  Moon,
  QrCode,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound
} from 'lucide-react';
import { BrandWordmark } from '@/components/brand/BrandWordmark';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import {
  DEMO_ACCOUNT,
  clearStoredAccount,
  createLocalAccount,
  getStoredAccount,
  isValidEmail,
  normalizeCip,
  passwordStrength,
  validateCip,
  validatePassword,
  verifyLogin
} from '@/lib/auth';
import { ensureSeedData, useAppStore } from '@/lib/db';
import { triggerHaptic } from '@/lib/sensors';

const ONBOARDING_SLIDES = [
  {
    id: 'slide-voice',
    badge: '1 de 3',
    title: 'Registra el recorrido hablando',
    description:
      'Dicta lo que viste en el surco. La app lo guarda en el teléfono y separa producto, dosis y días a cosecha.',
    image: '/media/lote-limon.webp',
    icon: Mic
  },
  {
    id: 'slide-shield',
    badge: '2 de 3',
    title: 'Revisa la carencia antes de cosechar',
    description:
      'Si un lote no cumple el tiempo de espera o usa un producto restringido, la app te lo dice antes de que salga al acopio.',
    image: '/media/lote-maiz.webp',
    icon: ShieldCheck
  },
  {
    id: 'slide-qr',
    badge: '3 de 3',
    title: 'Entrega un pasaporte que se puede comprobar',
    description:
      'Cada lote aprobado lleva un QR con sello SHA-256. El comprador lo verifica en su teléfono, con o sin señal.',
    image: '/media/lote-agave.webp',
    icon: QrCode
  }
];

interface FormErrors {
  form?: string;
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  cip?: string;
  terms?: string;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    hasSeenSplash,
    hasCompletedOnboarding,
    themeMode,
    markSplashSeen,
    completeOnboarding,
    toggleDarkMode,
    login,
    pushToast
  } = useAppStore();

  const storedAccount = useMemo(() => getStoredAccount(), []);

  const [stage, setStage] = useState<'splash' | 'onboarding' | 'auth'>(
    !hasSeenSplash ? 'splash' : !hasCompletedOnboarding ? 'onboarding' : 'auth'
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [mode, setMode] = useState<'login' | 'register'>(storedAccount ? 'login' : 'register');

  const [name, setName] = useState('');
  const [email, setEmail] = useState(storedAccount?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cipCode, setCipCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [wantTutorial, setWantTutorial] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const isDark = themeMode === 'dark';
  const strength = passwordStrength(password);

  useEffect(() => {
    if (stage !== 'splash') return;
    const timer = setTimeout(() => {
      markSplashSeen();
      setStage(hasCompletedOnboarding ? 'auth' : 'onboarding');
    }, 1600);
    return () => clearTimeout(timer);
  }, [stage, hasCompletedOnboarding, markSplashSeen]);

  const goToAuth = () => {
    markSplashSeen();
    completeOnboarding();
    setStage('auth');
  };

  const enterApp = (identity: { name: string; email: string; cipCode: string }) => {
    login(identity, wantTutorial);
    const firstName = identity.name.replace(/^Ing\.\s*/i, '').split(' ')[0];
    pushToast({
      title: `Bienvenido, ${firstName}`,
      description: wantTutorial
        ? 'Te muestro la app en dos minutos. Puedes salir del recorrido cuando quieras.'
        : 'Tus parcelas de hoy ya están cargadas.',
      tone: 'success'
    });
    navigate('/inicio');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const nextErrors: FormErrors = {};
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) nextErrors.email = 'Escribe tu correo.';
    else if (!isValidEmail(cleanEmail)) nextErrors.email = 'Ese correo no parece válido.';

    if (!password) nextErrors.password = 'Escribe tu contraseña.';

    if (mode === 'register') {
      if (name.trim().length < 3) nextErrors.name = 'Escribe tu nombre completo.';
      const cipError = validateCip(cipCode);
      if (cipError) nextErrors.cip = cipError;
      const passwordError = password ? validatePassword(password) : null;
      if (passwordError) nextErrors.password = passwordError;
      if (!confirmPassword) nextErrors.confirm = 'Repite la contraseña.';
      else if (password !== confirmPassword) nextErrors.confirm = 'Las contraseñas no coinciden.';
      if (!acceptTerms) nextErrors.terms = 'Necesitamos tu aceptación para guardar la cuenta.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      triggerHaptic([8, 40, 8]);
      return;
    }

    setErrors({});
    setBusy(true);
    triggerHaptic(12);

    try {
      if (mode === 'register') {
        const result = await createLocalAccount({
          name,
          email: cleanEmail,
          password,
          cipCode
        });
        if (!result.ok) {
          setErrors({ form: result.error });
          return;
        }
        enterApp(result.identity);
        return;
      }

      const result = await verifyLogin(cleanEmail, password);
      if (!result.ok) {
        setErrors({ form: result.error });
        triggerHaptic([8, 40, 8]);
        return;
      }
      enterApp(result.identity);
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = async () => {
    triggerHaptic([12, 24, 14]);
    // Si el técnico borró sus datos, restauramos el expediente de ejemplo.
    await ensureSeedData();
    login(DEMO_ACCOUNT, wantTutorial);
    pushToast({
      title: 'Datos de ejemplo cargados',
      description: 'Ing. Danny Cárdenas · Cooperativa AgroExport del Pacífico.',
      tone: 'success'
    });
    navigate('/inicio');
  };

  return (
    <div className="h-dvh w-full bg-app-canvas text-app-ink flex justify-center overflow-hidden">
      <div className="w-full max-w-[520px] h-dvh flex flex-col px-5 pt-safe-top pb-safe relative overflow-y-auto app-scroll">
        <div className="flex items-center justify-between py-3 shrink-0">
          <BrandWordmark size="sm" />
          <div className="flex items-center gap-2">
            {stage === 'onboarding' && (
              <button
                type="button"
                onClick={goToAuth}
                className="px-3 py-1.5 rounded-full text-xs font-bold text-app-muted hover:text-app-ink transition-colors"
              >
                Saltar
              </button>
            )}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Cambiar modo de color"
              className="w-9 h-9 rounded-full bg-app-surface-2 flex items-center justify-center text-app-ink"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[var(--amber)]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {stage === 'splash' && (
            <motion.button
              key="splash"
              type="button"
              onClick={goToAuth}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-8"
            >
              <div className="w-24 h-24 rounded-[1.75rem] bg-white border-2 border-[var(--brand)] shadow-lg p-3 flex items-center justify-center">
                <img
                  src="/brand/logo-mark.png"
                  alt="Voz de Campo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1.5">
                <h1 className="font-display font-extrabold text-3xl">
                  Voz de <span className="text-[var(--brand)]">Campo</span>
                </h1>
                <p className="text-sm text-app-muted max-w-[260px]">
                  Tu cuaderno de campo, la revisión de carencias y el pasaporte del lote, en un solo lugar.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Preparando tus parcelas
              </span>
            </motion.button>
          )}

          {stage === 'onboarding' && (
            <motion.div
              key={`slide-${slideIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22 }}
              className="flex-1 flex flex-col justify-center gap-5 py-4"
            >
              {(() => {
                const slide = ONBOARDING_SLIDES[slideIndex];
                const SlideIcon = slide.icon;
                return (
                  <>
                    <div className="relative h-56 rounded-2xl overflow-hidden border border-app-hairline bg-app-surface-2">
                      <ImageWithFallback
                        src={slide.image}
                        alt={slide.title}
                        fallbackLabel="Voz de Campo"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 text-[#1B2A1F] text-[11px] font-extrabold">
                        {slide.badge}
                      </div>
                      <div className="absolute bottom-3 left-3 w-10 h-10 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center shadow-md">
                        <SlideIcon className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h1 className="font-display font-extrabold text-2xl leading-tight">
                        {slide.title}
                      </h1>
                      <p className="text-sm text-app-muted leading-relaxed">{slide.description}</p>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      {ONBOARDING_SLIDES.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-label={`Ver paso ${idx + 1}`}
                          onClick={() => setSlideIndex(idx)}
                          className={`h-2 rounded-full transition-all ${
                            idx === slideIndex ? 'w-7 bg-[var(--brand)]' : 'w-2 bg-app-hairline'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(12);
                        if (slideIndex < ONBOARDING_SLIDES.length - 1) {
                          setSlideIndex(slideIndex + 1);
                        } else {
                          goToAuth();
                        }
                      }}
                      className="w-full py-3.5 px-4 btn-duo-primary text-sm inline-flex items-center justify-center gap-2"
                    >
                      <span>{slideIndex < ONBOARDING_SLIDES.length - 1 ? 'Siguiente' : 'Crear mi cuenta'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                );
              })()}
            </motion.div>
          )}

          {stage === 'auth' && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="flex-1 flex flex-col justify-center gap-4 py-4"
            >
              <div className="space-y-1">
                <h1 className="font-display font-extrabold text-2xl leading-tight">
                  {mode === 'login' ? 'Entra a tu cuaderno' : 'Crea tu cuenta de campo'}
                </h1>
                <p className="text-sm text-app-muted">
                  {mode === 'login'
                    ? 'Tu cuenta y tus visitas viven en este teléfono, también sin señal.'
                    : 'Una cuenta local, sin trámites ni correos de confirmación.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-app-surface-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrors({});
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    mode === 'login' ? 'bg-app-surface text-app-ink shadow-sm' : 'text-app-muted'
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrors({});
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    mode === 'register' ? 'bg-app-surface text-app-ink shadow-sm' : 'text-app-muted'
                  }`}
                >
                  Crear cuenta
                </button>
              </div>

              {mode === 'register' && storedAccount && (
                <div className="px-3 py-2.5 rounded-xl bg-[var(--amber)]/12 border border-[var(--amber)]/30 text-[11px] font-semibold text-app-ink">
                  Ya hay una cuenta guardada en este teléfono. Si creas otra, se reemplaza el acceso.
                  Tus visitas y pasaportes no se borran.
                </div>
              )}

              <form onSubmit={handleSubmit} className="card-duo p-4 space-y-3.5" noValidate>
                {errors.form && (
                  <div
                    role="alert"
                    className="px-3 py-2.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-xs font-semibold text-[var(--danger-dark)] dark:text-[var(--danger)]"
                  >
                    {errors.form}
                  </div>
                )}

                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <label htmlFor="auth-name" className="block text-xs font-bold text-app-muted">
                      Nombre completo
                    </label>
                    <div className="relative">
                      <UserRound className="w-4 h-4 text-app-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setErrors((prev) => ({ ...prev, name: undefined, form: undefined }));
                        }}
                        placeholder="Ing. Danny Cárdenas"
                        aria-invalid={Boolean(errors.name)}
                        className="field-input field-input-icon"
                      />
                    </div>
                    {errors.name && (
                      <p className="text-[11px] font-semibold text-[var(--danger)]">{errors.name}</p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="auth-email" className="block text-xs font-bold text-app-muted">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-app-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrors((prev) => ({ ...prev, email: undefined, form: undefined }));
                      }}
                      placeholder="tu.correo@cooperativa.mx"
                      aria-invalid={Boolean(errors.email)}
                      className="field-input field-input-icon"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-[11px] font-semibold text-[var(--danger)]">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="auth-password" className="block text-xs font-bold text-app-muted">
                    Contraseña
                  </label>
                  <div className="relative">
                    <LockKeyhole className="w-4 h-4 text-app-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((prev) => ({ ...prev, password: undefined, form: undefined }));
                      }}
                      placeholder="Mínimo 8 caracteres"
                      aria-invalid={Boolean(errors.password)}
                      className="field-input field-input-icon field-input-trailing"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-app-muted hover:text-app-ink"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[11px] font-semibold text-[var(--danger)]">{errors.password}</p>
                  )}

                  {mode === 'register' && password.length > 0 && (
                    <div className="space-y-1 pt-0.5">
                      <div className="flex gap-1" aria-hidden="true">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i < strength.score
                                ? strength.tone === 'danger'
                                  ? 'bg-[var(--danger)]'
                                  : strength.tone === 'warning'
                                    ? 'bg-[var(--amber)]'
                                    : 'bg-[var(--brand)]'
                                : 'bg-app-hairline'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] font-semibold text-app-muted">
                        Seguridad: {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {mode === 'register' && (
                  <>
                    <div className="space-y-1.5">
                      <label htmlFor="auth-confirm" className="block text-xs font-bold text-app-muted">
                        Repite la contraseña
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-app-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="auth-confirm"
                          type={showConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setErrors((prev) => ({ ...prev, confirm: undefined, form: undefined }));
                          }}
                          aria-invalid={Boolean(errors.confirm)}
                          className="field-input field-input-icon field-input-trailing"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          aria-pressed={showConfirm}
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-app-muted hover:text-app-ink"
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.confirm && (
                        <p className="text-[11px] font-semibold text-[var(--danger)]">{errors.confirm}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="auth-cip" className="block text-xs font-bold text-app-muted">
                        Cédula profesional
                      </label>
                      <input
                        id="auth-cip"
                        type="text"
                        inputMode="numeric"
                        value={cipCode}
                        onChange={(e) => {
                          setCipCode(normalizeCip(e.target.value));
                          setErrors((prev) => ({ ...prev, cip: undefined, form: undefined }));
                        }}
                        placeholder="CIP-84920"
                        aria-invalid={Boolean(errors.cip)}
                        className="field-input font-mono-tech text-xs uppercase"
                      />
                      {errors.cip && (
                        <p className="text-[11px] font-semibold text-[var(--danger)]">{errors.cip}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acceptTerms}
                          onChange={(e) => {
                            setAcceptTerms(e.target.checked);
                            setErrors((prev) => ({ ...prev, terms: undefined }));
                          }}
                          className="mt-0.5 w-4 h-4 accent-[var(--brand)] shrink-0"
                        />
                        <span className="text-[11px] text-app-muted leading-snug">
                          Acepto que mi cuenta y mis registros se guarden en este teléfono y que
                          puedo exportarlos o borrarlos cuando quiera.
                        </span>
                      </label>
                      {errors.terms && (
                        <p className="text-[11px] font-semibold text-[var(--danger)]">{errors.terms}</p>
                      )}
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 btn-duo-primary text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{mode === 'login' ? 'Verificando…' : 'Creando cuenta…'}</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="w-full text-center text-[11px] font-bold text-app-muted hover:text-app-ink"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}

                <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantTutorial}
                    onChange={(e) => setWantTutorial(e.target.checked)}
                    className="w-4 h-4 accent-[var(--brand)] shrink-0"
                  />
                  <span className="text-[11px] font-semibold text-app-muted">
                    Mostrarme el recorrido de la app al entrar
                  </span>
                </label>
              </form>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleDemo}
                  className="w-full py-2.5 rounded-xl bg-app-surface-2 hover:bg-app-tint text-xs font-bold text-app-ink inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-[var(--amber)]" />
                  <span>Probar con datos de ejemplo</span>
                </button>
                <p className="text-[11px] text-app-muted text-center leading-snug">
                  Los datos de ejemplo usan la cuenta de Ing. Danny Cárdenas y no piden registro.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="text-center text-[11px] font-medium text-app-muted py-3 shrink-0">
          Tus registros se quedan en este teléfono. Sin suscripciones ni servidores externos.
        </footer>
      </div>

      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            onClick={() => setForgotOpen(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[520px] bg-app-surface rounded-t-3xl p-5 space-y-4 pb-safe"
            >
              <div className="space-y-1.5">
                <h2 className="font-display font-extrabold text-lg">Recuperar el acceso</h2>
                <p className="text-xs text-app-muted leading-relaxed">
                  Tu cuenta vive solo en este teléfono, así que no podemos enviarte un correo de
                  recuperación. Puedes crear una cuenta nueva o entrar con los datos de ejemplo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearStoredAccount();
                  setForgotOpen(false);
                  setMode('register');
                  setEmail('');
                  setPassword('');
                  setErrors({});
                }}
                className="w-full py-3 btn-duo-secondary text-xs"
              >
                Crear una cuenta nueva
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(false);
                  handleDemo();
                }}
                className="w-full py-3 btn-duo-primary text-xs"
              >
                Entrar con datos de ejemplo
              </button>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="w-full py-2 text-xs font-bold text-app-muted"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
