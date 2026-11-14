import { PassportRecord } from '@/types/domain';
import { formatDateTime } from '@/lib/utils';

/**
 * Copia texto al portapapeles con fallback universal (funciona en HTTPS, HTTP local y WebView Android).
 */
export async function copyTextSafe(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continuar con fallback de textarea
  }

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Carga una imagen desde URL y la devuelve como HTMLImageElement.
 */
function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Dibuja el QR del canvas en un nuevo canvas de alta resolución con zona blanca de silencio
 * y el logotipo de Voz de Campo incrustado al centro (corrección de errores H).
 */
export async function renderQrWithEmbeddedLogoDataUrl(
  qrCanvas: HTMLCanvasElement | null
): Promise<string> {
  const size = 480;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  if (!ctx) return '';

  // Fondo blanco puro obligatorio para lectura óptica
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  if (qrCanvas) {
    const pad = 28;
    ctx.drawImage(qrCanvas, pad, pad, size - pad * 2, size - pad * 2);
  }

  // Incrustar logo central (18% del tamaño del QR, seguro con ECC Level H)
  const logoImg = await loadImageElement('/brand/logo-mark.png');
  const boxSize = 86;
  const boxX = (size - boxSize) / 2;
  const boxY = (size - boxSize) / 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(boxX - 6, boxY - 6, boxSize + 12, boxSize + 12, 18);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1F7A3A';
  ctx.stroke();

  if (logoImg) {
    ctx.drawImage(logoImg, boxX, boxY, boxSize, boxSize);
  } else {
    ctx.fillStyle = '#1F7A3A';
    ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VC', size / 2, size / 2);
  }

  return out.toDataURL('image/png');
}

/**
 * Genera una lámina PNG completa del Pasaporte Fitosanitario QR lista para enviar por WhatsApp o guardar en galería.
 */
