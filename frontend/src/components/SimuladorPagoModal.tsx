import { useEffect, useState, useMemo } from 'react';
import { CreditCard, Wifi, CheckCircle2, X, Smartphone, ShieldCheck } from 'lucide-react';

interface SimuladorPagoModalProps {
  isOpen: boolean;
  metodo: 'TARJETA' | 'QR' | null;
  total: number;
  onSuccess: (metodo: 'TARJETA' | 'QR') => void;
  onCancel: () => void;
}

// Generador de matriz para el código QR dinámico de DeUna (Banco Pichincha)
function generarMatrizQR(seedStr: string): boolean[][] {
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Función para dibujar los ojos de posición (Finder patterns 7x7)
  const drawFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startY + r][startX + c] = true;
        }
      }
    }
  };

  drawFinder(0, 0); // Top-left
  drawFinder(size - 7, 0); // Top-right
  drawFinder(0, size - 7); // Bottom-left

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (i % 2 === 0) {
      matrix[6][i] = true;
      matrix[i][6] = true;
    }
  }

  // Generar datos pseudoaleatorios basados en el seed (monto y fecha)
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Ignorar zonas de los finders y centro
      const inTL = r < 8 && c < 8;
      const inTR = r < 8 && c >= size - 8;
      const inBL = r >= size - 8 && c < 8;
      const inCenter = r >= 10 && r <= 14 && c >= 10 && c <= 14;

      if (!inTL && !inTR && !inBL && !inCenter && matrix[r][c] === false) {
        const val = Math.sin((r * 31 + c * 17 + hash)) * 10000;
        matrix[r][c] = (val - Math.floor(val)) > 0.45;
      }
    }
  }

  return matrix;
}

