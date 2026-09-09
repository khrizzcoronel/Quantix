import React, { useState, useEffect, useEffectEvent, useRef, useMemo } from 'react';
import { usePOSStore } from '../store/posStore';
import { useCajaStore } from '../store/cajaStore';
import { useAuthStore } from '../store/authStore';
import { 
  Search, Trash2, Plus, Minus, CreditCard, Banknote, ShoppingCart, 
  UserCheck, Tag, LogOut, ShieldCheck, CheckCircle2, Receipt,
  Eye, X, Ban, AlertTriangle, Info, Zap, Clock, Trophy, Target,
  Printer, Filter
} from 'lucide-react';
import AperturaCajaModal from '../components/AperturaCajaModal';
import ArqueoCiegoModal from '../components/ArqueoCiegoModal';
import TicketModal, { type TicketData } from '../components/TicketModal';
import VentaFlashGrid, { type ProductoCatalogo } from '../components/VentaFlashGrid';
import api from '../services/api';

interface VentaTicket {
  id: string;
  sesion_caja_id: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  folio_ticket: string;
  fecha_hora: string;
  total_bruto: number;
  total_descuento: number;
  total_impuestos: number;
  total_pagar: number;
  estado: string;
  items_count: number;
}

interface DetalleVentaModalData {
  id: string;
  folio_ticket: string;
  fecha_hora: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  total_bruto: number;
  total_descuento: number;
  total_impuestos: number;
  total_pagar: number;
  estado: string;
  detalles: Array<{
    id: string;
    producto_nombre: string;
    producto_sku: string;
    lote_codigo: string | null;
    cantidad: number;
    costo_unitario_lote: number;
    precio_unitario_venta: number;
    subtotal: number;
    margen_ganancia: number;
  }>;
  pagos: Array<{
    id: string;
    metodo_pago: string;
    monto: number;
    referencia_pasarela: string | null;
  }>;
}