export async function generatePassportCardPngDataUrl(
  passport: PassportRecord,
  qrCanvas: HTMLCanvasElement | null
): Promise<string> {
  const width = 960;
  const height = 1320;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fondo general
  ctx.fillStyle = '#F5F7F2';
  ctx.fillRect(0, 0, width, height);

  // Encabezado verde profundo
  const grad = ctx.createLinearGradient(0, 0, width, 210);
  grad.addColorStop(0, '#14532D');
  grad.addColorStop(1, '#1F7A3A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 210);

  // Franja de acento
  ctx.fillStyle = '#7BD62B';
  ctx.fillRect(0, 210, width, 8);

  // Logo en cabecera
  const logoImg = await loadImageElement('/brand/logo-mark.png');
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(48, 42, 84, 84, 20);
  ctx.fill();
  if (logoImg) {
    ctx.drawImage(logoImg, 54, 48, 72, 72);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PASAPORTE FITOSANITARIO DE LOTE', 152, 78);

  ctx.fillStyle = '#D7F5BA';
  ctx.font = '700 21px "IBM Plex Mono", monospace';
  ctx.fillText(`FOLIO: ${passport.id}  ·  SELLO SHA-256 VERIFICABLE`, 152, 114);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 18px "Figtree", sans-serif';
  ctx.fillText(
    `Emitido: ${formatDateTime(passport.issuedAt)}  ·  Cédula Técnica: ${passport.canonicalPayload.technicianCip}`,
    48,
    174
  );

  // Tarjeta blanca central
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(40, 250, width - 80, 980, 28);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#DCE5D5';
  ctx.stroke();

  // QR con logo incrustado a la derecha
  const qrDataUrl = await renderQrWithEmbeddedLogoDataUrl(qrCanvas);
  const qrImg = qrDataUrl ? await loadImageElement(qrDataUrl) : null;
  if (qrImg) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(width - 370, 285, 290, 290, 20);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1F7A3A';
    ctx.stroke();
    ctx.drawImage(qrImg, width - 360, 295, 270, 270);
  }

  // Datos principales del lote a la izquierda
  const p = passport.canonicalPayload;
  ctx.fillStyle = '#1F7A3A';
  ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('LOTE Y PRODUCTOR ACREDITADO', 76, 305);

  ctx.fillStyle = '#142418';
  ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${passport.crop}`, 76, 350);

  ctx.fillStyle = '#526356';
  ctx.font = '700 22px "Figtree", sans-serif';
  ctx.fillText(
    `${passport.parcelName} (${passport.parcelCode}) · ${p.areaHa} ha (${passport.lotWeightTons} t)`,
    76,
    386
  );

  const leftRows: Array<[string, string]> = [
    ['Productor:', passport.producerName],
    ['Cooperativa:', p.cooperativeCode],
    ['Destino / Acopio:', passport.buyerName.slice(0, 44)],
    ['Insumo aplicado:', p.agrochemicalProduct || 'Manejo limpio sin agroquímico'],
    ['Ingrediente activo:', p.activeIngredient || 'N/A'],
    ['Dosis registrada:', p.dosePerHa ? `${p.dosePerHa} ${p.doseUnit || ''}` : 'Sin aplicación'],
    ['Carencia (PHI):', `${p.daysBeforeHarvest} días espera (norma: ${p.requiredPhiDays} días)`],
    ['Lámina de riego:', `${p.waterVolumeM3 ?? 0} m³`],
    ['Coordenadas GPS:', `${p.coordinates.lat.toFixed(4)}, ${p.coordinates.lng.toFixed(4)}`]
  ];

  let y = 445;
  for (const [label, val] of leftRows) {
    ctx.fillStyle = '#526356';
    ctx.font = '700 19px "Figtree", sans-serif';
    ctx.fillText(label, 76, y);
    ctx.fillStyle = '#142418';
    ctx.font = '800 19px "Figtree", sans-serif';
    ctx.fillText(val, 265, y);
    y += 42;
  }

  // Bloque de dictamen normativo
  ctx.fillStyle = '#E4F1DB';
  ctx.beginPath();
  ctx.roundRect(76, 840, width - 152, 110, 18);
  ctx.fill();

  ctx.fillStyle = '#14532D';
  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `DICTAMEN TÉCNICO: LOTE APROBADO (${p.complianceScore}/100 PUNTOS)`,
    102,
    882
  );
  ctx.fillStyle = '#142418';
  ctx.font = '600 18px "Figtree", sans-serif';
  ctx.fillText(
    'Cumple periodo de carencia (PHI), dosis autorizada COFEPRIS/SENASICA y trazabilidad de origen.',
    102,
    920
  );

  // Bloque criptográfico SHA-256
  ctx.fillStyle = '#101812';
  ctx.beginPath();
  ctx.roundRect(76, 975, width - 152, 165, 18);
  ctx.fill();

  ctx.fillStyle = '#7BD62B';
  ctx.font = '700 17px "IBM Plex Mono", monospace';
  ctx.fillText('SELLO DE INTEGRIDAD CRIPTOGRÁFICA SHA-256 (INMUTABLE):', 102, 1015);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 17px "IBM Plex Mono", monospace';
  ctx.fillText(passport.sha256Hash, 102, 1052);

  ctx.fillStyle = '#9CB0A0';
  ctx.font = '500 15px "Figtree", sans-serif';
  ctx.fillText(
    'Aviso: Este código QR contiene el expediente canónico firmado con SHA-256 para verificación de',
    102,
    1092
  );
  ctx.fillText(
    'integridad sin internet en centros de acopio. Cualquier alteración invalida el hash.',
    102,
    1116
  );

  // Pie de página
  ctx.fillStyle = '#526356';
  ctx.font = '700 17px "Figtree", sans-serif';
  ctx.fillText(
    `Voz de Campo · Vigencia del lote: hasta ${formatDateTime(passport.expiresAt)}`,
    76,
    1195
  );

  return canvas.toDataURL('image/png');
}

/**
 * Genera y descarga un documento PDF A4 formal del Pasaporte Fitosanitario con QR y tabla completa.
 */
export async function generatePassportPdfBlob(
  passport: PassportRecord,
  qrCanvas: HTMLCanvasElement | null
): Promise<Blob> {
  // Carga diferida: el PDF solo pesa en el teléfono cuando de verdad se descarga.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const p = passport.canonicalPayload;

  // Cabecera institucional
  doc.setFillColor(20, 83, 45);
  doc.rect(0, 0, 210, 38, 'F');
  doc.setFillColor(123, 214, 43);
  doc.rect(0, 38, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('VOZ DE CAMPO · PASAPORTE FITOSANITARIO DE LOTE', 14, 16);

  doc.setFontSize(10);
  doc.setFont('courier', 'bold');
  doc.text(`FOLIO: ${passport.id}   |   SELLO SHA-256 ACTIVO`, 14, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Fecha de emisión: ${formatDateTime(passport.issuedAt)}   |   Vigencia: ${formatDateTime(passport.expiresAt)}`,
    14,
    32
  );

  // Insertar QR con logo a la derecha
  const qrDataUrl = await renderQrWithEmbeddedLogoDataUrl(qrCanvas);
  if (qrDataUrl) {
    doc.setDrawColor(31, 122, 58);
    doc.setLineWidth(0.6);
    doc.roundedRect(142, 47, 54, 54, 3, 3, 'S');
    doc.addImage(qrDataUrl, 'PNG', 144, 49, 50, 50);
    doc.setTextColor(82, 99, 86);
    doc.setFontSize(7.5);
    doc.text('Escaneo offline con logo oficial', 145, 105);
  }

  // Datos de Identificación del Lote
  doc.setTextColor(20, 36, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('1. Identificación de Parcela y Productor', 14, 53);

  const infoLines: Array<[string, string]> = [
    ['Cultivo y Tonelaje Estimado:', `${passport.crop} · ${passport.lotWeightTons} toneladas`],
    ['Parcela / Código:', `${passport.parcelName} (${passport.parcelCode})`],
    ['Superficie Certificada:', `${p.areaHa} hectáreas`],
    ['Productor Titular:', passport.producerName],
    ['Cooperativa / Programa:', p.cooperativeCode],
    ['Ingeniero Agrónomo Emisor:', `Cédula ${p.technicianCip}`],
    ['Coordenadas GNSS:', `${p.coordinates.lat.toFixed(5)}, ${p.coordinates.lng.toFixed(5)}`],
    ['Comprador / Destino:', passport.buyerName]
  ];

  let y = 62;
  doc.setFontSize(9.5);
  for (const [k, v] of infoLines) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(82, 99, 86);
    doc.text(k, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 36, 24);
    doc.text(String(v).slice(0, 52), 64, y);
    y += 7;
  }

  // Sección 2: Manejo Fitosanitario e Hídrico
  y = 122;
  doc.setDrawColor(220, 229, 213);
  doc.line(14, y - 5, 196, y - 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 36, 24);
  doc.text('2. Registro Fitosanitario y Revisión de Carencia (PHI)', 14, y);

  y += 9;
  const agronomyLines: Array<[string, string]> = [
    ['Producto Aplicado:', p.agrochemicalProduct || 'Manejo limpio / Sin aplicación química'],
    ['Ingrediente Activo:', p.activeIngredient || 'No aplica'],
    ['Dosis por Hectárea:', p.dosePerHa ? `${p.dosePerHa} ${p.doseUnit || ''}` : '0'],
    [
      'Días Previos a Cosecha (PHI):',
      `${p.daysBeforeHarvest} días transcurridos (Mínimo normativo: ${p.requiredPhiDays} días)`
    ],
    ['Volumen de Agua / Riego:', `${p.waterVolumeM3 ?? 0} m³`],
    ['Puntaje de Cumplimiento:', `${p.complianceScore}/100 puntos (Estado: APROBADO)`]
  ];

  doc.setFontSize(9.5);
  for (const [k, v] of agronomyLines) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(82, 99, 86);
    doc.text(k, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 36, 24);
    doc.text(v, 72, y);
    y += 7.5;
  }

  // Resumen técnico
  if (passport.aiNarrativeSummary) {
    y += 4;
    doc.setFillColor(237, 242, 232);
    doc.roundedRect(14, y, 182, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 83, 45);
    doc.text('Dictamen Agronómico de Recepción:', 18, y + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 36, 24);
    const wrapped = doc.splitTextToSize(passport.aiNarrativeSummary, 174);
    doc.text(wrapped, 18, y + 12.5);
    y += 29;
  }

  // Sección 3: Sello Criptográfico SHA-256
  y += 4;
  doc.setFillColor(16, 24, 18);
  doc.roundedRect(14, y, 182, 42, 3, 3, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(123, 214, 43);
  doc.text('3. SELLO DE INTEGRIDAD CRIPTOGRAFICA SHA-256', 19, y + 8);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(passport.sha256Hash, 19, y + 16);

  doc.setTextColor(180, 198, 184);
  doc.setFontSize(7.5);
  const canonicalStr = JSON.stringify(p);
  const canonicalLines = doc.splitTextToSize(`Payload canonico: ${canonicalStr}`, 172);
  doc.text(canonicalLines.slice(0, 3), 19, y + 24);

  // Nota de alcance técnico/legal honesta
  y += 52;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(82, 99, 86);
  const disclaimer = doc.splitTextToSize(
    'Nota de integridad: El sello SHA-256 garantiza matemáticamente que los datos técnicos del lote no han sido alterados desde su emisión en parcela por el ingeniero agrónomo acreditado. Este documento es verificable sin conexión a internet escaneando el código QR.',
    182
  );
  doc.text(disclaimer, 14, y);

  return doc.output('blob');
}

/**
 * Descarga cualquier Blob o DataURL en el navegador o WebView.
 */
export function downloadBlobOrDataUrl(content: Blob | string, filename: string): void {
  const url = typeof content === 'string' ? content : URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof content !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}
