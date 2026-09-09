import React, { useState, useEffect, useEffectEvent, useRef, useMemo, useCallback } from 'react';
import { usePOSStore } from '../store/posStore';
import { useCajaStore } from '../store/cajaStore';
import { useAuthStore } from '../store/authStore';
import { useConnectivityStore } from '../store/connectivityStore';
import { useSucursalStore } from '../store/sucursalStore';
import { buscarProductosLocales } from '../services/offline/snapshotService';
import { guardarVentaOffline } from '../services/offline/queueService';
import { 
  Search, Trash2, Plus, Minus, CreditCard, Banknote, ShoppingCart, 
  UserCheck, UserPlus, Tag, LogOut, ShieldCheck, CheckCircle2, Receipt,
  Eye, X, Ban, AlertTriangle, Info, Zap, Clock, Trophy, Target,
  Printer, Filter, QrCode, Sparkles, ArrowUpDown, FileSpreadsheet
} from 'lucide-react';
import AperturaCajaModal from '../components/AperturaCajaModal';
import ArqueoCiegoModal from '../components/ArqueoCiegoModal';
import TicketModal, { type TicketData } from '../components/TicketModal';
import MovimientoCajaModal from '../components/MovimientoCajaModal';
import CorteXModal from '../components/CorteXModal';
import VentaFlashGrid, { type ProductoCatalogo } from '../components/VentaFlashGrid';
import SimuladorPagoModal from '../components/SimuladorPagoModal';
import api from '../services/api';
import { mostrarToast } from '../hooks/useWebSocket';

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
  cliente_cedula?: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_email?: string | null;
  total_bruto: number | string;
  total_descuento: number | string;
  total_impuestos: number | string;
  total_pagar: number | string;
  estado: string;
  detalles: Array<{
    id: string;
    producto_nombre: string;
    producto_sku: string;
    lote_codigo: string | null;
    cantidad: number | string;
    costo_unitario_lote: number | string;
    precio_unitario_venta: number | string;
    subtotal: number | string;
    margen_ganancia: number | string;
  }>;
  pagos: Array<{
    id: string;
    metodo_pago: string;
    monto: number | string;
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
  const { sucursalActual } = useSucursalStore();
  const {
    status: connectivityStatus,
    refreshPendingCount,
    refrescarSnapshot
  } = useConnectivityStore();

  const [products, setProducts] = useState<ProductoCatalogo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TARJETA' | 'QR'>('EFECTIVO');
  const [montoEfectivoRecibido, setMontoEfectivoRecibido] = useState<string>('');
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
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showCorteXModal, setShowCorteXModal] = useState(false);

  // CRM y Cupones
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteData, setClienteData] = useState<{ id: string; cedula?: string | null; nombre: string; telefono?: string | null; puntos: number; email?: string | null } | null>(null);
  const [showRegistroRapidoModal, setShowRegistroRapidoModal] = useState(false);
  const [registroCedula, setRegistroCedula] = useState('');
  const [registroNombre, setRegistroNombre] = useState('');
  const [registroCelular, setRegistroCelular] = useState('');
  const [registroCorreo, setRegistroCorreo] = useState('');
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [canjearPuntos, setCanjearPuntos] = useState(false);
  const [puntosACanjear, setPuntosACanjear] = useState<number>(0);
  const [codigoCupon, setCodigoCupon] = useState('');
  const [descuentoCupon, setDescuentoCupon] = useState<number>(0);
  const [cuponMensaje, setCuponMensaje] = useState<string | null>(null);
  const [simulandoPago, setSimulandoPago] = useState<'TARJETA' | 'QR' | null>(null);

  // Modales de detalle
  const [productoDetalle, setProductoDetalle] = useState<ProductoCatalogo | null>(null);
  const [showTicketsDrawer, setShowTicketsDrawer] = useState(false);
  const [ticketsList, setTicketsList] = useState<VentaTicket[]>([]);
  const [ticketDetalle, setTicketDetalle] = useState<DetalleVentaModalData | null>(null);
  const [anulandoTicket, setAnulandoTicket] = useState(false);
  const [anularMotivo, setAnularMotivo] = useState('Error de captura en caja / Devolución');
  const [ticketAnuladoMsg, setTicketAnuladoMsg] = useState<string | null>(null);

  // Refs para atajos de teclado y scanner HID
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clienteTelefonoRef = useRef<HTMLInputElement>(null);
  const checkoutIdempotencyRef = useRef<string | null>(null);
  const scannerBufferRef = useRef<{ buffer: string; lastTime: number }>({ buffer: '', lastTime: 0 });

  // Cargar catálogo de productos real de la API o IndexedDB
  const cargarCatalogo = useCallback(async () => {
    if (connectivityStatus === 'OFFLINE_LISTO') {
      try {
        const locales = await buscarProductosLocales('');
        const mapeados: ProductoCatalogo[] = locales.map((p) => ({
          producto_id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          precio_venta: Number(p.precio_venta),
          codigo_barras: p.codigo_barras || undefined,
          stock_total: p.stock_total || 0,
          categoria_nombre: p.categoria_nombre || undefined,
          requiere_pesaje: Boolean(p.requiere_pesaje),
          imagen: p.imagen || null
        }));
        setProducts(mapeados);
      } catch (err: unknown) {
        setProducts([]);
        setOperationError(getApiError(err, 'No se pudo cargar el catálogo local offline.'));
      }
      return;
    }

    if (connectivityStatus === 'OFFLINE_NO_DISPONIBLE') {
      setProducts([]);
      return;
    }

    try {
      const res = await api.get('/inventario/productos', {
        params: {
          activo_only: true,
          sucursal_id: sucursalActual?.id
        }
      });
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
      void refrescarSnapshot();
    } catch (error: unknown) {
      // Fallback a catálogo local offline si la API no responde
      try {
        const locales = await buscarProductosLocales('');
        if (locales.length > 0) {
          const mapeados: ProductoCatalogo[] = locales.map((p) => ({
            producto_id: p.id,
            sku: p.sku,
            nombre: p.nombre,
            precio_venta: Number(p.precio_venta),
            codigo_barras: p.codigo_barras || undefined,
            stock_total: p.stock_total || 0,
            categoria_nombre: p.categoria_nombre || undefined,
            requiere_pesaje: Boolean(p.requiere_pesaje),
            imagen: p.imagen || null
          }));
          setProducts(mapeados);
          return;
        }
      } catch {}
      setProducts([]);
      setOperationError(getApiError(error, 'No se pudo cargar el catálogo. No se usarán datos simulados.'));
    }
  }, [connectivityStatus, refrescarSnapshot, sucursalActual?.id]);

  // Cargar lista de ventas recientes
  const cargarVentas = useCallback(async () => {
    try {
      const res = await api.get('/pos/ventas', {
        params: {
          limit: 50,
          sucursal_id: sucursalActual?.id
        }
      });
      setTicketsList(res.data);
    } catch (error: unknown) {
      setTicketsList([]);
      setOperationError(getApiError(error, 'No se pudo consultar el historial de ventas.'));
    }
  }, [sucursalActual?.id]);

  useEffect(() => {
    queueMicrotask(() => {
      void cargarCatalogo();
      if (connectivityStatus === 'ONLINE') {
        void cargarVentas();
      }
      recuperarSesionActiva().catch((error: unknown) => {
        setOperationError(getApiError(error, 'No se pudo verificar la sesión activa de caja.'));
      });
    });
  }, [recuperarSesionActiva, connectivityStatus, cargarCatalogo, cargarVentas, sucursalActual?.id]);

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
  const abrirTicketModalDesdeVenta = async (
    tktId: string,
    metodoPagoOverride?: string,
    montoRecibidoOverride?: number,
    cambioOverride?: number
  ) => {
    try {
      const res = await api.get(`/pos/ventas/${tktId}`);
      const data: DetalleVentaModalData = res.data;
      const metodoFinal = metodoPagoOverride || (data.pagos || []).map((p) => p.metodo_pago).join(', ') || 'EFECTIVO';
      const montoTotal = Number(data.total_pagar || 0);
      const montoRecibidoFinal = metodoFinal === 'EFECTIVO' && montoRecibidoOverride && montoRecibidoOverride >= montoTotal
        ? montoRecibidoOverride
        : montoTotal;
      const cambioFinal = metodoFinal === 'EFECTIVO' && cambioOverride !== undefined
        ? cambioOverride
        : 0;

      setCurrentTicketData({
        id: data.id,
        folio_ticket: data.folio_ticket,
        fecha_hora: data.fecha_hora,
        terminal_id: sesionActiva?.terminal_id || 'TERM-01',
        cajero_nombre: user?.nombre || 'Cajero en Turno',
        cliente_nombre: (!data.cliente_nombre || data.cliente_nombre === 'CONSUMIDOR FINAL') ? 'CONSUMIDOR FINAL' : data.cliente_nombre,
        cliente_cedula: (!data.cliente_nombre || data.cliente_nombre === 'CONSUMIDOR FINAL') ? '9999999999999' : (data.cliente_cedula || null),
        cliente_telefono: (!data.cliente_nombre || data.cliente_nombre === 'CONSUMIDOR FINAL') ? null : (data.cliente_telefono || null),
        cliente_email: data.cliente_email || clienteData?.email || null,
        items: (data.detalles || []).map((d) => ({
          nombre: d.producto_nombre || 'Artículo',
          sku: d.producto_sku || '',
          cantidad: Number(d.cantidad || 0),
          precio_unitario: Number(d.precio_unitario_venta || 0),
          subtotal: Number(d.subtotal || 0),
          lote_codigo: d.lote_codigo || null
        })),
        subtotal: Number(data.total_bruto || 0),
        descuento: Number(data.total_descuento || 0),
        impuestos: Number(data.total_impuestos || 0),
        total: montoTotal,
        metodo_pago: metodoFinal === 'QR' ? 'QR (DEUNA PICHINCHA)' : metodoFinal,
        monto_recibido: montoRecibidoFinal,
        cambio: cambioFinal,
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
      const exitoMsg = `¡Ticket #${res.data.folio_ticket} anulado exitosamente! El stock fue restituido a los lotes.`;
      setTicketAnuladoMsg(exitoMsg);
      mostrarToast({
        titulo: 'Ticket Anulado',
        mensaje: exitoMsg,
        severidad: 'WARNING',
      });
      cargarVentas();
      cargarCatalogo();
    } catch (error: unknown) {
      const errTxt = getApiError(error, `No se pudo anular el ticket #${ticketDetalle.folio_ticket}.`);
      setTicketAnuladoMsg(errTxt);
      mostrarToast({
        titulo: 'Error al Anular Ticket',
        mensaje: errTxt,
        severidad: 'CRITICO',
      });
    } finally {
      setAnulandoTicket(false);
      setTimeout(() => {
        setTicketAnuladoMsg(null);
      }, 2500);
    }
  };

  const buscarCliente = async () => {
    const termino = clienteTelefono.trim();
    if (!termino) return;
    if (connectivityStatus !== 'ONLINE') {
      setOperationError('La búsqueda y fidelización CRM requieren conexión al servidor central.');
      return;
    }
    try {
      const res = await api.get(`/crm/clientes/buscar/${encodeURIComponent(termino)}`);
      setClienteData({
        id: res.data.id,
        cedula: res.data.cedula || null,
        nombre: res.data.nombre,
        telefono: res.data.telefono || null,
        puntos: res.data.puntos_acumulados,
        email: res.data.email || null
      });
      setCanjearPuntos(false);
      setPuntosACanjear(0);
      setOperationError(null);
      mostrarToast({
        titulo: 'Cliente Identificado',
        mensaje: `${res.data.nombre} vinculado al ticket.`,
        severidad: 'SUCCESS',
      });
    } catch (error: unknown) {
      setClienteData(null);
      setOperationError(getApiError(error, 'Cliente no encontrado.'));
      // Si no existe, sugerir y abrir modal de registro rápido prellenando la cédula
      setRegistroCedula(termino);
      setRegistroNombre('');
      setRegistroCelular('');
      setRegistroCorreo('');
      setShowRegistroRapidoModal(true);
      mostrarToast({
        titulo: 'Cliente no registrado',
        mensaje: `No se encontró cliente con cédula/celular "${termino}". Complete el registro rápido.`,
        severidad: 'INFO',
      });
    }
  };

  const handleRegistroRapidoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registroCedula.trim() || !registroNombre.trim() || !registroCelular.trim()) {
      mostrarToast({
        titulo: 'Campos requeridos',
        mensaje: 'Cédula, nombre y celular son obligatorios para el registro rápido.',
        severidad: 'WARNING',
      });
      return;
    }

    if (connectivityStatus !== 'ONLINE') {
      mostrarToast({
        titulo: 'Modo Offline',
        mensaje: 'El registro de clientes requiere conexión al servidor central.',
        severidad: 'WARNING',
      });
      return;
    }

    setGuardandoCliente(true);
    try {
      const res = await api.post('/crm/clientes', {
        cedula: registroCedula.trim(),
        nombre: registroNombre.trim(),
        telefono: registroCelular.trim(),
        email: registroCorreo.trim() || null
      });

      const nuevo = res.data;
      setClienteData({
        id: nuevo.id,
        cedula: nuevo.cedula || registroCedula.trim(),
        nombre: nuevo.nombre,
        telefono: nuevo.telefono || registroCelular.trim(),
        puntos: nuevo.puntos_acumulados || 0,
        email: nuevo.email || null
      });
      setClienteTelefono(nuevo.cedula || nuevo.telefono || '');
      setShowRegistroRapidoModal(false);
      setOperationError(null);
      mostrarToast({
        titulo: 'Cliente Registrado',
        mensaje: `Cliente "${nuevo.nombre}" creado y vinculado a la venta.`,
        severidad: 'SUCCESS',
      });
    } catch (error: unknown) {
      const errTxt = getApiError(error, 'Error al registrar cliente.');
      setOperationError(errTxt);
      mostrarToast({
        titulo: 'Error en Registro',
        mensaje: errTxt,
        severidad: 'CRITICO',
      });
    } finally {
      setGuardandoCliente(false);
    }
  };

  const aplicarCupon = async () => {
    if (!codigoCupon) return;
    if (connectivityStatus !== 'ONLINE') {
      setDescuentoCupon(0);
      setCuponMensaje('Los cupones de descuento no están disponibles en modo offline.');
      return;
    }
    try {
      const res = await api.post('/crm/cupones/validar', { codigo: codigoCupon });
      if (res.data.valido) {
        const desc = res.data.tipo_descuento === 'PORCENTAJE' 
          ? (total * Number(res.data.valor_descuento)) / 100
          : Number(res.data.valor_descuento);
        setDescuentoCupon(desc);
        setCuponMensaje(`Cupón aplicado: -$${desc.toFixed(2)}`);
        mostrarToast({
          titulo: 'Cupón Aplicado',
          mensaje: `Descuento de $${desc.toFixed(2)} aplicado al ticket.`,
          severidad: 'SUCCESS',
        });
      } else {
        setCuponMensaje(res.data.mensaje);
        mostrarToast({
          titulo: 'Cupón No Válido',
          mensaje: res.data.mensaje || 'El cupón no cumple las condiciones de venta.',
          severidad: 'WARNING',
        });
      }
    } catch (error: unknown) {
      setDescuentoCupon(0);
      const errTxt = getApiError(error, 'No se pudo validar el cupón.');
      setCuponMensaje(errTxt);
      mostrarToast({
        titulo: 'Error al Validar Cupón',
        mensaje: errTxt,
        severidad: 'CRITICO',
      });
    }
  };

  const effectivePaymentMethod = connectivityStatus !== 'ONLINE' ? 'EFECTIVO' : paymentMethod;
  const effectiveDescuentoCupon = connectivityStatus !== 'ONLINE' ? 0 : descuentoCupon;
  const maxPuntosPosibles = clienteData ? Math.min(clienteData.puntos, Math.floor(Math.max(0, total - effectiveDescuentoCupon) * 10)) : 0;
  const effectiveDescuentoPuntos = connectivityStatus === 'ONLINE' && canjearPuntos && puntosACanjear > 0
    ? Math.min(Number((puntosACanjear / 10).toFixed(2)), Math.max(0, total - effectiveDescuentoCupon))
    : 0;
  const totalConDescuento = Math.max(0, total - effectiveDescuentoCupon - effectiveDescuentoPuntos);
  const totalConImpuestos = Math.round(totalConDescuento * 1.16 * 100) / 100;

  // Cálculo dinámico de cambio en efectivo
  const valorEfectivoNumerico = parseFloat(montoEfectivoRecibido) || 0;
  const cambioCalculado = valorEfectivoNumerico >= totalConImpuestos ? valorEfectivoNumerico - totalConImpuestos : 0;

  const handleSeleccionarMetodoPago = (metodo: 'EFECTIVO' | 'TARJETA' | 'QR') => {
    setPaymentMethod(metodo);
    if (metodo === 'EFECTIVO') {
      setSimulandoPago(null);
    } else {
      if (cart.length === 0) {
        mostrarToast({
          titulo: 'Ticket sin artículos',
          mensaje: `Agregue productos al carrito antes de cobrar con ${metodo === 'TARJETA' ? 'tarjeta' : 'QR DeUna'}.`,
          severidad: 'WARNING',
        });
        return;
      }
      setSimulandoPago(metodo);
    }
  };

  const handleCheckout = async (overrideMetodo?: 'EFECTIVO' | 'TARJETA' | 'QR') => {
    if (cart.length === 0 || !sesionActiva) return;

    if (connectivityStatus === 'OFFLINE_NO_DISPONIBLE') {
      setOperationError('Cobro suspendido: Se requiere conexión al servidor para descargar el catálogo inicial.');
      return;
    }

    const metodoACobrar = overrideMetodo || effectivePaymentMethod;

    setIsProcessing(true);
    setSaleSuccess(null);
    setOperationError(null);

    // MODO OFFLINE SEGURO: Guardar durablemente en IndexedDB
    if (connectivityStatus === 'OFFLINE_LISTO') {
      try {
        const totalPagarOffline = total * 1.16;
        const ventaLocal = await guardarVentaOffline({
          sesion_caja_id: sesionActiva.id,
          sucursal_id: sucursalActual?.id || null,
          terminal_id: sesionActiva.terminal_id || 'TERM-01',
          usuario_id: user?.id || null,
          cajero_nombre: user?.nombre || 'Cajero en Turno',
          cliente_id: clienteData && clienteData.id !== 'cli-temp' && clienteData.id !== 'consumidor-final' ? clienteData.id : null,
          cliente_nombre: clienteData?.nombre || 'CONSUMIDOR FINAL',
          cliente_telefono: clienteTelefono.trim() || null,
          items: cart.map((item) => ({
            producto_id: item.producto_id,
            sku: item.sku,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio_unitario: item.precio_venta,
            subtotal: item.precio_venta * item.cantidad,
            lote_codigo: null
          })),
          subtotal: total,
          descuento: 0,
          impuestos: total * 0.16,
          total_pagar: totalPagarOffline,
          monto_recibido: valorEfectivoNumerico >= totalPagarOffline ? valorEfectivoNumerico : totalPagarOffline,
          cambio: valorEfectivoNumerico >= totalPagarOffline ? valorEfectivoNumerico - totalPagarOffline : 0,
          codigo_cupon: null
        });

        setCurrentTicketData({
          id: ventaLocal.id_local,
          folio_ticket: `OFFLINE-${ventaLocal.id_local.slice(0, 8).toUpperCase()}`,
          id_local: ventaLocal.id_local,
          es_offline: true,
          fecha_hora: ventaLocal.fecha_hora,
          terminal_id: sesionActiva.terminal_id || 'TERM-01',
          cajero_nombre: user?.nombre || 'Cajero en Turno',
          cliente_nombre: clienteData?.nombre || 'CONSUMIDOR FINAL',
          cliente_cedula: clienteData?.cedula || (clienteData?.nombre ? null : '9999999999999'),
          cliente_telefono: clienteTelefono.trim() || null,
          items: cart.map((item) => ({
            nombre: item.nombre,
            sku: item.sku,
            cantidad: item.cantidad,
            precio_unitario: item.precio_venta,
            subtotal: item.precio_venta * item.cantidad,
            lote_codigo: 'Asignación FEFO al sincronizar'
          })),
          subtotal: total,
          descuento: 0,
          impuestos: total * 0.16,
          total: totalPagarOffline,
          metodo_pago: 'EFECTIVO',
          monto_recibido: valorEfectivoNumerico >= totalPagarOffline ? valorEfectivoNumerico : totalPagarOffline,
          cambio: valorEfectivoNumerico >= totalPagarOffline ? valorEfectivoNumerico - totalPagarOffline : 0,
          estado: 'PENDIENTE_SYNC'
        });

        setShowTicketModal(true);
        const msgOffline = `Venta offline registrada en IndexedDB (UUID: ${ventaLocal.id_local.slice(0, 8)}...).`;
        setSaleSuccess(msgOffline);
        mostrarToast({
          titulo: 'Venta Offline Registrada',
          mensaje: msgOffline,
          severidad: 'INFO',
        });
        clearCart();
        setClienteData(null);
        setClienteTelefono('');
        setCodigoCupon('');
        setDescuentoCupon(0);
        setCuponMensaje(null);
        setMontoEfectivoRecibido('');
        checkoutIdempotencyRef.current = null;
        void refreshPendingCount();
      } catch (error: unknown) {
        const errTxt = getApiError(error, 'Error al guardar la venta en la base de datos local IndexedDB.');
        setOperationError(errTxt);
        mostrarToast({
          titulo: 'Error en Venta Offline',
          mensaje: errTxt,
          severidad: 'CRITICO',
        });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // MODO ONLINE: Checkout estándar vía API REST
    const totalPagarFinal = totalConImpuestos;
    const puntosACobrar = canjearPuntos && puntosACanjear > 0 ? puntosACanjear : 0;
    const payload = {
      sesion_caja_id: sesionActiva.id,
      sucursal_id: sucursalActual?.id || null,
      cliente_id: clienteData && clienteData.id !== 'cli-temp' && clienteData.id !== 'consumidor-final' ? clienteData.id : null,
      items: cart.map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad
      })),
      puntos_canjeados: puntosACobrar,
      pagos: [
        {
          metodo_pago: metodoACobrar,
          monto: totalPagarFinal,
          referencia_pasarela: metodoACobrar === 'TARJETA'
            ? `DATAFONE-NFC-${Date.now().toString().slice(-6)}`
            : (metodoACobrar === 'QR' ? `DEUNA-PICHINCHA-${Date.now().toString().slice(-6)}` : null)
        }
      ],
      codigo_cupon: codigoCupon.trim() || null,
      idempotency_key: checkoutIdempotencyRef.current || (checkoutIdempotencyRef.current = crypto.randomUUID())
    };

    try {
      const res = await api.post('/pos/checkout', payload);
      const folioEmitido = res.data.folio_ticket;
      const exitoMsg = `Ticket #${folioEmitido} emitido. Lotes descargados por FEFO.`;
      setSaleSuccess(exitoMsg);
      mostrarToast({
        titulo: 'Venta Completada',
        mensaje: exitoMsg,
        severidad: 'SUCCESS',
      });

      await abrirTicketModalDesdeVenta(res.data.venta_id, metodoACobrar, valorEfectivoNumerico, cambioCalculado);

      clearCart();
      setClienteData(null);
      setClienteTelefono('');
      setCanjearPuntos(false);
      setPuntosACanjear(0);
      setCodigoCupon('');
      setDescuentoCupon(0);
      setCuponMensaje(null);
      setMontoEfectivoRecibido('');
      checkoutIdempotencyRef.current = null;
      cargarCatalogo();
      cargarVentas();
    } catch (error: unknown) {
      const errTxt = getApiError(error, 'No se pudo completar la venta. El carrito se conservó intacto.');
      setOperationError(errTxt);
      mostrarToast({
        titulo: 'Error en Cobro',
        mensaje: errTxt,
        severidad: 'CRITICO',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckoutShortcut = useEffectEvent(handleCheckout);

  // Atajos de teclado globales: F1 (buscador), F2 (CRM teléfono), F3 (cobro), Esc (limpiar carrito), Scanner HID
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Scanner HID de códigos de barras (secuencia rápida de teclas terminando con Enter)
      if (e.key === 'Enter') {
        const buf = scannerBufferRef.current.buffer.trim();
        const now = Date.now();
        const diff = now - scannerBufferRef.current.lastTime;
        scannerBufferRef.current = { buffer: '', lastTime: 0 };
        if (buf.length >= 3 && diff < 250) {
          const prodEncontrado = products.find(
            (p) => (p.codigo_barras && p.codigo_barras.toLowerCase() === buf.toLowerCase()) || 
                   p.sku.toLowerCase() === buf.toLowerCase()
          );
          if (prodEncontrado) {
            e.preventDefault();
            addItem(prodEncontrado);
            mostrarToast({
              titulo: 'Producto Escaneado',
              mensaje: `${prodEncontrado.nombre} agregado al ticket`,
              severidad: 'SUCCESS',
            });
            return;
          }
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const now = Date.now();
        if (now - scannerBufferRef.current.lastTime > 65) {
          scannerBufferRef.current.buffer = e.key;
        } else {
          scannerBufferRef.current.buffer += e.key;
        }
        scannerBufferRef.current.lastTime = now;
      }

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
        if (showRegistroRapidoModal) {
          setShowRegistroRapidoModal(false);
        } else if (showTicketModal) {
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
    cart, estaAbierta, isProcessing, showRegistroRapidoModal, showTicketModal, 
    showConfirmClearCart, productoDetalle, ticketDetalle, 
    showTicketsDrawer, showArqueoModal, showAutocomplete,
    products, addItem
  ]);

  return (
    <div className="flex h-full bg-background overflow-hidden relative font-body-md text-on-surface antialiased">
      {!estaAbierta && <AperturaCajaModal />}

      <ArqueoCiegoModal 
        isOpen={showArqueoModal} 
        onClose={() => setShowArqueoModal(false)} 
      />

      <MovimientoCajaModal
        isOpen={showMovimientoModal}
        onClose={() => setShowMovimientoModal(false)}
      />

      <CorteXModal
        isOpen={showCorteXModal}
        onClose={() => setShowCorteXModal(false)}
      />

      {/* Ticket Modal Térmico Profesional 80mm */}
      <TicketModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        ticket={currentTicketData}
      />

      {/* Modal de Confirmación de Limpieza de Carrito (Esc) */}
      {showConfirmClearCart && (
        <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-surface-container-high/80 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/50 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-error-container/40 text-error rounded-2xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="font-title-md text-title-md font-bold text-on-surface">Vaciar Carrito</h3>
              </div>
              <button 
                onClick={() => setShowConfirmClearCart(false)} 
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-full hover:bg-surface-container"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mb-5">
              ¿Estás seguro de que deseas limpiar la venta actual con <strong>{cart.length} productos</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirmClearCart(false)}
                className="px-4 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface font-title-md text-body-sm font-semibold rounded-full transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  clearCart();
                  setShowConfirmClearCart(false);
                }}
                className="px-5 py-2 bg-error text-on-error font-title-md text-body-sm font-bold rounded-full transition-colors shadow-sm hover:opacity-95"
              >
                Confirmar y Vaciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel Izquierdo: Buscador, Catálogo y Terminal Ágil */}
      <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden">
        
        {/* Barra de Estado de Sesión de Caja & Gamificación Meta del Turno */}
        <div className="bg-surface-container-lowest p-pad-card-sm rounded-2xl shadow-xs border border-surface-container-high/60 mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-fixed/25 text-on-primary-fixed-variant rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="font-label-caps text-label-caps uppercase tracking-wider font-bold">
                {sesionActiva?.terminal_id || 'CAJA-01'}
              </span>
            </div>
            {sucursalActual && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-low border border-surface-container-high/60 rounded-full text-xs font-semibold text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-primary">store</span>
                <span>{sucursalActual.nombre}</span>
              </div>
            )}
            <span className="font-body-sm text-body-sm text-on-surface-variant hidden sm:inline">
              Fondo inicial: <strong className="text-on-surface font-mono font-semibold">${Number(sesionActiva?.fondo_inicial || 0).toFixed(2)}</strong>
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant hidden xl:inline">
              Lector DS2208: <strong className="text-primary font-semibold">Listo</strong>
            </span>
          </div>

          {/* Gamificación: Meta del Turno Neo-Retail */}
          <div className="flex items-center">
            {metaCumplida ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-primary-fixed/30 border border-primary/20 rounded-full animate-in fade-in shadow-xs">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0 animate-bounce" />
                <div className="flex flex-col text-left leading-tight">
                  <span className="font-label-caps text-[10px] font-bold text-on-primary-fixed-variant uppercase tracking-wider">
                    ¡Meta Cumplida! ({porcentajeMeta}%)
                  </span>
                  <span className="font-label-numeric-md text-body-sm font-bold text-primary font-mono">
                    ${ventasTurnoTotal.toFixed(2)} / ${metaTurno.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3.5 py-1.5 bg-surface-container-low rounded-full min-w-[210px] border border-surface-container-high/40">
                <Target className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 text-left">
                  <div className="flex justify-between items-center font-label-caps text-[10px] text-on-surface-variant font-bold mb-1 leading-none">
                    <span>Meta del Turno</span>
                    <span className="font-mono text-primary font-bold">{porcentajeMeta}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-container rounded-full transition-all duration-500"
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-title-md text-body-sm transition-all shadow-xs ${
                modoVentaFlash
                  ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-semibold'
              }`}
            >
              <Zap className={`w-4 h-4 ${modoVentaFlash ? 'fill-current' : 'text-primary'}`} />
              <span>{modoVentaFlash ? 'Venta Flash ON' : 'Venta Flash'}</span>
            </button>

            <button
              onClick={() => setShowMovimientoModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-title-md text-body-sm font-semibold transition-colors shadow-xs cursor-pointer"
              title="Movimientos de Caja (Ingresos / Egresos extraordinarios)"
            >
              <ArrowUpDown className="w-4 h-4 text-primary" />
              <span className="hidden lg:inline">Movimientos</span>
            </button>

            <button
              onClick={() => setShowCorteXModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-title-md text-body-sm font-semibold transition-colors shadow-xs cursor-pointer"
              title="Corte X (Arqueo Parcial en Tiempo Real)"
            >
              <FileSpreadsheet className="w-4 h-4 text-secondary" />
              <span className="hidden md:inline">Corte X</span>
            </button>

            <button
              onClick={verTicketsRecientes}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-title-md text-body-sm font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-secondary" />
              <span className="hidden md:inline">Tickets</span>
            </button>

            <button
              onClick={() => setShowArqueoModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-error-container/30 hover:bg-error-container text-error font-title-md text-body-sm font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Arqueo</span>
            </button>
          </div>
        </div>

        {/* Notificaciones de Operación */}
        {(saleSuccess || operationError) && (
          <div className="flex items-center justify-end mb-3 bg-surface-container-lowest/80 px-3.5 py-1.5 rounded-xl border border-surface-container-high/60 shadow-xs">
            {saleSuccess && (
              <div className="bg-primary-fixed/30 text-on-primary-fixed-variant px-3 py-1 rounded-full font-label-caps uppercase font-bold flex items-center gap-1.5 animate-in fade-in shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="truncate max-w-[280px]">{saleSuccess}</span>
              </div>
            )}
            {operationError && (
              <div className="bg-error-container text-on-error-container px-3 py-1 rounded-full font-label-caps uppercase font-bold flex items-center gap-1.5 animate-in fade-in shrink-0" role="alert">
                <AlertTriangle className="w-3.5 h-3.5 text-error" />
                <span className="truncate max-w-[280px]">{operationError}</span>
              </div>
            )}
          </div>
        )}

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
            <div className="bg-surface-container-lowest p-pad-card-sm sm:p-pad-card-lg rounded-2xl shadow-xs border border-surface-container-high/60 mb-3 flex flex-col gap-2">
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center pointer-events-none text-primary">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full pl-12 pr-16 py-3 bg-surface-container-low rounded-full font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:shadow-md transition-all duration-200"
                  placeholder="Escanear código de barras, SKU o producto..."
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
                <div className="absolute right-2.5 flex items-center gap-1.5">
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setShowAutocomplete(false);
                      }}
                      className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full transition-colors"
                      title="Limpiar búsqueda"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    type="button"
                    className="p-2 bg-primary-container text-on-primary-container rounded-full hover:opacity-90 transition-opacity flex items-center justify-center shadow-xs"
                    title="Buscar"
                  >
                    <Search className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* Popover de Autocompletado en Vivo */}
              {showAutocomplete && autocompleteMatches.length > 0 && (
                <div className="mt-1 bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high/80 z-30 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-2.5 bg-surface-container-low border-b border-surface-container-high/50 flex justify-between items-center font-label-caps text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <span>Sugerencias en vivo ({autocompleteMatches.length})</span>
                    <span>Presiona Enter para agregar el primero</span>
                  </div>
                  <div className="divide-y divide-surface-container-high/40 max-h-64 overflow-y-auto">
                    {autocompleteMatches.map((match) => (
                      <div
                        key={match.sku}
                        onClick={() => handleSelectProductFromAutocomplete(match)}
                        className="p-3 hover:bg-surface-container-low flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant font-bold group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
                            {match.categoria_nombre ? match.categoria_nombre[0].toUpperCase() : 'P'}
                          </div>
                          <div>
                            <span className="font-title-md text-title-md text-on-surface group-hover:text-primary font-semibold block">
                              {match.nombre}
                            </span>
                            <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
                              <span className="font-mono text-xs font-semibold">{match.sku}</span>
                              {match.categoria_nombre && (
                                <span className="bg-surface-container-high px-2 py-0.5 rounded-full font-label-caps text-[10px] uppercase">
                                  {match.categoria_nombre}
                                </span>
                              )}
                              <span className="font-label-caps text-[10px] text-primary font-bold">
                                {match.stock_total || 0} disp.
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-headline-md text-headline-md text-on-surface font-bold">
                            ${match.precio_venta.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs group-hover:scale-105 transition-all"
                            title="Agregar al carrito"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chips de Búsquedas Recientes */}
              {busquedasRecientes.length > 0 && (
                <div className="flex items-center gap-2 pt-1 overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-1 font-label-caps text-label-caps uppercase text-on-surface-variant font-bold shrink-0">
                    <Clock className="w-3.5 h-3.5 text-on-surface-variant" />
                    <span>Recientes:</span>
                  </div>
                  {busquedasRecientes.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectRecentSearch(term)}
                      className="px-3 py-1 bg-surface-container-low hover:bg-surface-container-high rounded-full font-body-sm text-body-sm text-on-surface transition-colors whitespace-nowrap shrink-0 shadow-xs"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selector de Categorías en Pestañas (Pills Neo-Retail) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
              <Filter className="w-4 h-4 text-on-surface-variant shrink-0 ml-1 mr-0.5" />
              {categoriasDisponibles.map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full font-title-md text-body-sm font-semibold whitespace-nowrap transition-all shadow-xs ${
                      isSelected
                        ? 'bg-on-surface text-surface-container-lowest shadow-sm scale-[1.02]'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border border-surface-container-high/50'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Grid de Catálogo de Productos Neo-Retail */}
            <div className="flex-1 overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-on-surface-variant p-8">
                  <ShoppingCart className="w-12 h-12 opacity-30 mb-2" />
                  <p className="font-title-md text-title-md font-semibold text-on-surface">No se encontraron productos coincidentes</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Prueba con otra búsqueda o selecciona otra categoría</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3.5 pb-2">
                  {filteredProducts.map((product) => {
                    const stock = product.stock_total || 0;
                    return (
                      <div
                        key={product.sku}
                        className="group bg-surface-container-lowest p-pad-card-sm rounded-2xl shadow-xs hover:shadow-md border border-surface-container-high/60 hover:border-primary-container transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer"
                        onClick={() => {
                          addItem(product);
                          registrarBusquedaReciente(product.nombre);
                        }}
                      >
                        {/* Contenedor de Imagen Estilizada */}
                        <div className="relative w-full h-32 sm:h-36 bg-surface-container-low rounded-DEFAULT overflow-hidden mb-3 flex items-center justify-center">
                          {product.imagen ? (
                            <img 
                              src={product.imagen} 
                              alt={product.nombre} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-on-surface-variant/40 group-hover:text-primary transition-colors">
                              <ShoppingCart className="w-9 h-9" />
                            </div>
                          )}

                          {product.categoria_nombre && (
                            <span className="absolute top-2 left-2 px-2.5 py-0.5 bg-surface-container-lowest/90 backdrop-blur rounded-full font-label-caps text-label-caps uppercase text-on-surface-variant font-bold shadow-xs">
                              {product.categoria_nombre}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductoDetalle(product);
                            }}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur text-on-surface hover:text-primary transition-colors flex items-center justify-center shadow-xs"
                            title="Ver ficha técnica"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Metadatos y Nombre */}
                        <div className="flex flex-col flex-1">
                          <span className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                            {product.sku}
                          </span>
                          <h3 className="font-title-md text-title-md text-on-surface font-semibold line-clamp-1 mt-0.5">
                            {product.nombre}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`w-2 h-2 rounded-full ${stock > 5 ? 'bg-primary-container' : stock > 0 ? 'bg-amber-500' : 'bg-error'}`} />
                            <span className={`font-label-caps text-label-caps font-bold ${stock > 5 ? 'text-primary' : stock > 0 ? 'text-amber-700' : 'text-error'}`}>
                              Stock: {stock} pzas {stock <= 5 && stock > 0 ? '(Bajo)' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Fila de Precio y Botón (+) Circular Stitch */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-container-high/30">
                          <span className="font-headline-md text-headline-md text-on-surface font-bold">
                            ${product.precio_venta.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addItem(product);
                              registrarBusquedaReciente(product.nombre);
                            }}
                            className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                            title="Añadir a la cuenta"
                          >
                            <Plus className="w-5 h-5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Banner de Trazabilidad FEFO */}
            <div className="bg-surface-container-lowest p-pad-card-sm rounded-2xl shadow-xs border border-surface-container-high/60 flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-title-md text-body-sm font-semibold text-on-surface">Gestión FEFO Inteligente</span>
                  <span className="font-body-sm text-[11px] text-on-surface-variant">Priorizando automáticamente salida del lote con caducidad más cercana.</span>
                </div>
              </div>
              <span className="px-3 py-1 bg-primary-fixed/20 text-on-primary-fixed-variant rounded-full font-label-caps text-label-caps uppercase font-bold tracking-wider">
                FEFO ACTIVO
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Panel Derecho: Ticket en Curso / Carrito de Venta Neo-Retail */}
      <div className="w-[440px] bg-surface-container-lowest border-l border-surface-container-high/70 shadow-xl flex flex-col z-10 p-pad-card-lg">
        {/* Encabezado del Ticket */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/40">
          <div className="flex items-center gap-2.5">
            <h2 className="font-headline-md text-title-lg text-on-surface font-bold">
              Ticket en Curso
            </h2>
            <span className="px-2.5 py-1 bg-primary-fixed/30 text-on-primary-fixed-variant rounded-full font-label-caps text-label-caps uppercase font-bold tracking-wide">
              {cart.length} {cart.length === 1 ? 'Artículo' : 'Artículos'}
            </span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setShowConfirmClearCart(true)}
              className="flex items-center gap-1 text-error hover:opacity-80 transition-opacity px-2.5 py-1 rounded-full font-label-caps text-label-caps uppercase font-semibold"
              title="Vaciar Carrito"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar</span>
            </button>
          )}
        </div>

        {/* CRM y Fidelización Bloque Stitch */}
        <div className="bg-surface-container-low p-pad-card-sm rounded-2xl flex flex-col gap-2 my-2 border border-surface-container-high/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <UserCheck className="w-4 h-4 text-primary" />
              <span className="font-label-caps text-label-caps uppercase font-bold">Cliente Fidelizado</span>
            </div>
            {clienteData && (
              <button 
                onClick={() => {
                  setClienteData(null);
                  setClienteTelefono('');
                }}
                className="font-label-caps text-label-caps uppercase text-secondary font-bold hover:underline"
              >
                Cambiar
              </button>
            )}
          </div>

          {clienteData ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-surface-container-lowest px-3 py-2 rounded-xl border border-surface-container-high/40">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed font-bold text-body-xs font-label-numeric-md">
                    {clienteData.nombre.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-title-md text-body-md text-on-surface font-semibold leading-tight">
                      {clienteData.nombre}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant flex flex-wrap items-center gap-x-2">
                      {clienteData.cedula && <span>Cédula: <strong className="font-mono text-on-surface">{clienteData.cedula}</strong></span>}
                      {clienteData.telefono && <span>Cel: <strong className="font-mono text-on-surface">{clienteData.telefono}</strong></span>}
                      <span>• <strong className="text-primary font-semibold">{clienteData.puntos} pts</strong></span>
                    </span>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>

              {clienteData.puntos > 0 && connectivityStatus === 'ONLINE' && (
                <div className="p-2.5 bg-secondary-fixed/15 border border-secondary-fixed/40 rounded-xl flex flex-col gap-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-secondary" />
                      <span className="text-body-xs font-bold text-on-surface">Puntos Club ({clienteData.puntos} pts)</span>
                    </div>
                    <span className="font-mono text-body-xs font-bold text-secondary">
                      Equivalente a ${(clienteData.puntos / 10).toFixed(2)} MXN
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nuevo = !canjearPuntos;
                        setCanjearPuntos(nuevo);
                        if (nuevo) {
                          setPuntosACanjear(maxPuntosPosibles);
                        } else {
                          setPuntosACanjear(0);
                        }
                      }}
                      className={`px-3 py-1 text-xs rounded-full font-bold transition-all cursor-pointer ${
                        canjearPuntos
                          ? 'bg-secondary text-on-secondary shadow-xs'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {canjearPuntos ? 'Canjeando Puntos' : 'Canjear Puntos'}
                    </button>
                    {canjearPuntos && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="10"
                          max={maxPuntosPosibles}
                          step="10"
                          value={puntosACanjear || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setPuntosACanjear(Math.min(maxPuntosPosibles, Math.max(0, val)));
                          }}
                          className="w-20 px-2 py-0.5 bg-surface-container-lowest border border-surface-container-high rounded-md text-xs font-mono font-bold text-on-surface text-center"
                          placeholder="Pts"
                        />
                        <span className="text-[11px] text-secondary font-mono font-bold">
                          -${effectiveDescuentoPuntos.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <input
                  ref={clienteTelefonoRef}
                  type="text"
                  placeholder="Cédula o Celular..."
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') buscarCliente();
                  }}
                  className="flex-1 min-w-0 px-3 py-1.5 text-body-sm bg-surface-container-lowest border border-surface-container-high/80 rounded-full outline-none focus:ring-2 focus:ring-primary text-on-surface placeholder:text-on-surface-variant"
                />
                <button
                  type="button"
                  onClick={buscarCliente}
                  className="px-3.5 py-1.5 bg-secondary text-on-secondary font-label-caps text-label-caps uppercase font-bold rounded-full transition-opacity hover:opacity-90 flex items-center gap-1 shadow-xs shrink-0 cursor-pointer"
                >
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegistroCedula(clienteTelefono.trim());
                    setRegistroNombre('');
                    setRegistroCelular('');
                    setRegistroCorreo('');
                    setShowRegistroRapidoModal(true);
                  }}
                  className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-caps text-label-caps uppercase font-bold rounded-full transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Registro Rápido de Cliente"
                >
                  <UserPlus className="w-3.5 h-3.5 text-primary" />
                  <span>+ Nuevo</span>
                </button>
              </div>

              {/* Acceso directo a Consumidor Final */}
              <div className="flex items-center justify-between pt-0.5 text-xs">
                <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Por defecto: <strong>Consumidor Final</strong></span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setClienteData({
                      id: 'consumidor-final',
                      cedula: '9999999999999',
                      nombre: 'CONSUMIDOR FINAL',
                      telefono: null,
                      puntos: 0,
                      email: null
                    });
                    setClienteTelefono('9999999999999');
                    mostrarToast({
                      titulo: 'Consumidor Final',
                      mensaje: 'Venta fijada a Consumidor Final (9999999999999).',
                      severidad: 'INFO',
                    });
                  }}
                  className="px-2 py-0.5 rounded-full bg-surface-container-high hover:bg-primary/10 hover:text-primary text-on-surface font-label-caps text-[10px] uppercase font-bold transition-all cursor-pointer"
                >
                  Fijar Consumidor Final
                </button>
              </div>
            </div>
          )}

          {/* Cupón Promocional */}
          <div className="flex items-center gap-2 pt-1 border-t border-surface-container-high/40">
            <input
              type="text"
              placeholder="CÓDIGO DE CUPÓN..."
              value={codigoCupon}
              onChange={(e) => setCodigoCupon(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-1.5 bg-surface-container-lowest rounded-full font-label-caps text-label-caps uppercase tracking-wider text-on-surface outline-none focus:ring-1 focus:ring-primary border border-surface-container-high/60"
            />
            <button
              onClick={aplicarCupon}
              className="px-3 py-1.5 bg-primary-fixed/30 hover:bg-primary-fixed/50 text-on-primary-fixed-variant rounded-full font-label-caps text-label-caps uppercase font-bold flex items-center gap-1 transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Canjear</span>
            </button>
          </div>
          {cuponMensaje && (
            <div className="px-2.5 py-1 bg-primary-fixed/20 text-on-primary-fixed-variant rounded-full flex items-center gap-1 font-label-caps text-[10px] font-bold">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>{cuponMensaje}</span>
            </div>
          )}
        </div>

        {/* Lista de Items con Controles Pill Stitch */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 max-h-[320px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-on-surface-variant my-8">
              <ShoppingCart className="w-12 h-12 opacity-20 mb-2" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Agrega artículos escaneando o tocando el catálogo
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div 
                key={item.sku} 
                className="p-3 bg-surface-container-low rounded-xl flex flex-col gap-1.5 transition-all hover:bg-surface-container border border-surface-container-high/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-title-md text-title-md text-on-surface font-semibold truncate">
                      {item.nombre}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                      ${item.precio_venta.toFixed(2)} c/u
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Control +/- en Pill bg-surface-container-lowest */}
                    <div className="flex items-center bg-surface-container-lowest rounded-full p-0.5 shadow-xs border border-surface-container-high/60">
                      <button 
                        onClick={() => updateQuantity(item.sku, item.cantidad - 1)} 
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface font-bold text-body-sm"
                        title="Restar uno"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-label-numeric-md text-body-md font-bold text-on-surface font-mono">
                        {item.cantidad}
                      </span>
                      <button 
                        onClick={() => updateQuantity(item.sku, item.cantidad + 1)} 
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface font-bold text-body-sm"
                        title="Sumar uno"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col items-end min-w-[70px]">
                      <span className="font-label-numeric-md text-label-numeric-md font-bold text-on-surface font-mono">
                        ${(item.precio_venta * item.cantidad).toFixed(2)}
                      </span>
                    </div>

                    <button 
                      onClick={() => removeItem(item.sku)} 
                      className="text-on-surface-variant hover:text-error p-1 rounded-lg transition-colors"
                      title="Eliminar línea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desglose Financiero con Totales font-display-lg / font-mono */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-container-high/50 mt-1">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span className="font-body-md text-body-md">Subtotal Bruto:</span>
            <span className="font-label-numeric-md text-body-md font-medium font-mono text-on-surface">
              ${total.toFixed(2)}
            </span>
          </div>
          {effectiveDescuentoCupon > 0 && (
            <div className="flex justify-between items-center text-primary font-medium">
              <span className="font-body-md text-body-md">Descuento Cupón:</span>
              <span className="font-label-numeric-md text-body-md font-bold font-mono">
                -${effectiveDescuentoCupon.toFixed(2)}
              </span>
            </div>
          )}
          {effectiveDescuentoPuntos > 0 && (
            <div className="flex justify-between items-center text-secondary font-medium">
              <span className="font-body-md text-body-md">Descuento Lealtad ({puntosACanjear} pts):</span>
              <span className="font-label-numeric-md text-body-md font-bold font-mono">
                -${effectiveDescuentoPuntos.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center text-on-surface-variant">
            <span className="font-body-md text-body-md">IVA Trasladado (16%):</span>
            <span className="font-label-numeric-md text-body-md font-medium font-mono text-on-surface">
              ${(totalConDescuento * 0.16).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-surface-container-high">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant font-bold">
                Total a Pagar
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                Moneda Nacional (MXN)
              </span>
            </div>
            <div className="text-right">
              <span className="font-display-lg text-label-numeric-lg text-on-surface tracking-tight font-extrabold font-mono leading-none">
                ${totalConImpuestos.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Selector de Método de Pago en rounded-xl */}
        <div className="flex flex-col gap-2 pt-2">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">
            Método de Pago Predeterminado
          </span>
          <div className="grid grid-cols-3 gap-2">
            {/* Botón Efectivo */}
            <button
              type="button"
              onClick={() => handleSeleccionarMetodoPago('EFECTIVO')}
              className={`p-2.5 sm:p-3 rounded-xl flex items-center justify-center gap-1.5 font-title-md text-body-sm font-bold transition-all shadow-xs border-2 cursor-pointer ${
                effectivePaymentMethod === 'EFECTIVO'
                  ? 'bg-surface-container-highest text-on-surface border-primary'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-transparent'
              }`}
            >
              <Banknote className="w-4 h-4 text-primary shrink-0" />
              <span>Efectivo</span>
            </button>

            {/* Botón Tarjeta */}
            <button
              type="button"
              disabled={connectivityStatus !== 'ONLINE'}
              onClick={() => handleSeleccionarMetodoPago('TARJETA')}
              className={`p-2.5 sm:p-3 rounded-xl flex items-center justify-center gap-1.5 font-title-md text-body-sm font-bold transition-all shadow-xs border-2 cursor-pointer ${
                connectivityStatus !== 'ONLINE'
                  ? 'bg-surface-container-low text-on-surface-variant/40 border-transparent cursor-not-allowed opacity-50'
                  : effectivePaymentMethod === 'TARJETA'
                  ? 'bg-surface-container-highest text-on-surface border-secondary'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-transparent'
              }`}
              title={connectivityStatus !== 'ONLINE' ? 'Tarjeta bloqueada en modo offline' : 'Cobro con tarjeta contactless'}
            >
              <CreditCard className="w-4 h-4 text-secondary shrink-0" />
              <span>Tarjeta</span>
            </button>

            {/* Botón QR DeUna */}
            <button
              type="button"
              disabled={connectivityStatus !== 'ONLINE'}
              onClick={() => handleSeleccionarMetodoPago('QR')}
              className={`p-2.5 sm:p-3 rounded-xl flex items-center justify-center gap-1.5 font-title-md text-body-sm font-bold transition-all shadow-xs border-2 cursor-pointer ${
                connectivityStatus !== 'ONLINE'
                  ? 'bg-surface-container-low text-on-surface-variant/40 border-transparent cursor-not-allowed opacity-50'
                  : effectivePaymentMethod === 'QR'
                  ? 'bg-[#5b13b9]/15 text-[#5b13b9] dark:text-purple-300 border-[#5b13b9]'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-transparent'
              }`}
              title={connectivityStatus !== 'ONLINE' ? 'QR bloqueado en modo offline' : 'Cobro con código QR DeUna (Banco Pichincha)'}
            >
              <QrCode className="w-4 h-4 text-[#7800ff] shrink-0" />
              <span>QR DeUna</span>
            </button>
          </div>

          {/* Bloque de Cálculo de Cambio en Efectivo Stitch */}
          {effectivePaymentMethod === 'EFECTIVO' && (
            <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-2.5 border border-surface-container-high/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col flex-1">
                  <span className="font-label-caps text-[10px] uppercase text-on-surface-variant font-bold">
                    Importe Recibido (Efectivo)
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-label-numeric-md text-title-md text-on-surface font-bold">$</span>
                    <input
                      type="number"
                      step="0.50"
                      placeholder={totalConImpuestos.toFixed(2)}
                      value={montoEfectivoRecibido}
                      onChange={(e) => setMontoEfectivoRecibido(e.target.value)}
                      className="w-full bg-transparent font-label-numeric-md text-title-lg font-bold text-on-surface focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-label-caps text-[10px] uppercase text-on-surface-variant font-bold">
                    {cambioCalculado > 0 ? 'Vuelto a Entregar' : 'Cambio'}
                  </span>
                  <span className={`px-3 py-1 rounded-full font-label-numeric-md text-title-md font-bold tracking-tight mt-0.5 shadow-xs ${
                    valorEfectivoNumerico >= totalConImpuestos
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}>
                    ${cambioCalculado.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Botones de denominaciones rápidas de efectivo */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-surface-container-high/30">
                <span className="text-[10px] font-label-caps text-on-surface-variant uppercase font-semibold mr-1">Rápido:</span>
                <button
                  type="button"
                  onClick={() => setMontoEfectivoRecibido(totalConImpuestos.toFixed(2))}
                  className="px-2 py-0.5 text-xs rounded-lg bg-surface-container-highest hover:bg-surface-container-highest/80 text-on-surface font-mono font-bold cursor-pointer transition-colors"
                >
                  Exacto
                </button>
                {[5, 10, 20, 50, 100].filter(b => b >= totalConImpuestos || b >= 10).slice(0, 4).map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setMontoEfectivoRecibido(b.toFixed(2))}
                    className="px-2 py-0.5 text-xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-mono font-bold cursor-pointer transition-colors"
                  >
                    ${b}
                  </button>
                ))}
              </div>

              {/* Aviso si falta dinero */}
              {valorEfectivoNumerico > 0 && valorEfectivoNumerico < totalConImpuestos && (
                <div className="text-[11px] text-error font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Faltan ${(totalConImpuestos - valorEfectivoNumerico).toFixed(2)} para completar el pago</span>
                </div>
              )}
            </div>
          )}

          {/* Banner de Modo Offline Seguro */}
          {connectivityStatus === 'OFFLINE_LISTO' && (
            <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-xl flex items-center gap-2 font-semibold text-xs animate-in fade-in">
              <Banknote className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Modo Offline Seguro: Restricción a Efectivo únicamente. Venta durable en IndexedDB.</span>
            </div>
          )}

          {connectivityStatus === 'OFFLINE_NO_DISPONIBLE' && (
            <div className="p-2.5 bg-error-container text-on-error-container rounded-xl flex items-center gap-2 font-bold text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-error shrink-0" />
              <span>Cobro suspendido: Se requiere conexión al servidor central.</span>
            </div>
          )}
        </div>

        {/* Botón Principal Gigante COBRAR (rounded-full) */}
        <div className="pt-2">
          <button 
            disabled={
              cart.length === 0 || 
              isProcessing || 
              !estaAbierta || 
              connectivityStatus === 'OFFLINE_NO_DISPONIBLE'
            }
            onClick={() => {
              if (effectivePaymentMethod === 'TARJETA') {
                setSimulandoPago('TARJETA');
              } else if (effectivePaymentMethod === 'QR') {
                setSimulandoPago('QR');
              } else {
                void handleCheckout('EFECTIVO');
              }
            }}
            className="w-full py-4 px-6 bg-primary-container hover:opacity-95 disabled:bg-surface-container-highest disabled:text-outline disabled:cursor-not-allowed text-on-primary-container rounded-full flex items-center justify-center gap-3 font-title-lg text-headline-md font-bold tracking-tight shadow-md hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer"
            title="Cobrar venta actual"
          >
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            <span>
              {isProcessing
                ? (connectivityStatus === 'OFFLINE_LISTO' ? 'Guardando en IndexedDB...' : 'Descargando FEFO...')
                : connectivityStatus === 'OFFLINE_NO_DISPONIBLE'
                ? 'Cobro Suspendido (Sin Conexión)'
                : connectivityStatus === 'OFFLINE_LISTO'
                ? `COBRAR OFFLINE EN EFECTIVO $${(total * 1.16).toFixed(2)}`
                : effectivePaymentMethod === 'TARJETA'
                ? `ACERCAR TARJETA AL TERMINAL $${totalConImpuestos.toFixed(2)}`
                : effectivePaymentMethod === 'QR'
                ? `COBRAR CON QR DEUNA $${totalConImpuestos.toFixed(2)}`
                : `COBRAR EN EFECTIVO $${totalConImpuestos.toFixed(2)}${cambioCalculado > 0 ? ` (VUELTO: $${cambioCalculado.toFixed(2)})` : ''}`}
            </span>
            <Zap className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>

      {/* ================= MODAL DETALLE PRODUCTO NEO-RETAIL ================= */}
      {productoDetalle && (
        <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full p-6 border border-surface-container-high/80 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-primary-fixed/30 text-on-primary-fixed-variant rounded-2xl">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline-md text-title-lg text-on-surface font-bold">{productoDetalle.nombre}</h3>
                  <span className="font-body-sm text-body-sm font-mono text-on-surface-variant">{productoDetalle.sku}</span>
                </div>
              </div>
              <button 
                onClick={() => setProductoDetalle(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {productoDetalle.imagen && (
              <div className="w-full flex justify-center bg-surface-container-low p-3 rounded-2xl border border-surface-container-high/40 my-3">
                <img 
                  src={productoDetalle.imagen} 
                  alt={productoDetalle.nombre} 
                  className="max-h-44 object-contain rounded-xl"
                />
              </div>
            )}

            <div className="py-3 space-y-3 font-body-sm text-body-sm">
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-surface-container-high/40">
                <div>
                  <span className="text-on-surface-variant font-label-caps uppercase text-[10px] block">Precio de Venta:</span>
                  <p className="font-headline-md text-headline-md font-bold text-primary mt-0.5">
                    ${productoDetalle.precio_venta.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-on-surface-variant font-label-caps uppercase text-[10px] block">Stock Disponible:</span>
                  <p className="font-headline-md text-headline-md font-bold text-on-surface mt-0.5">
                    {productoDetalle.stock_total || 0} pzas
                  </p>
                </div>
                <div>
                  <span className="text-on-surface-variant font-label-caps uppercase text-[10px] block">Código EAN:</span>
                  <p className="font-mono text-on-surface font-semibold mt-0.5">{productoDetalle.codigo_barras || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-on-surface-variant font-label-caps uppercase text-[10px] block">Categoría:</span>
                  <p className="font-title-md font-semibold text-on-surface mt-0.5">{productoDetalle.categoria_nombre || 'General'}</p>
                </div>
              </div>

              <div className="p-3 bg-primary-fixed/20 rounded-2xl border border-primary/20 text-on-primary-fixed-variant leading-relaxed font-body-sm text-body-sm">
                <span className="font-bold block mb-0.5">Mecanismo FEFO:</span>
                Al agregarlo al ticket, el sistema descargará automáticamente las unidades del lote más próximo a caducar.
              </div>
            </div>

            <div className="pt-3 border-t border-surface-container-high/50 flex justify-between items-center">
              <button
                onClick={() => {
                  addItem(productoDetalle);
                  setProductoDetalle(null);
                }}
                className="px-5 py-2.5 bg-primary-container hover:opacity-95 text-on-primary-container font-title-md text-body-sm font-bold rounded-full shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Agregar al Carrito</span>
              </button>
              <button
                onClick={() => setProductoDetalle(null)}
                className="px-5 py-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface font-title-md text-body-sm font-semibold rounded-full transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DRAWER HISTORIAL DE TICKETS NEO-RETAIL ================= */}
      {showTicketsDrawer && (
        <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-4xl w-full p-6 border border-surface-container-high/80 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high/50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-surface-container text-primary rounded-2xl">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-headline-md text-title-lg text-on-surface font-bold">Historial de Tickets Emitidos</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Consultar ticket térmico 80mm, trazabilidad o anulación / baja lógica</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTicketsDrawer(false)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-container-high/60 bg-surface-container-low font-label-caps text-label-caps text-on-surface-variant uppercase">
                    <th className="py-3 px-3">Folio Ticket</th>
                    <th className="py-3 px-3">Fecha y Hora</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3 text-center">Ítems</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                    <th className="py-3 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/30 font-body-sm text-body-sm">
                  {ticketsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-on-surface-variant">No hay tickets registrados recientemente</td>
                    </tr>
                  ) : (
                    ticketsList.map((t) => (
                      <tr 
                        key={t.id} 
                        className="hover:bg-surface-container-low/70 cursor-pointer transition-colors group"
                      >
                        <td 
                          onClick={() => verDetalleTicket(t.id)}
                          className="py-3 px-3 font-mono font-bold text-on-surface group-hover:text-primary"
                        >
                          {t.folio_ticket}
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 text-on-surface-variant">
                          {new Date(t.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(t.fecha_hora).toLocaleDateString()})
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 font-medium text-on-surface">
                          {t.cliente_nombre || 'Consumidor Final'}
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 text-center font-bold text-on-surface">
                          {t.items_count}
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 text-right font-bold text-on-surface font-mono">
                          ${Number(t.total_pagar).toFixed(2)}
                        </td>
                        <td onClick={() => verDetalleTicket(t.id)} className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase ${
                            t.estado === 'COMPLETADA'
                              ? 'bg-primary-fixed/30 text-on-primary-fixed-variant'
                              : 'bg-error-container text-on-error-container'
                          }`}>
                            {t.estado}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={(e) => { e.stopPropagation(); abrirTicketModalDesdeVenta(t.id); }}
                              className="p-2 hover:bg-primary-container/20 text-primary rounded-full transition-colors"
                              title="Ver / Imprimir Ticket Térmico 80mm"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); verDetalleTicket(t.id); }}
                              className="p-2 hover:bg-surface-container text-on-surface-variant rounded-full transition-colors"
                              title="Ver desglose completo de lotes"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-surface-container-high/50 flex justify-end">
              <button
                onClick={() => setShowTicketsDrawer(false)}
                className="px-5 py-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface font-title-md text-body-sm font-semibold rounded-full transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DETALLE DE TICKET & ANULACIÓN ================= */}
      {ticketDetalle && (
        <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-surface-container-high/80 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-primary-fixed/30 text-on-primary-fixed-variant rounded-2xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline-md text-title-lg text-on-surface font-bold">Ticket #{ticketDetalle.folio_ticket}</h3>
                  <span className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                    {new Date(ticketDetalle.fecha_hora).toLocaleString()}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setTicketDetalle(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {ticketAnuladoMsg && (
              <div className="bg-primary-fixed/20 border border-primary/30 text-on-primary-fixed-variant p-3 rounded-2xl font-title-md text-body-sm font-bold text-center my-3">
                {ticketAnuladoMsg}
              </div>
            )}

            <div className="py-3 space-y-3 font-body-sm text-body-sm">
              <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-2xl border border-surface-container-high/40">
                <div>
                  <span className="text-on-surface-variant font-label-caps uppercase text-[10px] block">Cliente Asociado:</span>
                  <span className="font-bold text-on-surface">
                    {ticketDetalle.cliente_nombre ? `${ticketDetalle.cliente_nombre}${ticketDetalle.cliente_cedula ? ` (${ticketDetalle.cliente_cedula})` : ''}` : 'Consumidor Final (9999999999999)'}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant font-label-caps uppercase text-[10px] block">Estado del Ticket:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase ${
                    ticketDetalle.estado === 'COMPLETADA'
                      ? 'bg-primary-fixed/30 text-on-primary-fixed-variant'
                      : 'bg-error-container text-on-error-container'
                  }`}>
                    {ticketDetalle.estado}
                  </span>
                </div>
              </div>

              {/* Detalle de Productos y Lotes FEFO */}
              <div>
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold block mb-1.5 tracking-wider">
                  Líneas de Venta & Lotes FEFO Descargados
                </span>
                <div className="divide-y divide-surface-container-high/40 border border-surface-container-high/60 rounded-2xl overflow-hidden max-h-44 overflow-y-auto">
                  {ticketDetalle.detalles.map((d) => (
                    <div key={d.id} className="p-3 flex justify-between items-center bg-surface-container-lowest font-body-sm text-body-sm">
                      <div>
                        <span className="font-semibold text-on-surface block">{d.producto_nombre}</span>
                        <span className="text-[11px] text-on-surface-variant font-mono">
                          Lote FEFO: <strong>{d.lote_codigo || 'Auto'}</strong> • Cantidad: {d.cantidad}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-on-surface font-mono">${Number(d.subtotal).toFixed(2)}</span>
                        <span className="block text-[11px] text-primary font-semibold">
                          Margen: ${Number(d.margen_ganancia).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagos */}
              <div className="p-3 bg-surface-container-low rounded-2xl border border-surface-container-high/40">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Método de Pago:</span>
                  <span className="font-bold text-on-surface">
                    {ticketDetalle.pagos.map((p) => p.metodo_pago).join(', ') || 'EFECTIVO'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 mt-1 border-t border-dashed border-surface-container-high text-body-md font-bold">
                  <span>Total Cobrado:</span>
                  <span className="text-primary font-mono">${Number(ticketDetalle.total_pagar).toFixed(2)}</span>
                </div>
              </div>

              {/* Formulario de Anulación (Baja Lógica) */}
              {ticketDetalle.estado === 'COMPLETADA' && (
                <form onSubmit={handleAnularTicket} className="p-3.5 bg-error-container/20 rounded-2xl border border-error-container/40 space-y-2">
                  <div className="flex items-center gap-1.5 text-error font-bold font-title-md text-body-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Baja Lógica de Venta (Anulación de Ticket)</span>
                  </div>
                  <p className="font-body-sm text-[11px] text-on-surface-variant leading-relaxed">
                    Al anular este ticket, el estado cambiará a <strong>ANULADA</strong> y las unidades descargadas se restituirán automáticamente a sus lotes FEFO originales.
                  </p>

                  <input
                    type="text"
                    required
                    value={anularMotivo}
                    onChange={(e) => setAnularMotivo(e.target.value)}
                    placeholder="Motivo de la cancelación..."
                    className="w-full px-3 py-1.5 border border-surface-container-high rounded-xl text-body-sm bg-surface-container-lowest outline-none focus:ring-1 focus:ring-error"
                  />

                  <button
                    type="submit"
                    disabled={anulandoTicket}
                    className="w-full py-2 bg-error hover:opacity-90 text-on-error font-title-md text-body-sm font-bold rounded-full shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4" />
                    <span>{anulandoTicket ? 'Revirtiendo stock...' : 'Confirmar Anulación de Ticket'}</span>
                  </button>
                </form>
              )}
            </div>

            <div className="pt-3 border-t border-surface-container-high/50 flex justify-between items-center">
              <button
                type="button"
                onClick={() => abrirTicketModalDesdeVenta(ticketDetalle.id)}
                className="px-5 py-2.5 bg-primary-container hover:opacity-95 text-on-primary-container font-title-md text-body-sm font-bold rounded-full shadow-sm transition-all flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Ver Ticket 80mm</span>
              </button>

              <button
                onClick={() => setTicketDetalle(null)}
                className="px-5 py-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface font-title-md text-body-sm font-semibold rounded-full transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registro Rápido de Cliente (POS) */}
      {showRegistroRapidoModal && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-5 border-b border-surface-container-low flex justify-between items-center bg-surface-container-low/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary-container text-on-primary-container rounded-2xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline-md text-title-md font-bold text-on-surface leading-tight">
                    Registro Rápido de Cliente
                  </h3>
                  <p className="font-body-sm text-[11px] text-on-surface-variant">
                    Alta exprés para asociarlo de inmediato a la venta
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegistroRapidoModal(false)}
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegistroRapidoSubmit} className="p-5 space-y-3.5 text-body-sm">
              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1">
                  Cédula / Documento de Identidad *
                </label>
                <input
                  type="text"
                  required
                  autoFocus={!registroCedula}
                  value={registroCedula}
                  onChange={(e) => setRegistroCedula(e.target.value)}
                  placeholder="Ej. 12345678"
                  className="w-full px-3.5 py-2 bg-surface-container-low rounded-xl font-mono text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all border border-surface-container-high/60"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  autoFocus={Boolean(registroCedula)}
                  value={registroNombre}
                  onChange={(e) => setRegistroNombre(e.target.value)}
                  placeholder="Ej. Roberto Martínez"
                  className="w-full px-3.5 py-2 bg-surface-container-low rounded-xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all border border-surface-container-high/60"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1">
                  Celular / Teléfono *
                </label>
                <input
                  type="tel"
                  required
                  value={registroCelular}
                  onChange={(e) => setRegistroCelular(e.target.value)}
                  placeholder="Ej. 5512345678"
                  className="w-full px-3.5 py-2 bg-surface-container-low rounded-xl font-mono text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all border border-surface-container-high/60"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1">
                  Correo Electrónico (Opcional)
                </label>
                <input
                  type="email"
                  value={registroCorreo}
                  onChange={(e) => setRegistroCorreo(e.target.value)}
                  placeholder="cliente@ejemplo.com"
                  className="w-full px-3.5 py-2 bg-surface-container-low rounded-xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all border border-surface-container-high/60"
                />
              </div>

              <div className="pt-3 border-t border-surface-container-low flex gap-2 justify-end">
                <button
                  type="button"
                  disabled={guardandoCliente}
                  onClick={() => setShowRegistroRapidoModal(false)}
                  className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCliente}
                  className="px-5 py-2 font-title-md text-body-sm font-bold bg-primary hover:opacity-95 text-on-primary rounded-full cursor-pointer transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{guardandoCliente ? 'Guardando...' : 'Registrar y Vincular'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Simulador Interactivo de Pago (Tarjeta Contactless y QR DeUna Banco Pichincha) */}
      <SimuladorPagoModal
        isOpen={simulandoPago !== null}
        metodo={simulandoPago}
        total={totalConImpuestos}
        onSuccess={async (metodo) => {
          setSimulandoPago(null);
          await handleCheckout(metodo);
        }}
        onCancel={() => setSimulandoPago(null)}
      />

    </div>
  );
}