export default function SimuladorPagoModal({
  isOpen,
  metodo,
  total,
  onSuccess,
  onCancel,
}: SimuladorPagoModalProps) {
  const [milisegundos, setMilisegundos] = useState(3000);
  const duracionTotal = 3000;

  useEffect(() => {
    if (!isOpen || !metodo) {
      setMilisegundos(3000);
      return;
    }

    setMilisegundos(3000);
    const inicio = Date.now();
    const interval = setInterval(() => {
      const transcurrido = Date.now() - inicio;
      const restante = Math.max(0, duracionTotal - transcurrido);
      setMilisegundos(restante);

      if (restante <= 0) {
        clearInterval(interval);
        setTimeout(() => {
          onSuccess(metodo);
        }, 150);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, metodo, onSuccess]);

  const matrizQR = useMemo(() => {
    return generarMatrizQR(`DEUNA-${total.toFixed(2)}-PICHINCHA`);
  }, [total]);

  if (!isOpen || !metodo) return null;

  const segundosVisual = (milisegundos / 1000).toFixed(1);
  const porcentaje = Math.min(100, Math.max(0, ((duracionTotal - milisegundos) / duracionTotal) * 100));

  return (
    <div className="fixed inset-0 bg-on-surface/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full border border-surface-container-high overflow-hidden animate-in zoom-in-95 duration-200 relative">
        
        {/* ========================================================================= */}
        {/* CASO 1: SIMULADOR DE PAGO CON TARJETA (CONTACTLESS / DATÁFONO)             */}
        {/* ========================================================================= */}
        {metodo === 'TARJETA' && (
          <div className="flex flex-col items-center p-6 sm:p-8 text-center">
            
            {/* Header Terminal */}
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-full">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                </span>
                <span className="font-label-caps text-[11px] font-bold text-on-surface uppercase tracking-wider">
                  Terminal POS Contactless
                </span>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
                title="Cancelar cobro"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ilustración interactiva Contactless */}
            <div className="relative my-4 flex items-center justify-center w-36 h-36">
              {/* Ondas pulsantes de señal NFC */}
              <div className="absolute inset-0 rounded-full border-4 border-secondary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-secondary/30 animate-pulse" />
              
              <div className="w-24 h-24 rounded-2xl bg-secondary-fixed/30 border-2 border-secondary/50 flex flex-col items-center justify-center shadow-lg relative z-10">
                <Wifi className="w-8 h-8 text-secondary rotate-90 mb-1 animate-bounce" />
                <CreditCard className="w-9 h-9 text-secondary" />
              </div>
            </div>

            {/* Mensaje de Acción para el Cliente */}
            <h3 className="font-headline-md text-2xl font-bold text-on-surface tracking-tight mt-1">
              Acerque su Tarjeta
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Terminal listo: Acerque su tarjeta Visa, Mastercard o inserte el chip
            </p>

            {/* Monto Gigante */}
            <div className="my-5 px-6 py-3 bg-surface-container-low rounded-2xl border border-surface-container-high/60 w-full">
              <span className="font-label-caps text-[11px] uppercase text-on-surface-variant font-bold block">
                Total a Cobrar
              </span>
              <span className="font-label-numeric-md text-3xl font-bold text-primary">
                ${total.toFixed(2)}
              </span>
            </div>

            {/* Barra de progreso de 3 segundos */}
            <div className="w-full bg-surface-container-high rounded-full h-2.5 mb-3 overflow-hidden">
              <div 
                className="bg-secondary h-full transition-all duration-75 ease-linear rounded-full"
                style={{ width: `${porcentaje}%` }}
              />
            </div>

            {/* Estado del lector */}
            <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant mb-6">
              {milisegundos > 1800 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Esperando proximidad de tarjeta ({segundosVisual}s)...</span>
                </>
              ) : milisegundos > 500 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <span>Leyendo chip y autorizando con banco ({segundosVisual}s)...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-primary animate-in zoom-in" />
                  <span className="text-primary font-bold">¡Pago Aprobado! Emitiendo ticket...</span>
                </>
              )}
            </div>

            {/* Botón de Cancelar */}
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 rounded-full border border-outline/30 hover:bg-surface-container text-on-surface-variant font-label-caps text-label-caps uppercase font-bold transition-all cursor-pointer"
            >
              Cancelar Operación
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASO 2: SIMULADOR DE PAGO CON QR DEUNA (BANCO PICHINCHA)                   */}
        {/* ========================================================================= */}
        {metodo === 'QR' && (
          <div className="flex flex-col items-center text-center">
            
            {/* Header Brand DeUna • Banco Pichincha */}
            <div className="w-full bg-gradient-to-r from-[#5b13b9] via-[#7800ff] to-[#9b27b0] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-purple-950 font-black flex items-center justify-center text-lg shadow-md tracking-tighter">
                  D!
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-md text-lg font-black tracking-tight text-white">DeUna!</span>
                    <span className="text-[10px] bg-yellow-400 text-purple-950 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Oficial
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-100 font-semibold">
                    Red de Pagos Banco Pichincha
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-7 w-full flex flex-col items-center">
              
              <span className="font-label-caps text-[11px] uppercase text-on-surface-variant font-bold tracking-wider mb-2">
                Escanea y Paga al Instante
              </span>

              {/* Contenedor del Código QR generado */}
              <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-purple-200 relative mb-4">
                <svg
                  viewBox={`0 0 ${matrizQR.length} ${matrizQR.length}`}
                  className="w-48 h-48 sm:w-52 sm:h-52 shape-rendering-crisp"
                >
                  {matrizQR.map((row, rIdx) =>
                    row.map((active, cIdx) =>
                      active ? (
                        <rect
                          key={`${rIdx}-${cIdx}`}
                          x={cIdx}
                          y={rIdx}
                          width="1"
                          height="1"
                          fill="#2a0845"
                        />
                      ) : null
                    )
                  )}
                </svg>

                {/* Logotipo Central DeUna */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-2.5 py-1 bg-yellow-400 text-purple-950 font-black text-xs rounded-lg shadow-md border-2 border-white flex items-center gap-1">
                    <span>DeUna!</span>
                  </div>
                </div>
              </div>

              {/* Monto de la Transacción */}
              <div className="flex items-baseline justify-center gap-1.5 mb-1">
                <span className="text-body-sm text-on-surface-variant font-semibold">Monto exacto:</span>
                <span className="font-label-numeric-md text-2xl font-bold text-purple-900 dark:text-purple-300">
                  ${total.toFixed(2)}
                </span>
              </div>
              
              <p className="font-body-sm text-xs text-on-surface-variant max-w-xs mb-4">
                Abre tu app <strong className="text-purple-800 dark:text-purple-300">DeUna</strong> o la app móvil de <strong className="text-purple-800 dark:text-purple-300">Banco Pichincha</strong> y enfoca la cámara.
              </p>

              {/* Barra de progreso de confirmación (3 segundos) */}
              <div className="w-full bg-surface-container-high rounded-full h-2.5 mb-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-yellow-400 to-[#7800ff] h-full transition-all duration-75 ease-linear rounded-full"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>

              {/* Estado de sincronización DeUna */}
              <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant mb-5">
                {milisegundos > 1800 ? (
                  <>
                    <Smartphone className="w-4 h-4 text-purple-600 animate-bounce" />
                    <span>Esperando escaneo en app DeUna ({segundosVisual}s)...</span>
                  </>
                ) : milisegundos > 500 ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-yellow-600 animate-pulse" />
                    <span>Confirmando débito con Banco Pichincha ({segundosVisual}s)...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-in zoom-in" />
                    <span className="text-emerald-600 font-bold">¡Pago recibido en cuenta Pichincha!</span>
                  </>
                )}
              </div>

              {/* Botón de Cancelar */}
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-2.5 rounded-full border border-outline/30 hover:bg-surface-container text-on-surface-variant font-label-caps text-label-caps uppercase font-bold transition-all cursor-pointer"
              >
                Cancelar Cobro QR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