const getApiError = (error: unknown, fallback: string): string => {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

export default function POS() {
  const { cart, total, addItem, removeItem, updateQuantity, clearCart } = usePOSStore();
  const { estaAbierta, sesionActiva, recuperarSesionActiva } = useCajaStore();
  const user = useAuthStore((state) => state.user);

  const [products, setProducts] = useState<ProductoCatalogo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TARJETA'>('EFECTIVO');
  const [showArqueoModal, setShowArqueoModal] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  // Modo Venta Flash Táctil
  const [modoVentaFlash, setModoVentaFlash] = useState(false);

  // Búsquedas Recientes
  const [busquedasRecientes, setBusquedasRecientes] = useState<string[]>(() => {
    try {
      const guardadas = localStorage.getItem('quantix_busquedas_recientes');
      return guardadas ? JSON.parse(guardadas) : [];
    } catch {
      return [];
    }
  });

  // Autocompletado Popover
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // Gamificación: Meta del Turno
  const metaTurno = 2500.00;

  // Modales
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [currentTicketData, setCurrentTicketData] = useState<TicketData | null>(null);
  const [showConfirmClearCart, setShowConfirmClearCart] = useState(false);

  // CRM y Cupones
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteData, setClienteData] = useState<{ id: string; nombre: string; puntos: number } | null>(null);
  const [codigoCupon, setCodigoCupon] = useState('');
  const [descuentoCupon, setDescuentoCupon] = useState<number>(0);
  const [cuponMensaje, setCuponMensaje] = useState<string | null>(null);

  // Modales de detalle
  const [productoDetalle, setProductoDetalle] = useState<ProductoCatalogo | null>(null);
  const [showTicketsDrawer, setShowTicketsDrawer] = useState(false);
  const [ticketsList, setTicketsList] = useState<VentaTicket[]>([]);
  const [ticketDetalle, setTicketDetalle] = useState<DetalleVentaModalData | null>(null);
  const [anulandoTicket, setAnulandoTicket] = useState(false);
  const [anularMotivo, setAnularMotivo] = useState('Error de captura en caja / Devolución');
  const [ticketAnuladoMsg, setTicketAnuladoMsg] = useState<string | null>(null);

  // Refs para atajos de teclado
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clienteTelefonoRef = useRef<HTMLInputElement>(null);
  const checkoutIdempotencyRef = useRef<string | null>(null);

  // Cargar catálogo de productos real de la API
  const cargarCatalogo = async () => {
    try {
      const res = await api.get('/inventario/productos?activo_only=true');
      const mapeados: ProductoCatalogo[] = (res.data || []).map((p: any) => ({
          producto_id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          precio_venta: Number(p.precio_venta),
          codigo_barras: p.codigo_barras,
          stock_total: p.stock_total || 0,
          categoria_nombre: p.categoria_nombre,
          requiere_pesaje: p.requiere_pesaje,
          imagen: p.imagen || null
        }));
      setProducts(mapeados);
    } catch (error: unknown) {
      setProducts([]);
      setOperationError(getApiError(error, 'No se pudo cargar el catálogo. No se usarán datos simulados.'));
    }
  };

  // Cargar lista de ventas recientes
  const cargarVentas = async () => {
    try {
      const res = await api.get('/pos/ventas?limit=50');
      setTicketsList(res.data);
    } catch (error: unknown) {
      setTicketsList([]);
      setOperationError(getApiError(error, 'No se pudo consultar el historial de ventas.'));
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void cargarCatalogo();
      void cargarVentas();
      recuperarSesionActiva().catch((error: unknown) => {
        setOperationError(getApiError(error, 'No se pudo verificar la sesión activa de caja.'));
      });
    });
  }, [recuperarSesionActiva]);

  // Calcular total acumulado de ventas del turno para gamificación
  const ventasTurnoTotal = useMemo(() => {
    return ticketsList
      .filter((t) => t.estado === 'COMPLETADA')
      .reduce((sum, t) => sum + Number(t.total_pagar || 0), 0);
  }, [ticketsList]);

  const porcentajeMeta = Math.min(100, Math.round((ventasTurnoTotal / metaTurno) * 100));
  const metaCumplida = ventasTurnoTotal >= metaTurno;

  // Extraer categorías únicas disponibles para selector en vivo
  const categoriasDisponibles = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.categoria_nombre) cats.add(p.categoria_nombre);
    });
    return ['TODAS', ...Array.from(cats)];
  }, [products]);

  // Filtrar catálogo por nombre, SKU, código de barras y categoría
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch = !term ||
        p.nombre.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.categoria_nombre && p.categoria_nombre.toLowerCase().includes(term)) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(term));

      const matchesCat = selectedCategory === 'TODAS' ||
        (p.categoria_nombre && p.categoria_nombre.toLowerCase() === selectedCategory.toLowerCase());

      return matchesSearch && matchesCat;
    });
  }, [products, searchTerm, selectedCategory]);

  // Coincidencias para autocompletado en vivo
  const autocompleteMatches = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) return [];
    const term = searchTerm.toLowerCase().trim();
    return products.filter((p) =>
      p.nombre.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      (p.categoria_nombre && p.categoria_nombre.toLowerCase().includes(term)) ||
      (p.codigo_barras && p.codigo_barras.toLowerCase().includes(term))
    ).slice(0, 6);
  }, [products, searchTerm]);

  // Manejo de búsquedas recientes
  const registrarBusquedaReciente = (term: string) => {
    if (!term || term.trim().length === 0) return;
    const limpio = term.trim();
    setBusquedasRecientes((prev) => {
      const filtradas = prev.filter((t) => t.toLowerCase() !== limpio.toLowerCase());
      const actualizadas = [limpio, ...filtradas].slice(0, 5);
      try {
        localStorage.setItem('quantix_busquedas_recientes', JSON.stringify(actualizadas));
      } catch {}
      return actualizadas;
    });
  };

  const handleSelectRecentSearch = (term: string) => {
    setSearchTerm(term);
    setShowAutocomplete(false);
  };

  const handleSelectProductFromAutocomplete = (product: ProductoCatalogo) => {
    addItem(product);
    registrarBusquedaReciente(product.nombre);
    setShowAutocomplete(false);
    setSearchTerm('');
  };


  const verTicketsRecientes = () => {
    cargarVentas();
    setShowTicketsDrawer(true);
  };

  // Abrir TicketModal desde una venta previa o historial
  const abrirTicketModalDesdeVenta = async (tktId: string) => {
    try {
      const res = await api.get(`/pos/ventas/${tktId}`);
      const data: DetalleVentaModalData = res.data;
      setCurrentTicketData({
        id: data.id,
        folio_ticket: data.folio_ticket,
        fecha_hora: data.fecha_hora,
        terminal_id: sesionActiva?.terminal_id || 'TERM-01',
        cajero_nombre: user?.nombre || 'Cajero en Turno',
        cliente_nombre: data.cliente_nombre,
        cliente_telefono: data.cliente_telefono,
        items: data.detalles.map((d) => ({
          nombre: d.producto_nombre,
          sku: d.producto_sku,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario_venta,
          subtotal: d.subtotal,
          lote_codigo: d.lote_codigo
        })),
        subtotal: data.total_bruto,
        descuento: data.total_descuento,
        impuestos: data.total_impuestos,
        total: data.total_pagar,
        metodo_pago: data.pagos.map((p) => p.metodo_pago).join(', ') || 'EFECTIVO',
        monto_recibido: data.total_pagar,
        cambio: 0,
        estado: data.estado
      });
      setShowTicketModal(true);
    } catch (error: unknown) {
      setOperationError(getApiError(error, 'No se pudo recuperar el detalle real del ticket.'));
    }
  };

  const verDetalleTicket = async (ticketId: string) => {
    try {
      const res = await api.get(`/pos/ventas/${ticketId}`);
      setTicketDetalle(res.data);
    } catch (error: unknown) {
      setOperationError(getApiError(error, 'No se pudo recuperar el detalle real de la venta.'));
    }
  };

  const handleAnularTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDetalle) return;
    setAnulandoTicket(true);
    try {
      const res = await api.post(`/pos/ventas/${ticketDetalle.id}/anular`, {
        motivo: anularMotivo
      });
      setTicketDetalle(res.data);
      setTicketAnuladoMsg(`¡Ticket #${res.data.folio_ticket} anulado exitosamente! El stock fue restituido a los lotes.`);
      cargarVentas();
      cargarCatalogo();
    } catch (error: unknown) {
      setTicketAnuladoMsg(getApiError(error, `No se pudo anular el ticket #${ticketDetalle.folio_ticket}.`));
    } finally {
      setAnulandoTicket(false);
      setTimeout(() => {
        setTicketAnuladoMsg(null);
      }, 2500);
    }
  };

  const buscarCliente = async () => {
    if (!clienteTelefono) return;
    try {
      const res = await api.get(`/crm/clientes/buscar/${clienteTelefono}`);
      setClienteData({
        id: res.data.id,
        nombre: res.data.nombre,
        puntos: res.data.puntos_acumulados
      });
    } catch (error: unknown) {
      setClienteData(null);
      setOperationError(getApiError(error, 'Cliente no encontrado.'));
    }
  };

  const aplicarCupon = async () => {
    if (!codigoCupon) return;
    try {
      const res = await api.post('/crm/cupones/validar', { codigo: codigoCupon });
      if (res.data.valido) {
        const desc = res.data.tipo_descuento === 'PORCENTAJE' 
          ? (total * Number(res.data.valor_descuento)) / 100
          : Number(res.data.valor_descuento);
        setDescuentoCupon(desc);
        setCuponMensaje(`Cupón aplicado: -$${desc.toFixed(2)}`);
      } else {
        setCuponMensaje(res.data.mensaje);
      }
    } catch (error: unknown) {
      setDescuentoCupon(0);
      setCuponMensaje(getApiError(error, 'No se pudo validar el cupón.'));
    }
  };

  const totalConDescuento = Math.max(0, total - descuentoCupon);

  const handleCheckout = async () => {
    if (cart.length === 0 || !sesionActiva) return;
    setIsProcessing(true);
    setSaleSuccess(null);
    setOperationError(null);

    const totalPagarFinal = totalConDescuento * 1.16;
    const payload = {
      sesion_caja_id: sesionActiva.id,
      cliente_id: clienteData && clienteData.id !== 'cli-temp' ? clienteData.id : null,
      items: cart.map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad
      })),
      pagos: [
        {
          metodo_pago: paymentMethod,
          monto: totalPagarFinal,
          referencia_pasarela: paymentMethod === 'TARJETA' ? 'SIM-APPROVED' : null
        }
      ],
      codigo_cupon: codigoCupon.trim() || null,
      idempotency_key: checkoutIdempotencyRef.current || (checkoutIdempotencyRef.current = crypto.randomUUID())
    };

    try {
      const res = await api.post('/pos/checkout', payload);
      const folioEmitido = res.data.folio_ticket;
      setSaleSuccess(`Ticket #${folioEmitido} emitido. Lotes descargados por FEFO.`);

      await abrirTicketModalDesdeVenta(res.data.venta_id);

      clearCart();
      setClienteData(null);
      setClienteTelefono('');
      setCodigoCupon('');
      setDescuentoCupon(0);
      setCuponMensaje(null);
      checkoutIdempotencyRef.current = null;
      cargarCatalogo();
      cargarVentas();
    } catch (error: unknown) {
      setOperationError(getApiError(error, 'No se pudo completar la venta. El carrito se conservó intacto.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckoutShortcut = useEffectEvent(handleCheckout);

  // Atajos de teclado globales: F1 (buscador), F2 (CRM teléfono), F3 (cobro), Esc (limpiar carrito)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F2') {
        e.preventDefault();
        clienteTelefonoRef.current?.focus();
        clienteTelefonoRef.current?.select();
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (cart.length > 0 && estaAbierta && !isProcessing) {
          void handleCheckoutShortcut();
        }
      } else if (e.key === 'Escape') {
        if (showTicketModal) {
          setShowTicketModal(false);
        } else if (showConfirmClearCart) {
          setShowConfirmClearCart(false);
        } else if (productoDetalle) {
          setProductoDetalle(null);
        } else if (ticketDetalle) {
          setTicketDetalle(null);
        } else if (showTicketsDrawer) {
          setShowTicketsDrawer(false);
        } else if (showArqueoModal) {
          setShowArqueoModal(false);
        } else if (showAutocomplete) {
          setShowAutocomplete(false);
        } else if (cart.length > 0) {
          setShowConfirmClearCart(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart, estaAbierta, isProcessing, showTicketModal, 
    showConfirmClearCart, productoDetalle, ticketDetalle, 
    showTicketsDrawer, showArqueoModal, showAutocomplete
  ]);

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden relative font-sans">
      {!estaAbierta && <AperturaCajaModal />}

      <ArqueoCiegoModal 
        isOpen={showArqueoModal} 
        onClose={() => setShowArqueoModal(false)} 
      />

      {/* Ticket Modal Térmico Profesional 80mm */}
      <TicketModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        ticket={currentTicketData}
      />

      {/* Modal de Confirmación de Limpieza de Carrito (Esc) */}
      {showConfirmClearCart && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Vaciar Carrito</h3>
              </div>
              <button 
                onClick={() => setShowConfirmClearCart(false)} 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              ¿Estás seguro de que deseas limpiar la venta actual con <strong>{cart.length} productos</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirmClearCart(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  clearCart();
                  setShowConfirmClearCart(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                Confirmar y Vaciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel Izquierdo: Buscador, Catálogo y Terminal Ágil */}
      <div className="flex-1 flex flex-col p-5 overflow-hidden">
        {/* Barra de Estado de Sesión de Caja & Gamificación Meta del Turno */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-200 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Terminal: <strong className="text-gray-900">{sesionActiva?.terminal_id || 'TERM-01'}</strong>
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-500 hidden sm:inline">
              Fondo inicial: <strong>${Number(sesionActiva?.fondo_inicial || 0).toFixed(2)}</strong>
            </span>
          </div>

          {/* Gamificación: Meta del Turno */}
          <div className="flex items-center">
            {metaCumplida ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/10 via-emerald-500/15 to-amber-500/10 border border-amber-300 rounded-xl animate-in fade-in">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0 animate-bounce" />
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    ¡Meta Cumplida! ({porcentajeMeta}%)
                  </span>
                  <span className="text-xs font-black text-emerald-700">
                    ${ventasTurnoTotal.toFixed(2)} / ${metaTurno.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl min-w-[210px]">
                <Target className="w-4 h-4 text-quantix-600 shrink-0" />
                <div className="flex-1 text-left">
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 mb-1 leading-none">
                    <span>Meta del Turno</span>
                    <span className="font-mono text-quantix-700 font-black">{porcentajeMeta}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-quantix-500 to-emerald-500 transition-all duration-500 rounded-full"
                      style={{ width: `${porcentajeMeta}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Acciones de la barra superior */}
          <div className="flex items-center gap-2">
            {/* Toggle Modo Venta Flash */}
            <button
              onClick={() => setModoVentaFlash(!modoVentaFlash)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl transition-all border shadow-sm ${
                modoVentaFlash
                  ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${modoVentaFlash ? 'fill-white' : 'fill-amber-500 text-amber-500'}`} />
              <span>{modoVentaFlash ? 'Venta Flash ON' : 'Modo Venta Flash'}</span>
            </button>

            <button
              onClick={verTicketsRecientes}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors border border-gray-200"
            >
              <Receipt className="w-3.5 h-3.5 text-quantix-600" />
              <span className="hidden md:inline">Tickets</span>
            </button>

            <button
              onClick={() => setShowArqueoModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Arqueo Ciego</span>
            </button>
          </div>
        </div>

        {/* Atajos Rápidos Informativos */}
        <div className="flex items-center justify-between mb-3 text-[11px] text-gray-500 bg-white/70 px-3 py-1.5 rounded-xl border border-gray-200/60">
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-700 flex items-center gap-1">
              Atajos de Teclado:
            </span>
            <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono font-bold text-gray-800 border border-gray-200">F1: Buscar</span>
            <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono font-bold text-gray-800 border border-gray-200">F2: CRM</span>
            <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono font-bold text-gray-800 border border-gray-200">F3: Cobrar</span>
            <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono font-bold text-gray-800 border border-gray-200">Esc: Limpiar</span>
          </div>
          {saleSuccess && (
            <div className="text-emerald-700 font-bold flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{saleSuccess}</span>
            </div>
          )}
          {operationError && (
            <div className="text-red-700 font-bold flex items-center gap-1 animate-in fade-in" role="alert">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <span>{operationError}</span>
            </div>
          )}
        </div>

        {/* MODO VENTA FLASH (Si está activo) */}
        {modoVentaFlash ? (
          <VentaFlashGrid
            products={products}
            onSelectProduct={(p, qty) => {
              const count = qty || 1;
              for (let i = 0; i < count; i++) {
                addItem(p);
              }
              registrarBusquedaReciente(p.nombre);
            }}
            onClose={() => setModoVentaFlash(false)}
          />
        ) : (
          /* MODO CATÁLOGO ESTÁNDAR CON AUTOCOMPLETADO Y BÚSQUEDAS RECIENTES */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Buscador en Vivo & Autocompletado */}
            <div className="mb-3 relative">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="block w-full pl-11 pr-10 py-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm text-base focus:ring-2 focus:ring-quantix-500 outline-none transition-shadow font-medium"
                  placeholder="Buscar producto por nombre, SKU, código de barras o categoría... [F1]"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowAutocomplete(true);
                  }}
                  onFocus={() => setShowAutocomplete(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && autocompleteMatches.length > 0) {
                      handleSelectProductFromAutocomplete(autocompleteMatches[0]);
                    }
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setShowAutocomplete(false);
                    }}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Popover de Autocompletado en Vivo */}
              {showAutocomplete && autocompleteMatches.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-gray-200 z-30 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <span>Sugerencias en vivo ({autocompleteMatches.length})</span>
                    <span>Presiona Enter para agregar el primero</span>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {autocompleteMatches.map((match) => (
                      <div
                        key={match.sku}
                        onClick={() => handleSelectProductFromAutocomplete(match)}
                        className="p-3 hover:bg-quantix-50/70 flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold group-hover:bg-quantix-100 group-hover:text-quantix-700">
                            {match.categoria_nombre ? match.categoria_nombre[0] : 'P'}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-900 group-hover:text-quantix-800 block">
                              {match.nombre}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              <span className="font-mono">{match.sku}</span>
                              {match.categoria_nombre && (
                                <span className="bg-gray-100 px-1.5 py-0.2 rounded font-medium">
                                  {match.categoria_nombre}
                                </span>
                              )}
                              <span className="text-emerald-700 font-bold">
                                {match.stock_total || 0} disp.
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-quantix-600">
                            ${match.precio_venta.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            className="p-1.5 bg-quantix-100 group-hover:bg-quantix-600 text-quantix-700 group-hover:text-white rounded-lg transition-colors"
                            title="Agregar al carrito"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chips de Búsquedas Recientes */}
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
              <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400 shrink-0">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>Recientes:</span>
              </div>
              {busquedasRecientes.map((term, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectRecentSearch(term)}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-quantix-50 text-gray-700 hover:text-quantix-700 rounded-xl border border-gray-200 transition-colors shrink-0 shadow-2xs font-medium"
                >
                  {term}
                </button>
              ))}
            </div>

            {/* Selector de Categorías en Pestañas */}
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none">
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
              {categoriasDisponibles.map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-xs font-bold rounded-xl whitespace-nowrap transition-all border ${
                      isSelected
                        ? 'bg-quantix-600 text-white border-quantix-500 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Grid de Productos */}
            <div className="flex-1 overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                  <ShoppingCart className="w-12 h-12 opacity-30 mb-2" />
                  <p className="text-sm font-semibold text-gray-600">No se encontraron productos coincidentes</p>
                  <p className="text-xs text-gray-400 mt-1">Prueba con otra búsqueda o selecciona otra categoría</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3.5">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.sku}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:border-quantix-300 hover:shadow-md transition-all flex flex-col items-start text-left relative group cursor-pointer"
                      onClick={() => {
                        addItem(product);
                        registrarBusquedaReciente(product.nombre);
                      }}
                    >
                      {/* Botón de ver detalle del producto */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProductoDetalle(product);
                        }}
                        className="absolute top-3 right-3 p-1 text-gray-300 hover:text-quantix-600 hover:bg-quantix-50 rounded-lg transition-colors"
                        title="Ver ficha técnica"
                      >
                        <Info className="w-4 h-4" />
                      </button>

                      {product.imagen ? (
                        <div className="w-full h-24 mb-3 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
                          <img 
                            src={product.imagen} 
                            alt={product.nombre} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                          />
                        </div>
                      ) : (
                        <div className="w-full h-20 bg-gray-50 group-hover:bg-quantix-50/50 rounded-xl mb-3 flex items-center justify-center text-gray-400 transition-colors">
                          <ShoppingCart className="w-7 h-7" />
                        </div>
                      )}
                      
                      <div className="w-full flex items-center justify-between text-xs text-gray-400 font-mono font-semibold">
                        <span>{product.sku}</span>
                        {product.stock_total !== undefined && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                            {product.stock_total} disp.
                          </span>
                        )}
                      </div>

                      <span className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight mt-1">
                        {product.nombre}
                      </span>

                      {product.categoria_nombre && (
                        <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                          {product.categoria_nombre}
                        </span>
                      )}

                      <span className="mt-2 text-lg font-black text-quantix-600">
                        ${product.precio_venta.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Panel Derecho: Ticket / Carrito de Venta */}
      <div className="w-[430px] bg-white border-l border-gray-200 shadow-xl flex flex-col z-10">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-quantix-600" />
              Ticket de Venta
            </h2>
            {cart.length > 0 && (
              <button
                onClick={() => setShowConfirmClearCart(true)}
                className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Limpiar carrito (Esc)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            FEFO Activo
          </span>
        </div>

        {/* CRM y Fidelización */}
        <div className="p-3 bg-gray-50 border-b border-gray-100 space-y-2">
          <div className="flex gap-2">
            <input
              ref={clienteTelefonoRef}
              type="text"
              placeholder="Teléfono del cliente (CRM)... [F2]"
              value={clienteTelefono}
              onChange={(e) => setClienteTelefono(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') buscarCliente();
              }}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-quantix-500"
            />
            <button
              onClick={buscarCliente}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Asociar
            </button>
          </div>

          {clienteData && (
            <div className="text-xs bg-emerald-100/60 text-emerald-800 px-2.5 py-1.5 rounded-lg flex justify-between items-center font-medium">
              <span>{clienteData.nombre}</span>
              <span className="font-bold">{clienteData.puntos} pts acumulados</span>
            </div>
          )}

          {/* Cupones */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Código de cupón..."
              value={codigoCupon}
              onChange={(e) => setCodigoCupon(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-quantix-500 uppercase font-mono"
            />
            <button
              onClick={aplicarCupon}
              className="px-3 py-1.5 bg-quantix-100 hover:bg-quantix-200 text-quantix-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              <Tag className="w-3.5 h-3.5" />
              Canjear
            </button>
          </div>

          {cuponMensaje && (
            <div className="text-xs text-quantix-700 font-medium px-1">
              {cuponMensaje}
            </div>
          )}
        </div>

        {/* Lista de Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p className="text-sm">Agrega artículos escaneando o seleccionando</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.sku} className="bg-gray-50 p-3 rounded-xl flex flex-col gap-1.5 border border-gray-100 text-sm">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-gray-800 leading-tight">{item.nombre}</span>
                  <span className="font-bold text-gray-900 ml-2">
                    ${(item.precio_venta * item.cantidad).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-0.5">
                    <button onClick={() => updateQuantity(item.sku, item.cantidad - 1)} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-5 text-center font-bold text-xs">{item.cantidad}</span>
                    <button onClick={() => updateQuantity(item.sku, item.cantidad + 1)} className="p-1 hover:bg-quantix-100 rounded text-quantix-600">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button onClick={() => removeItem(item.sku)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totales y Cobro */}
        <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="space-y-1.5 mb-4 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            {descuentoCupon > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Descuento cupón:</span>
                <span>-${descuentoCupon.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>IVA (16%):</span>
              <span>${(totalConDescuento * 0.16).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-black text-gray-900 pt-2 border-t border-dashed border-gray-300">
              <span>Total a Cobrar:</span>
              <span className="text-quantix-600">${(totalConDescuento * 1.16).toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button 
              onClick={() => setPaymentMethod('EFECTIVO')}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 border-2 transition-colors text-xs font-bold ${
                paymentMethod === 'EFECTIVO' ? 'border-quantix-500 bg-quantix-50 text-quantix-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Banknote className="w-4 h-4" />
              Efectivo
            </button>
            <button 
              onClick={() => setPaymentMethod('TARJETA')}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 border-2 transition-colors text-xs font-bold ${
                paymentMethod === 'TARJETA' ? 'border-quantix-500 bg-quantix-50 text-quantix-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Tarjeta
            </button>
          </div>

          <button 
            disabled={cart.length === 0 || isProcessing || !estaAbierta}
            onClick={handleCheckout}
            className="w-full py-3.5 bg-quantix-600 hover:bg-quantix-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-extrabold rounded-xl shadow-lg transition-all text-base flex items-center justify-center gap-2 active:scale-95"
            title="Cobrar venta [F3]"
          >
            {isProcessing ? 'Descargando FEFO...' : `Cobrar $${(totalConDescuento * 1.16).toFixed(2)} [F3]`}
          </button>
        </div>
      </div>

      {/* ================= MODAL DETALLE PRODUCTO ================= */}
      {productoDetalle && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-quantix-50 text-quantix-600 rounded-xl">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{productoDetalle.nombre}</h3>
                  <span className="text-xs font-mono text-gray-400">{productoDetalle.sku}</span>
                </div>
              </div>
              <button 
                onClick={() => setProductoDetalle(null)} 
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {productoDetalle.imagen && (
              <div className="w-full flex justify-center bg-gray-50 p-2 rounded-xl border border-gray-100 my-3">
                <img 
                  src={productoDetalle.imagen} 
                  alt={productoDetalle.nombre} 
                  className="max-h-44 object-contain rounded-lg"
                />
              </div>
            )}

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-400">Precio de Venta:</span>
                  <p className="text-lg font-black text-quantix-600 mt-0.5">
                    ${productoDetalle.precio_venta.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Stock Total Disponible:</span>
                  <p className="text-lg font-black text-gray-900 mt-0.5">
                    {productoDetalle.stock_total || 0} uds
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Código de Barras (EAN):</span>
                  <p className="font-mono text-gray-700 mt-0.5">{productoDetalle.codigo_barras || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Categoría:</span>
                  <p className="font-bold text-gray-700 mt-0.5">{productoDetalle.categoria_nombre || 'General'}</p>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-900 leading-relaxed">
                <span className="font-bold block mb-0.5">Mecanismo FEFO:</span>
                Al agregarlo al ticket, el sistema descargará automáticamente las unidades del lote más próximo a caducar.
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
              <button
                onClick={() => {
                  addItem(productoDetalle);
                  setProductoDetalle(null);
                }}
                className="px-4 py-2 bg-quantix-600 hover:bg-quantix-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar al Carrito
              </button>
              <button
                onClick={() => setProductoDetalle(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DRAWER HISTORIAL DE TICKETS ================= */}
      {showTicketsDrawer && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 border border-gray-100 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gray-900 text-amber-400 rounded-xl">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Historial de Tickets Emitidos</h3>
                  <p className="text-xs text-gray-400">Ver ticket térmico 80mm, desglose o realizar anulación / baja lógica</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTicketsDrawer(false)} 
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-3">Folio Ticket</th>
                    <th className="py-3 px-3">Fecha y Hora</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3 text-center">Ítems</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                    <th className="py-3 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {ticketsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">No hay tickets registrados recientemente</td>
                    </tr>
                  ) : (
                    ticketsList.map((t) => (
                      <tr 
                        key={t.id} 
                        className="hover:bg-quantix-50/40 cursor-pointer transition-colors group"
                      >
                        <td 
                          onClick={() => verDetalleTicket(t.id)}
                          className="py-3 px-3 font-mono font-bold text-gray-900 group-hover:text-quantix-600"
                        >
                          {t.folio_ticket}
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 text-gray-500">
                          {new Date(t.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(t.fecha_hora).toLocaleDateString()})
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 font-medium text-gray-700">
                          {t.cliente_nombre || 'Público General'}
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 text-center font-bold text-gray-600">
                          {t.items_count}
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 text-right font-black text-gray-900">
                          ${Number(t.total_pagar).toFixed(2)}
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            t.estado === 'COMPLETADA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {t.estado}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={(e) => { e.stopPropagation(); abrirTicketModalDesdeVenta(t.id); }}
                              className="p-1.5 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors border border-emerald-200"
                              title="Ver / Imprimir Ticket Térmico 80mm"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); verDetalleTicket(t.id); }}
                              className="p-1.5 hover:bg-quantix-100 text-quantix-600 rounded-lg transition-colors border border-gray-200"
                              title="Ver desglose completo de lotes"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowTicketsDrawer(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DETALLE DE TICKET & ANULACIÓN ================= */}
      {ticketDetalle && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-quantix-50 text-quantix-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Ticket #{ticketDetalle.folio_ticket}</h3>
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date(ticketDetalle.fecha_hora).toLocaleString()}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setTicketDetalle(null)} 
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {ticketAnuladoMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-bold text-center my-3">
                {ticketAnuladoMsg}
              </div>
            )}

            <div className="py-3 space-y-3 text-xs">
              <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl">
                <div>
                  <span className="text-gray-400 block">Cliente Asociado:</span>
                  <span className="font-bold text-gray-800">
                    {ticketDetalle.cliente_nombre || 'Venta al Mostrador (Sin CRM)'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">Estado del Ticket:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                    ticketDetalle.estado === 'COMPLETADA'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {ticketDetalle.estado}
                  </span>
                </div>
              </div>

              {/* Detalle de Productos y Lotes FEFO */}
              <div>
                <span className="font-bold text-gray-700 block mb-1.5 uppercase text-[10px] tracking-wider">
                  Líneas de Venta & Lotes FEFO Descargados
                </span>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                  {ticketDetalle.detalles.map((d) => (
                    <div key={d.id} className="p-2.5 flex justify-between items-center bg-white text-xs">
                      <div>
                        <span className="font-bold text-gray-900 block">{d.producto_nombre}</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          Lote FEFO: <strong>{d.lote_codigo || 'Auto'}</strong> • Cantidad: {d.cantidad}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gray-900">${Number(d.subtotal).toFixed(2)}</span>
                        <span className="block text-[10px] text-emerald-600">
                          Margen: ${Number(d.margen_ganancia).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagos */}
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Método de Pago:</span>
                  <span className="font-bold text-gray-800">
                    {ticketDetalle.pagos.map((p) => p.metodo_pago).join(', ') || 'EFECTIVO'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 mt-1 border-t border-dashed border-gray-200 text-sm font-black">
                  <span>Total Cobrado:</span>
                  <span className="text-quantix-600">${Number(ticketDetalle.total_pagar).toFixed(2)}</span>
                </div>
              </div>

              {/* Formulario de Anulación (Baja Lógica) */}
              {ticketDetalle.estado === 'COMPLETADA' && (
                <form onSubmit={handleAnularTicket} className="p-3 bg-red-50/60 rounded-xl border border-red-100 space-y-2">
                  <div className="flex items-center gap-1.5 text-red-800 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Baja Lógica de Venta (Anulación de Ticket)</span>
                  </div>
                  <p className="text-[11px] text-red-700 leading-relaxed">
                    Al anular este ticket, el estado cambiará a <strong>ANULADA</strong> y las unidades descargadas se restituirán automáticamente a sus lotes FEFO originales.
                  </p>

                  <input
                    type="text"
                    required
                    value={anularMotivo}
                    onChange={(e) => setAnularMotivo(e.target.value)}
                    placeholder="Motivo de la cancelación..."
                    className="w-full px-2.5 py-1.5 border border-red-200 rounded-lg text-xs bg-white outline-none focus:ring-1 focus:ring-red-500"
                  />

                  <button
                    type="submit"
                    disabled={anulandoTicket}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    {anulandoTicket ? 'Revirtiendo stock...' : 'Confirmar Anulación de Ticket'}
                  </button>
                </form>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
              <button
                type="button"
                onClick={() => abrirTicketModalDesdeVenta(ticketDetalle.id)}
                className="px-3.5 py-2 bg-quantix-600 hover:bg-quantix-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Ver Ticket 80mm</span>
              </button>

              <button
                onClick={() => setTicketDetalle(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
