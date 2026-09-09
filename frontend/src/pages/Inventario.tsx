import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useSucursalStore } from '../store/sucursalStore';
import OrdenCompraModal from '../components/OrdenCompraModal';
import type { OrdenCompraData } from '../components/OrdenCompraModal';
import TransferenciaModal from '../components/TransferenciaModal';
import TransferenciaDetalleModal from '../components/TransferenciaDetalleModal';
import type { TransferenciaData } from '../components/TransferenciaDetalleModal';
import { exportToCSV, formatCurrency, formatNumber, formatDate } from '../utils/exportUtils';
import { mostrarToast } from '../hooks/useWebSocket';
import { 
  validateRequired, 
  validatePositiveNumber, 
  validateFutureDate, 
  validateEan13, 
  validateEmail, 
  validatePhone 
} from '../utils/validation';

interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  total_productos?: number;
}

interface Proveedor {
  id: string;
  nombre: string;
  contacto_nombre?: string;
  telefono?: string;
  email?: string;
  lead_time_dias: number;
  activo: boolean;
}

interface Producto {
  id: string;
  categoria_id: string;
  categoria_nombre?: string;
  sku: string;
  nombre: string;
  codigo_barras?: string;
  costo_base: number;
  precio_venta: number;
  margen_minimo_pct?: number;
  requiere_pesaje: boolean;
  clasificacion_abc?: string;
  imagen?: string | null;
  activo: boolean;
  stock_total: number;
  lotes_activos_count: number;
}

interface Lote {
  id: string;
  producto_id: string;
  producto_nombre?: string;
  producto_sku?: string;
  codigo_lote: string;
  cantidad_inicial?: number;
  cantidad_disponible: number;
  costo_unitario?: number;
  fecha_ingreso?: string;
  fecha_vencimiento?: string;
  estado: string;
}

interface SugerenciaReorden {
  producto_id: string;
  sku: string;
  nombre: string;
  categoria_nombre?: string;
  stock_actual: number;
  punto_reorden: number;
  sugerido_compra: number;
  costo_base: number;
  precio_venta: number;
  clasificacion_abc?: string;
  proveedor_sugerido_id?: string;
  proveedor_sugerido_nombre?: string;
  motivo?: string;
}

type TipoDetalle = 'producto' | 'lote' | 'proveedor' | 'categoria' | 'orden';

interface DetalleModalState {
  tipo: TipoDetalle;
  data: any;
  lotesProducto?: Lote[];
  loadingLotes?: boolean;
}

type TabType = 'catalogo' | 'lotes' | 'ordenes' | 'reorden' | 'movimientos' | 'categorias' | 'traspasos';

export default function Inventario() {
  const { user } = useAuthStore();
  const isSupervisorOrDirector = user?.rol === 'SUPERVISOR' || user?.rol === 'DIRECTOR';
  const isBodeguero = user?.rol === 'BODEGUERO';

  // Multi-sucursal
  const { sucursales, sucursalActual } = useSucursalStore();

  const [activeTab, setActiveTab] = useState<TabType>(
    isBodeguero ? 'lotes' : 'catalogo'
  );
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Estados de datos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ordenesCompra, setOrdenesCompra] = useState<OrdenCompraData[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaData[]>([]);
  const [sugerenciasReorden, setSugerenciasReorden] = useState<SugerenciaReorden[]>([]);
  const [mostrarBannerSugerencias, setMostrarBannerSugerencias] = useState(true);
  const [alertasFefoCount, setAlertasFefoCount] = useState(0);
  const [bannerFefoDismissed, setBannerFefoDismissed] = useState(false);

  // Filtros Catálogo
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [filtroABC, setFiltroABC] = useState<string>('');
  const [soloStockCritico, setSoloStockCritico] = useState(false);

  // Filtros Órdenes y Movimientos
  const [filtroEstadoOrden, setFiltroEstadoOrden] = useState('');
  const [filtroProveedorOrden, setFiltroProveedorOrden] = useState('');
  const [filtroTipoMovimiento, setFiltroTipoMovimiento] = useState<string>('');
  const [searchMovimiento, setSearchMovimiento] = useState('');

  // Filtros Traspasos
  const [filtroEstadoTransferencia, setFiltroEstadoTransferencia] = useState('');
  const [searchTransferencia, setSearchTransferencia] = useState('');

  // Modal de Detalles Unificado
  const [detalleItem, setDetalleItem] = useState<DetalleModalState | null>(null);

  // Modales de Acción
  const [modalProducto, setModalProducto] = useState<{ open: boolean; editando?: Producto | null }>({ open: false });
  const [modalIngresoLote, setModalIngresoLote] = useState(false);
  const [modalBajaLote, setModalBajaLote] = useState<{ open: boolean; lote?: Lote | null }>({ open: false });
  const [modalProveedor, setModalProveedor] = useState<{ open: boolean; editando?: Proveedor | null }>({ open: false });
  const [modalCategoria, setModalCategoria] = useState<{ open: boolean; editando?: Categoria | null }>({ open: false });
  const [modalTransferenciaOpen, setModalTransferenciaOpen] = useState(false);
  const [detalleTransferencia, setDetalleTransferencia] = useState<TransferenciaData | null>(null);

  // Modal de Órdenes de Compra (Crear y Recibir Mercancía)
  const [modalOrden, setModalOrden] = useState<{
    open: boolean;
    modo: 'crear' | 'recibir';
    ordenParaRecibir?: OrdenCompraData | null;
    productoPreseleccionadoId?: string;
  }>({ open: false, modo: 'crear' });

  // Formularios
  const [formProd, setFormProd] = useState({
    categoria_id: '',
    sku: '',
    nombre: '',
    codigo_barras: '',
    costo_base: '',
    precio_venta: '',
    margen_minimo_pct: '15.0',
    requiere_pesaje: false,
    clasificacion_abc: 'A',
    imagen: ''
  });

  const [formLote, setFormLote] = useState({
    producto_id: '',
    codigo_lote: '',
    cantidad: '',
    costo_unitario: '',
    fecha_vencimiento: '',
    notas: ''
  });

  const [formBaja, setFormBaja] = useState({
    motivo: 'MERMA',
    cantidad_baja: '',
    notas: ''
  });

  const [formProv, setFormProv] = useState({
    nombre: '',
    contacto_nombre: '',
    telefono: '',
    email: '',
    lead_time_dias: '7'
  });

  const [formCat, setFormCat] = useState({
    nombre: '',
    descripcion: ''
  });

  const [errorsProd, setErrorsProd] = useState<Record<string, string | null>>({});
  const [errorsLote, setErrorsLote] = useState<Record<string, string | null>>({});
  const [errorsBaja, setErrorsBaja] = useState<Record<string, string | null>>({});
  const [errorsProv, setErrorsProv] = useState<Record<string, string | null>>({});
  const [errorsCat, setErrorsCat] = useState<Record<string, string | null>>({});

  const showToast = useCallback((tipo: 'success' | 'error', mensaje: string) => {
    setFeedback({ tipo, mensaje });
    mostrarToast({
      titulo: tipo === 'success' ? 'Inventario' : 'Error en Inventario',
      mensaje,
      severidad: tipo === 'success' ? 'SUCCESS' : 'CRITICO',
    });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [resProd, resLot, resProv, resCat, resOC, resSug, resFefo, resTr] = await Promise.all([
        api.get('/inventario/productos', { params: { activo_only: !mostrarInactivos, sucursal_id: sucursalActual?.id } }),
        api.get('/inventario/lotes', { params: { sucursal_id: sucursalActual?.id } }),
        api.get('/inventario/proveedores', { params: { activo_only: !mostrarInactivos } }),
        api.get('/inventario/categorias', { params: { activo_only: !mostrarInactivos } }),
        api.get('/inventario/ordenes-compra', { params: { estado: filtroEstadoOrden || undefined, proveedor_id: filtroProveedorOrden || undefined } }),
        api.get('/inventario/ordenes-compra/sugerencias', { params: { sucursal_id: sucursalActual?.id } }),
        api.get('/inventario/alertas-caducidad', { params: { dias_alerta: 15, sucursal_id: sucursalActual?.id } }),
        api.get('/transferencias')
      ]);
      setProductos(resProd.data);
      setLotes(resLot.data);
      setProveedores(resProv.data);
      setCategorias(resCat.data);
      setOrdenesCompra(resOC.data);
      setSugerenciasReorden(resSug.data);
      setAlertasFefoCount(resFefo.data?.length || 0);
      setTransferencias(resTr.data || []);
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al sincronizar datos de inventario');
    } finally {
      setLoading(false);
    }
  }, [filtroEstadoOrden, filtroProveedorOrden, mostrarInactivos, showToast, sucursalActual?.id]);

  const cargarTransferencias = useCallback(async () => {
    try {
      const res = await api.get('/transferencias', {
        params: {
          estado: filtroEstadoTransferencia || undefined
        }
      });
      setTransferencias(res.data || []);
    } catch (err: any) {
      console.error('Error al cargar transferencias:', err);
    }
  }, [filtroEstadoTransferencia]);

  const cargarOrdenes = useCallback(async () => {
    try {
      const res = await api.get('/inventario/ordenes-compra', {
        params: {
          estado: filtroEstadoOrden || undefined,
          proveedor_id: filtroProveedorOrden || undefined
        }
      });
      setOrdenesCompra(res.data);
    } catch (err: any) {
      console.error(err);
    }
  }, [filtroEstadoOrden, filtroProveedorOrden]);

  useEffect(() => {
    queueMicrotask(() => void cargarDatos());
  }, [cargarDatos]);

  useEffect(() => {
    if (activeTab === 'ordenes') {
      queueMicrotask(() => void cargarOrdenes());
    }
  }, [activeTab, cargarOrdenes]);

  useEffect(() => {
    if (activeTab === 'traspasos') {
      queueMicrotask(() => void cargarTransferencias());
    }
  }, [activeTab, cargarTransferencias]);

  // =========================================================================
  // HANDLERS PARA ORDENES DE COMPRA Y MODO BODEGUERO
  // =========================================================================
  const handleAbrirCrearOrden = (preselectedProdId?: string) => {
    setModalOrden({
      open: true,
      modo: 'crear',
      productoPreseleccionadoId: preselectedProdId
    });
  };

  const handleAbrirRecibirOrden = (orden: OrdenCompraData) => {
    setModalOrden({
      open: true,
      modo: 'recibir',
      ordenParaRecibir: orden
    });
  };

  const handleCancelarOrden = async (ordenId: string) => {
    if (!confirm('¿Estás seguro de cancelar esta orden de compra pendiente?')) return;
    try {
      await api.post(`/inventario/ordenes-compra/${ordenId}/cancelar`);
      showToast('success', 'Orden de compra cancelada correctamente');
      cargarOrdenes();
      cargarDatos();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al cancelar la orden');
    }
  };

  const handleVerDetalleOrden = (orden: OrdenCompraData) => {
    setDetalleItem({
      tipo: 'orden',
      data: orden
    });
  };

  // =========================================================================
  // HANDLERS PARA VISUALIZACIÓN DE DETALLES EN MODAL
  // =========================================================================
  const handleVerDetalleProducto = async (prod: Producto) => {
    setDetalleItem({
      tipo: 'producto',
      data: prod,
      loadingLotes: true,
      lotesProducto: []
    });

    try {
      const res = await api.get('/inventario/lotes', { params: { producto_id: prod.id, sucursal_id: sucursalActual?.id } });
      setDetalleItem({
        tipo: 'producto',
        data: prod,
        loadingLotes: false,
        lotesProducto: res.data
      });
    } catch {
      setDetalleItem({
        tipo: 'producto',
        data: prod,
        loadingLotes: false,
        lotesProducto: lotes.filter(l => l.producto_id === prod.id)
      });
    }
  };

  const handleVerDetalleLote = (lote: Lote) => {
    setDetalleItem({
      tipo: 'lote',
      data: lote
    });
  };

  const handleVerDetalleProveedor = (prov: Proveedor) => {
    setDetalleItem({
      tipo: 'proveedor',
      data: prov
    });
  };

  const handleVerDetalleCategoria = (cat: Categoria) => {
    const prodsCount = productos.filter(p => p.categoria_id === cat.id).length;
    setDetalleItem({
      tipo: 'categoria',
      data: { ...cat, total_productos: prodsCount }
    });
  };

  // =========================================================================
  // HANDLERS PRODUCTOS
  // =========================================================================
  const handleAbrirCrearProducto = () => {
    setFormProd({
      categoria_id: categorias[0]?.id || '',
      sku: '',
      nombre: '',
      codigo_barras: '',
      costo_base: '',
      precio_venta: '',
      margen_minimo_pct: '15.0',
      requiere_pesaje: false,
      clasificacion_abc: 'A',
      imagen: ''
    });
    setErrorsProd({});
    setModalProducto({ open: true, editando: null });
  };

  const handleAbrirEditarProducto = (prod: Producto) => {
    setFormProd({
      categoria_id: prod.categoria_id,
      sku: prod.sku,
      nombre: prod.nombre,
      codigo_barras: prod.codigo_barras || '',
      costo_base: String(prod.costo_base),
      precio_venta: String(prod.precio_venta),
      margen_minimo_pct: String(prod.margen_minimo_pct || 15),
      requiere_pesaje: prod.requiere_pesaje,
      clasificacion_abc: prod.clasificacion_abc || 'A',
      imagen: prod.imagen || ''
    });
    setErrorsProd({});
    setModalProducto({ open: true, editando: prod });
  };

  const validarProducto = (): boolean => {
    const errs: Record<string, string | null> = {};
    const errSku = validateRequired(formProd.sku, 'SKU', 3, 30);
    if (errSku) errs.sku = errSku;

    const errCat = validateRequired(formProd.categoria_id, 'Categoría');
    if (errCat) errs.categoria_id = errCat;

    const errNombre = validateRequired(formProd.nombre, 'Nombre del producto', 3);
    if (errNombre) errs.nombre = errNombre;

    if (formProd.codigo_barras.trim()) {
      const errEan = validateEan13(formProd.codigo_barras);
      if (errEan) errs.codigo_barras = errEan;
    }

    if (!isBodeguero) {
      const errCosto = validatePositiveNumber(formProd.costo_base, 'Costo base', { min: 0.01 });
      if (errCosto) errs.costo_base = errCosto;

      const errPrecio = validatePositiveNumber(formProd.precio_venta, 'Precio de venta', { min: 0.01 });
      if (errPrecio) {
        errs.precio_venta = errPrecio;
      } else if (!errCosto) {
        const costo = parseFloat(formProd.costo_base);
        const precio = parseFloat(formProd.precio_venta);
        if (precio <= costo) {
          errs.precio_venta = `El precio de venta ($${precio.toFixed(2)}) no puede ser menor o igual al costo base ($${costo.toFixed(2)})`;
        }
      }

      if (formProd.margen_minimo_pct) {
        const errMargen = validatePositiveNumber(formProd.margen_minimo_pct, 'Margen mínimo', { allowZero: true, min: 0, max: 100 });
        if (errMargen) errs.margen_minimo_pct = errMargen;
      }
    }

    setErrorsProd(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarProducto()) {
      showToast('error', 'Por favor corrige los campos señalados con error');
      return;
    }

    try {
      const payload = {
        categoria_id: formProd.categoria_id,
        sku: formProd.sku.trim(),
        nombre: formProd.nombre.trim(),
        codigo_barras: formProd.codigo_barras.trim() || null,
        costo_base: parseFloat(formProd.costo_base),
        precio_venta: parseFloat(formProd.precio_venta),
        margen_minimo_pct: parseFloat(formProd.margen_minimo_pct),
        requiere_pesaje: formProd.requiere_pesaje,
        clasificacion_abc: formProd.clasificacion_abc,
        imagen: formProd.imagen.trim() || null
      };

      if (modalProducto.editando) {
        await api.put(`/inventario/productos/${modalProducto.editando.id}`, payload);
        showToast('success', 'Producto actualizado correctamente');
      } else {
        await api.post('/inventario/productos', payload);
        showToast('success', 'Producto registrado exitosamente');
      }
      setModalProducto({ open: false });
      if (detalleItem?.tipo === 'producto') setDetalleItem(null);
      cargarDatos();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const newErrs: Record<string, string | null> = {};
        for (const item of detail) {
          const field = item.loc?.[item.loc.length - 1];
          if (field) newErrs[field] = item.msg;
        }
        if (Object.keys(newErrs).length > 0) setErrorsProd(newErrs);
      }
      showToast('error', typeof detail === 'string' ? detail : 'Error al guardar producto');
    }
  };

  const handleToggleActivoProducto = async (prod: Producto) => {
    try {
      if (prod.activo) {
        await api.delete(`/inventario/productos/${prod.id}`);
        showToast('success', `Producto ${prod.sku} dado de baja lógicamente`);
      } else {
        await api.put(`/inventario/productos/${prod.id}`, { activo: true });
        showToast('success', `Producto ${prod.sku} reactivado`);
      }
      if (detalleItem?.tipo === 'producto') setDetalleItem(null);
      cargarDatos();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al modificar estado del producto');
    }
  };

  // =========================================================================
  // HANDLERS LOTES E INGRESO DIRECTO
  // =========================================================================
  const handleAbrirIngresoLote = (preselectProdId?: string) => {
    const pId = preselectProdId || productos[0]?.id || '';
    const prod = productos.find(p => p.id === pId);
    const dateHoy = new Date();
    dateHoy.setMonth(dateHoy.getMonth() + 6);
    const vencimientoDefecto = dateHoy.toISOString().split('T')[0];

    setFormLote({
      producto_id: pId,
      codigo_lote: `LOT-${prod?.sku || '001'}-${Date.now().toString().slice(-4)}`,
      cantidad: '25',
      costo_unitario: String(prod?.costo_base || '15.00'),
      fecha_vencimiento: vencimientoDefecto,
      notas: 'Ingreso directo al almacén'
    });
    setErrorsLote({});
    setModalIngresoLote(true);
  };

  const validarIngresoLote = (): boolean => {
    const errs: Record<string, string | null> = {};
    const errProd = validateRequired(formLote.producto_id, 'Artículo / Producto');
    if (errProd) errs.producto_id = errProd;

    const errCodigo = validateRequired(formLote.codigo_lote, 'Código de lote', 3);
    if (errCodigo) errs.codigo_lote = errCodigo;

    const errCant = validatePositiveNumber(formLote.cantidad, 'Cantidad', { min: 0.01 });
    if (errCant) errs.cantidad = errCant;

    if (!isBodeguero) {
      const errCosto = validatePositiveNumber(formLote.costo_unitario, 'Costo unitario', { min: 0.01 });
      if (errCosto) errs.costo_unitario = errCosto;
    }

    if (formLote.fecha_vencimiento) {
      const errFecha = validateFutureDate(formLote.fecha_vencimiento, 'Fecha de caducidad');
      if (errFecha) errs.fecha_vencimiento = errFecha;
    } else {
      errs.fecha_vencimiento = 'La fecha de caducidad sanitaria es obligatoria (política FEFO)';
    }

    setErrorsLote(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGuardarIngresoLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarIngresoLote()) {
      showToast('error', 'Por favor corrige los campos señalados con error');
      return;
    }

    try {
      await api.post('/inventario/lotes/ingreso-directo', {
        producto_id: formLote.producto_id,
        codigo_lote: formLote.codigo_lote.trim(),
        cantidad: parseFloat(formLote.cantidad),
        costo_unitario: parseFloat(formLote.costo_unitario),
        fecha_vencimiento: formLote.fecha_vencimiento || null,
        sucursal_id: sucursalActual?.id,
        notas: formLote.notas
      });
      showToast('success', `Lote ${formLote.codigo_lote} ingresado. FEFO activo.`);
      setModalIngresoLote(false);
      if (detalleItem?.tipo === 'producto') setDetalleItem(null);
      cargarDatos();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const newErrs: Record<string, string | null> = {};
        for (const item of detail) {
          const field = item.loc?.[item.loc.length - 1];
          if (field) newErrs[field] = item.msg;
        }
        if (Object.keys(newErrs).length > 0) setErrorsLote(newErrs);
      }
      showToast('error', typeof detail === 'string' ? detail : 'Error al ingresar lote');
    }
  };

  const handleAbrirBajaLote = (lote: Lote) => {
    setFormBaja({
      motivo: 'MERMA',
      cantidad_baja: String(lote.cantidad_disponible),
      notas: ''
    });
    setErrorsBaja({});
    setModalBajaLote({ open: true, lote });
  };

  const handleConfirmarBajaLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalBajaLote.lote) return;

    const max = modalBajaLote.lote.cantidad_disponible;
    const errCant = validatePositiveNumber(formBaja.cantidad_baja, 'Cantidad a dar de baja', { min: 0.01, max });
    if (errCant) {
      setErrorsBaja({ cantidad_baja: errCant });
      showToast('error', errCant);
      return;
    }

    try {
      await api.post(`/inventario/lotes/${modalBajaLote.lote.id}/baja`, {
        motivo: formBaja.motivo,
        cantidad_baja: parseFloat(formBaja.cantidad_baja),
        notas: formBaja.notas
      });
      showToast('success', `Baja de inventario registrada (${formBaja.motivo})`);
      setModalBajaLote({ open: false });
      if (detalleItem?.tipo === 'lote') setDetalleItem(null);
      cargarDatos();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al dar de baja lote');
    }
  };

  // =========================================================================
  // HANDLERS PROVEEDORES Y CATEGORIAS
  // =========================================================================
  const handleAbrirCrearProveedor = () => {
    setFormProv({
      nombre: '',
      contacto_nombre: '',
      telefono: '',
      email: '',
      lead_time_dias: '7'
    });
    setErrorsProv({});
    setModalProveedor({ open: true, editando: null });
  };

  const handleGuardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string | null> = {};
    const errNom = validateRequired(formProv.nombre, 'Razón social', 3);
    if (errNom) errs.nombre = errNom;

    if (formProv.telefono?.trim()) {
      const errTel = validatePhone(formProv.telefono, false);
      if (errTel) errs.telefono = errTel;
    }
    if (formProv.email?.trim()) {
      const errMail = validateEmail(formProv.email, false);
      if (errMail) errs.email = errMail;
    }
    if (formProv.lead_time_dias) {
      const errLead = validatePositiveNumber(formProv.lead_time_dias, 'Lead time', { allowZero: true, min: 0, decimalsAllowed: false });
      if (errLead) errs.lead_time_dias = errLead;
    }

    if (Object.keys(errs).length > 0) {
      setErrorsProv(errs);
      showToast('error', 'Por favor corrige los campos señalados con error');
      return;
    }

    try {
      const payload = {
        nombre: formProv.nombre.trim(),
        contacto_nombre: formProv.contacto_nombre?.trim() || null,
        telefono: formProv.telefono?.trim() || null,
        email: formProv.email?.trim() || null,
        lead_time_dias: parseInt(formProv.lead_time_dias) || 7
      };
      if (modalProveedor.editando) {
        await api.put(`/inventario/proveedores/${modalProveedor.editando.id}`, payload);
        showToast('success', 'Proveedor actualizado');
      } else {
        await api.post('/inventario/proveedores', payload);
        showToast('success', 'Proveedor registrado');
      }
      setModalProveedor({ open: false });
      if (detalleItem?.tipo === 'proveedor') setDetalleItem(null);
      cargarDatos();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al guardar proveedor');
    }
  };

  const handleAbrirCrearCategoria = () => {
    setFormCat({ nombre: '', descripcion: '' });
    setErrorsCat({});
    setModalCategoria({ open: true, editando: null });
  };

  const handleGuardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    const errNom = validateRequired(formCat.nombre, 'Nombre de categoría', 3);
    if (errNom) {
      setErrorsCat({ nombre: errNom });
      showToast('error', errNom);
      return;
    }

    try {
      if (modalCategoria.editando) {
        await api.put(`/inventario/categorias/${modalCategoria.editando.id}`, {
          nombre: formCat.nombre.trim(),
          descripcion: formCat.descripcion.trim()
        });
        showToast('success', 'Categoría actualizada');
      } else {
        await api.post('/inventario/categorias', {
          nombre: formCat.nombre.trim(),
          descripcion: formCat.descripcion.trim()
        });
        showToast('success', 'Categoría creada');
      }
      setModalCategoria({ open: false });
      if (detalleItem?.tipo === 'categoria') setDetalleItem(null);
      cargarDatos();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al guardar categoría');
    }
  };

  // Filtros aplicados para catálogo
  const productosFiltrados = productos.filter((p) => {
    const matchSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (p.codigo_barras && p.codigo_barras.includes(searchQuery));
    const matchCat = !categoriaFiltro || p.categoria_id === categoriaFiltro;
    const matchABC = !filtroABC || (p.clasificacion_abc || 'A').toUpperCase() === filtroABC;
    const matchCritico = !soloStockCritico || (p.stock_total <= 0);
    return matchSearch && matchCat && matchABC && matchCritico;
  });

  // Semáforo FEFO: <= 7 días (rojo), <= 30 días (ámbar), > 30 días (verde)
  const getSemaforoFefo = (fechaVencimiento?: string) => {
    if (!fechaVencimiento) {
      return { 
        color: 'bg-surface-container-high text-on-surface-variant border-outline-variant/30', 
        dotColor: 'bg-outline',
        texto: 'Sin fecha',
        dias: null
      };
    }
    const hoy = new Date();
    const venc = new Date(fechaVencimiento);
    const diffDias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return { 
        color: 'bg-error-container text-on-error-container border-error/30', 
        dotColor: 'bg-error',
        texto: `Vencido (${Math.abs(diffDias)}d)`,
        dias: diffDias
      };
    }
    if (diffDias <= 7) {
      return { 
        color: 'bg-error-container text-on-error-container border-error/30', 
        dotColor: 'bg-error',
        texto: `Crítico: ${diffDias}d`,
        dias: diffDias
      };
    }
    if (diffDias <= 30) {
      return { 
        color: 'bg-amber-100 text-amber-900 border-amber-300', 
        dotColor: 'bg-amber-600',
        texto: `Alerta: ${diffDias}d`,
        dias: diffDias
      };
    }
    return { 
      color: 'bg-primary-fixed text-on-primary-fixed border-primary/20', 
      dotColor: 'bg-primary',
      texto: `${diffDias} días`,
      dias: diffDias
    };
  };

  // Movimientos unificados para pestaña Movimientos
  const movimientosKardex = useMemo(() => {
    const list: Array<{
      id: string;
      tipo: 'INGRESO_DIRECTO' | 'RECEPCION_OC' | 'BAJA_MERMA';
      tipoEtiqueta: string;
      fecha: string;
      producto_sku: string;
      producto_nombre: string;
      cantidad: number;
      codigo_lote: string;
      costo_unitario?: number;
      origen: string;
      estado: string;
    }> = [];

    // Lotes como ingresos o bajas
    lotes.forEach(l => {
      if (l.estado === 'MERMA' || l.estado === 'CADUCADO') {
        list.push({
          id: `baja-${l.id}`,
          tipo: 'BAJA_MERMA',
          tipoEtiqueta: `Baja / ${l.estado}`,
          fecha: l.fecha_ingreso || new Date().toISOString(),
          producto_sku: l.producto_sku || 'N/A',
          producto_nombre: l.producto_nombre || 'Producto',
          cantidad: -Math.abs(Number(l.cantidad_disponible || l.cantidad_inicial || 0)),
          codigo_lote: l.codigo_lote,
          costo_unitario: l.costo_unitario,
          origen: 'Ajuste Sanitario / Merma',
          estado: l.estado
        });
      } else {
        list.push({
          id: `ingreso-${l.id}`,
          tipo: 'INGRESO_DIRECTO',
          tipoEtiqueta: 'Ingreso a Almacén',
          fecha: l.fecha_ingreso || new Date().toISOString(),
          producto_sku: l.producto_sku || 'N/A',
          producto_nombre: l.producto_nombre || 'Producto',
          cantidad: Number(l.cantidad_inicial || l.cantidad_disponible || 0),
          codigo_lote: l.codigo_lote,
          costo_unitario: l.costo_unitario,
          origen: 'Bodega Central',
          estado: l.estado
        });
      }
    });

    // Ordenes recibidas como recepciones
    ordenesCompra.filter(o => o.estado === 'RECIBIDA').forEach(o => {
      o.detalles?.forEach(d => {
        list.push({
          id: `oc-${o.id}-${d.producto_id}`,
          tipo: 'RECEPCION_OC',
          tipoEtiqueta: 'Recepción de OC',
          fecha: o.fecha_recepcion || o.fecha_emision,
          producto_sku: d.producto_sku || 'N/A',
          producto_nombre: d.producto_nombre || 'Producto',
          cantidad: Number(d.cantidad_solicitada || 0),
          codigo_lote: `OC-#${o.id.slice(0, 6)}`,
          costo_unitario: d.costo_unitario_pactado,
          origen: o.proveedor_nombre || 'Proveedor',
          estado: 'RECIBIDA'
        });
      });
    });

    // Filtrar y ordenar
    return list
      .filter(m => {
        const matchTipo = !filtroTipoMovimiento || m.tipo === filtroTipoMovimiento;
        const matchSearch = !searchMovimiento || 
          m.producto_nombre.toLowerCase().includes(searchMovimiento.toLowerCase()) ||
          m.producto_sku.toLowerCase().includes(searchMovimiento.toLowerCase()) ||
          m.codigo_lote.toLowerCase().includes(searchMovimiento.toLowerCase());
        return matchTipo && matchSearch;
      })
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [lotes, ordenesCompra, filtroTipoMovimiento, searchMovimiento]);

  const transferenciasFiltradas = useMemo(() => {
    return transferencias.filter((t) => {
      const matchEstado = !filtroEstadoTransferencia || t.estado === filtroEstadoTransferencia;
      const q = searchTransferencia.trim().toLowerCase();
      const matchQuery =
        !q ||
        t.folio.toLowerCase().includes(q) ||
        (t.sucursal_origen_nombre || '').toLowerCase().includes(q) ||
        (t.sucursal_destino_nombre || '').toLowerCase().includes(q) ||
        (t.detalles || []).some(
          (d) =>
            (d.producto_nombre || '').toLowerCase().includes(q) ||
            (d.producto_sku || '').toLowerCase().includes(q)
        );
      return matchEstado && matchQuery;
    });
  }, [transferencias, filtroEstadoTransferencia, searchTransferencia]);

  const handleExportarCSV = () => {
    if (activeTab === 'lotes') {
      exportToCSV({
        filename: `inventario_lotes_fefo_valorizado_${new Date().toISOString().slice(0, 10)}.csv`,
        data: lotes,
        columns: [
          { key: 'codigo_lote', header: 'Código Lote' },
          { key: 'producto_sku', header: 'SKU Producto', formatter: (v) => v || 'N/A' },
          { key: 'producto_nombre', header: 'Descripción Producto', formatter: (v) => v || 'N/A' },
          { key: 'cantidad_inicial', header: 'Cantidad Inicial', formatter: (v) => formatNumber(v, 2) },
          { key: 'cantidad_disponible', header: 'Cantidad Disponible', formatter: (v) => formatNumber(v, 2) },
          { key: 'costo_unitario', header: 'Costo Unitario ($)', formatter: (v) => formatCurrency(v) },
          { 
            key: 'valor_lote', 
            header: 'Valor Total Lote ($)', 
            formatter: (_, item) => formatCurrency((Number(item.cantidad_disponible) || 0) * (Number(item.costo_unitario) || 0)) 
          },
          { key: 'fecha_ingreso', header: 'Fecha Ingreso', formatter: (v) => formatDate(v) },
          { key: 'fecha_vencimiento', header: 'Fecha Caducidad', formatter: (v) => v || 'Sin fecha' },
          { key: 'estado', header: 'Estado FEFO' }
        ]
      });
      showToast('success', 'Reporte de Lotes FEFO Valorizados exportado exitosamente');
    } else {
      exportToCSV({
        filename: `inventario_catalogo_valorizado_${new Date().toISOString().slice(0, 10)}.csv`,
        data: productos,
        columns: [
          { key: 'sku', header: 'SKU' },
          { key: 'nombre', header: 'Descripción Producto' },
          { key: 'categoria_nombre', header: 'Categoría', formatter: (v) => v || 'General' },
          { key: 'stock_total', header: 'Stock Total', formatter: (v) => formatNumber(v, 2) },
          { key: 'costo_base', header: 'Costo Base ($)', formatter: (v) => formatCurrency(v) },
          { key: 'precio_venta', header: 'Precio Venta ($)', formatter: (v) => formatCurrency(v) },
          { key: 'margen_minimo_pct', header: 'Margen (%)', formatter: (v) => `${formatNumber(v, 1)}%` },
          { 
            key: 'valor_costo', 
            header: 'Valorizado al Costo ($)', 
            formatter: (_, item) => formatCurrency((Number(item.stock_total) || 0) * (Number(item.costo_base) || 0)) 
          },
          { 
            key: 'valor_venta', 
            header: 'Valorizado a la Venta ($)', 
            formatter: (_, item) => formatCurrency((Number(item.stock_total) || 0) * (Number(item.precio_venta) || 0)) 
          },
          { 
            key: 'utilidad_proyectada', 
            header: 'Utilidad Proyectada ($)', 
            formatter: (_, item) => {
              const costo = (Number(item.stock_total) || 0) * (Number(item.costo_base) || 0);
              const venta = (Number(item.stock_total) || 0) * (Number(item.precio_venta) || 0);
              return formatCurrency(venta - costo);
            } 
          },
          { key: 'clasificacion_abc', header: 'Clasificación ABC', formatter: (v) => v || 'C' },
          { key: 'lotes_activos_count', header: 'Lotes Activos', formatter: (v) => formatNumber(v, 0) },
          { key: 'activo', header: 'Estado', formatter: (v) => v ? 'Activo' : 'Inactivo' }
        ]
      });
      showToast('success', 'Catálogo de Inventario Valorizado exportado exitosamente');
    }
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto bg-background text-on-surface font-body-md select-none">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`fixed top-5 right-8 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-body-sm font-semibold transition-all ${
          feedback.tipo === 'success' 
            ? 'bg-primary text-on-primary border-primary-container' 
            : 'bg-error text-on-error border-error-container'
        }`}>
          <span className="material-symbols-outlined text-xl">
            {feedback.tipo === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{feedback.mensaje}</span>
        </div>
      )}

      {/* Banner de Modo Bodeguero */}
      {isBodeguero && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-300/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5 text-body-sm font-bold">
            <span className="material-symbols-outlined text-amber-600 text-xl shrink-0">warehouse</span>
            <span>
              <strong>Modo Bodeguero Activo:</strong> Vista operativa de almacén y piso. Los costos unitarios, precios de venta y márgenes están ocultos.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('lotes')}
              className="h-9 px-4 rounded-full bg-primary hover:opacity-95 text-on-primary text-body-sm font-headline-md shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">layers</span>
              <span>Lotes FEFO</span>
            </button>
            <button
              onClick={() => setActiveTab('ordenes')}
              className="h-9 px-4 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-body-sm font-headline-md shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">local_shipping</span>
              <span>Recepción &amp; OC</span>
            </button>
          </div>
        </div>
      )}

      {/* Banner de Alerta Sanitaria FEFO Urgente */}
      {alertasFefoCount > 0 && !bannerFefoDismissed && (
        <div className="mb-6 p-4 bg-error-container border border-error/20 rounded-2xl flex items-center justify-between gap-3 text-on-error-container shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-body-sm font-bold min-w-0">
            <span className="material-symbols-outlined text-error text-xl shrink-0 animate-pulse">warning</span>
            <span className="truncate sm:whitespace-normal">
              ¡Alerta FEFO Sanitaria Urgente! Existen <strong>{alertasFefoCount} lotes</strong> con caducidad crítica (próximos 15 días). Priorizar rotación y despacho en piso de venta.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('lotes')}
              className="h-9 px-4 bg-error hover:opacity-95 text-on-error rounded-full text-body-sm font-headline-md transition-all shrink-0 shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-base">notification_important</span>
              <span>Ver Lotes en Riesgo</span>
            </button>
            <button
              onClick={() => setBannerFefoDismissed(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-error-container/70 hover:text-on-error-container hover:bg-error/10 transition-colors cursor-pointer"
              title="Cerrar alerta"
              aria-label="Cerrar alerta"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Principal Neo-Retail */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-on-surface-variant font-headline-md text-body-sm">Quantix OS</span>
            <span className="text-outline-variant font-body-sm">/</span>
            <span className="text-on-surface font-headline-md text-body-sm">Control de Inventario &amp; Almacén</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full font-label-caps text-label-caps uppercase ${
              isBodeguero ? 'bg-amber-100 text-amber-900' : 'bg-primary-fixed text-on-primary-fixed'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              {isBodeguero ? 'Modo Bodeguero' : 'Almacén Central'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-caps text-[11px] bg-surface-container-high text-on-surface-variant font-medium">
              <span className="material-symbols-outlined text-xs text-primary">store</span>
              {sucursalActual?.nombre || 'Matriz Centro'}
            </span>
            {loading && <span className="material-symbols-outlined text-base animate-spin text-primary ml-1">progress_activity</span>}
          </div>
          <h1 className="font-headline-md text-headline-md md:text-headline-xl text-on-surface tracking-tight">
            Control de Inventario
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Catálogo maestro de SKUs, trazabilidad sanitaria FEFO, sugerencias de reorden y recepción de mercancía
          </p>
        </div>

        {/* Acciones Rápidas Header */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportarCSV}
            className="h-11 px-4 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface transition-all font-headline-md text-body-sm flex items-center gap-2 shadow-xs cursor-pointer"
            title="Exportar datos a CSV / Excel"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => handleAbrirCrearOrden()}
            className="h-11 px-5 rounded-full bg-primary hover:opacity-95 text-on-primary transition-all font-headline-md text-body-sm flex items-center gap-2 shadow-xs cursor-pointer active:scale-98"
          >
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
            <span>Nueva Orden</span>
          </button>

          <button
            onClick={() => handleAbrirIngresoLote()}
            className="h-11 px-5 rounded-full bg-secondary-container hover:opacity-95 text-on-secondary-container transition-all font-headline-md text-body-sm flex items-center gap-2 shadow-xs cursor-pointer active:scale-98"
          >
            <span className="material-symbols-outlined text-lg">layers</span>
            <span>Ingreso Mercancía</span>
          </button>

          {!isBodeguero && (
            <button
              onClick={handleAbrirCrearProducto}
              className="h-11 px-5 rounded-full bg-primary-container text-on-primary-container hover:opacity-90 transition-all font-headline-md text-body-sm flex items-center gap-2 shadow-xs cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-lg">add_box</span>
              <span>Nuevo SKU</span>
            </button>
          )}

          <button
            onClick={() => setModalTransferenciaOpen(true)}
            className="h-11 px-5 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-all font-headline-md text-body-sm flex items-center gap-2 shadow-xs cursor-pointer active:scale-98"
            title="Solicitar Traspaso entre Sucursales"
          >
            <span className="material-symbols-outlined text-lg">sync_alt</span>
            <span>Traspaso</span>
          </button>
        </div>
      </div>

      {/* Sub-tab header con pills rounded-full */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-outline-variant/15 no-scrollbar shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('catalogo')}
          className={`px-5 py-2 rounded-full font-headline-md text-body-md transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'catalogo'
              ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">grid_view</span>
          <span>Catálogo Maestro</span>
          <span className={`px-2 py-0.5 rounded-full text-body-sm font-label-numeric-md ${
            activeTab === 'catalogo' ? 'bg-surface-container-lowest/20 text-inverse-on-surface' : 'bg-surface-container-high text-on-surface-variant'
          }`}>
            {productos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lotes')}
          className={`px-5 py-2 rounded-full font-headline-md text-body-md transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'lotes'
              ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">layers</span>
          <span>Lotes &amp; FEFO</span>
          <span className={`px-2 py-0.5 rounded-full text-body-sm font-label-numeric-md ${
            activeTab === 'lotes' ? 'bg-surface-container-lowest/20 text-inverse-on-surface' : 'bg-surface-container-high text-on-surface-variant'
          }`}>
            {lotes.length}
          </span>
          {alertasFefoCount > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ordenes')}
          className={`px-5 py-2 rounded-full font-headline-md text-body-md transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'ordenes'
              ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">local_shipping</span>
          <span>Recepción &amp; OC</span>
          <span className={`px-2 py-0.5 rounded-full text-body-sm font-label-numeric-md ${
            activeTab === 'ordenes' ? 'bg-surface-container-lowest/20 text-inverse-on-surface' : 'bg-surface-container-high text-on-surface-variant'
          }`}>
            {ordenesCompra.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reorden')}
          className={`px-5 py-2 rounded-full font-headline-md text-body-md transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'reorden'
              ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">auto_graph</span>
          <span>Reorden &amp; Proveedores</span>
          {sugerenciasReorden.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-label-caps font-label-caps bg-error-container text-on-error-container uppercase">
              {sugerenciasReorden.length} ROP
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movimientos')}
          className={`px-5 py-2 rounded-full font-headline-md text-body-md transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'movimientos'
              ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">swap_horiz</span>
          <span>Movimientos</span>
          <span className={`px-2 py-0.5 rounded-full text-body-sm font-label-numeric-md ${
            activeTab === 'movimientos' ? 'bg-surface-container-lowest/20 text-inverse-on-surface' : 'bg-surface-container-high text-on-surface-variant'
          }`}>
            {movimientosKardex.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categorias')}
          className={`px-5 py-2 rounded-full font-headline-md text-body-md transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'categorias'
              ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">sell</span>
          <span>Categorías</span>
          <span className={`px-2 py-0.5 rounded-full text-body-sm font-label-numeric-md ${
            activeTab === 'categorias' ? 'bg-surface-container-lowest/20 text-inverse-on-surface' : 'bg-surface-container-high text-on-surface-variant'
          }`}>
            {categorias.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('traspasos')}
          className={`px-5 py-2 rounded-full font-headline-md text-body-md transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'traspasos'
              ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">sync_alt</span>
          <span>Traspasos</span>
          <span className={`px-2 py-0.5 rounded-full text-body-sm font-label-numeric-md ${
            activeTab === 'traspasos' ? 'bg-surface-container-lowest/20 text-inverse-on-surface' : 'bg-surface-container-high text-on-surface-variant'
          }`}>
            {transferencias.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. PESTAÑA: CATÁLOGO MAESTRO */}
      {/* ========================================================================= */}
      {activeTab === 'catalogo' && (
        <div className="space-y-6">
          {/* Top Section: Motor Predictivo de Reorden Banner & Cards */}
          {sugerenciasReorden.length > 0 && (
            <section className="mb-2">
              <div className="relative overflow-hidden rounded-3xl bg-surface-container-low shadow-xs p-6 border border-outline-variant/20">
                <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-primary-container/10 blur-3xl pointer-events-none"></div>
                <div className="absolute right-1/3 -bottom-16 w-64 h-64 rounded-full bg-secondary-container/10 blur-2xl pointer-events-none"></div>

                {/* Main Banner Header */}
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 shadow-xs">
                      <span className="material-symbols-outlined text-2xl">auto_graph</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-headline-md text-title-lg md:text-headline-md text-on-surface">
                          Motor Predictivo de Reorden
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-caps text-label-caps uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                          {sugerenciasReorden.length} ROP Excedidos
                        </span>
                      </div>
                      <p className="font-body-md text-body-sm md:text-body-md text-on-surface-variant mt-1">
                        {sugerenciasReorden.length} productos han cruzado el Punto de Reorden (ROP). Se sugiere emisión de órdenes de compra para evitar rotura de stock.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMostrarBannerSugerencias(!mostrarBannerSugerencias)}
                      className="h-11 px-4 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-headline-md text-body-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {mostrarBannerSugerencias ? 'expand_less' : 'expand_more'}
                      </span>
                      <span>{mostrarBannerSugerencias ? 'Ocultar Tarjetas' : 'Ver Sugerencias'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAbrirCrearOrden()}
                      className="h-11 px-6 rounded-full bg-primary text-on-primary font-headline-md text-body-md flex items-center gap-2 hover:opacity-95 active:scale-98 transition-all shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xl">add_shopping_cart</span>
                      <span>Generar Orden Sugerida</span>
                    </button>
                  </div>
                </div>

                {/* 3 Reorder Cards Grid */}
                {mostrarBannerSugerencias && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 pt-2">
                    {sugerenciasReorden.slice(0, 3).map((sug) => {
                      const stockPct = Math.min(Math.round((sug.stock_actual / (sug.punto_reorden || 1)) * 100), 100);
                      const esQuiebreInminente = sug.stock_actual <= 0 || stockPct <= 35;
                      const prod = productos.find(p => p.id === sug.producto_id);

                      return (
                        <div key={sug.producto_id} className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border border-outline-variant/20">
                          <div>
                            <div className="flex items-start gap-3">
                              <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center shrink-0 overflow-hidden">
                                {prod?.imagen ? (
                                  <img src={prod.imagen} alt={sug.nombre} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="material-symbols-outlined text-2xl text-on-surface-variant">inventory_2</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{sug.sku}</span>
                                  {esQuiebreInminente ? (
                                    <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-caps text-label-caps uppercase whitespace-nowrap">
                                      Quiebre Inminente
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary font-label-caps text-label-caps uppercase whitespace-nowrap">
                                      Alta Rotación
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-headline-md text-title-md text-on-surface truncate mt-0.5" title={sug.nombre}>
                                  {sug.nombre}
                                </h4>
                                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                                  {sug.proveedor_sugerido_nombre || 'Proveedor Sugerido'} • Clase {sug.clasificacion_abc || 'A'}
                                </p>
                              </div>
                            </div>

                            <div className="my-4 p-3 rounded-xl bg-surface-container-low flex flex-col gap-2">
                              <div className="flex items-center justify-between font-body-sm text-body-sm">
                                <span className="text-on-surface-variant">Stock Actual / Mínimo</span>
                                <span className={`font-label-numeric-md text-body-md ${esQuiebreInminente ? 'text-error font-bold' : 'text-on-surface'}`}>
                                  {sug.stock_actual} <span className="text-on-surface-variant font-body-sm">/ {sug.punto_reorden} uds</span>
                                </span>
                              </div>
                              <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${esQuiebreInminente ? 'bg-error' : 'bg-primary'}`} 
                                  style={{ width: `${Math.max(stockPct, 5)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-body-sm pt-1">
                                <span className="text-on-surface-variant font-body-sm">Sugerencia IA:</span>
                                <span className="font-label-numeric-md text-title-md text-primary font-bold">+{sug.sugerido_compra} uds</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAbrirCrearOrden(sug.producto_id)}
                            className="w-full h-11 rounded-full bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all font-headline-md text-body-md text-on-surface flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                          >
                            <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                            <span>Añadir a OC</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Toolbar / Search / Filter Matrix */}
          <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-xs border border-outline-variant/20 flex flex-col gap-4">
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
              {/* Universal Search Input */}
              <div className="relative flex-1 max-w-2xl">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl pointer-events-none">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Escanear código de barras o buscar por SKU, Nombre, Marca..."
                  className="w-full h-12 pl-12 pr-32 rounded-full bg-surface-container-low text-on-surface font-body-md placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container transition-all"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface font-label-caps text-label-caps">
                    SCANNER ON
                  </span>
                </div>
              </div>

              {/* Botones de acción del catálogo */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleAbrirIngresoLote()}
                  className="h-12 px-5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-headline-md text-body-md flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-xl">layers</span>
                  <span>Ingreso de Lote</span>
                </button>
                {!isBodeguero && (
                  <button
                    type="button"
                    onClick={handleAbrirCrearProducto}
                    className="h-12 px-6 rounded-full bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity font-headline-md text-body-md flex items-center gap-2 shadow-xs cursor-pointer active:scale-98"
                  >
                    <span className="material-symbols-outlined text-xl">add_box</span>
                    <span>Nuevo Producto SKU</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Matrix: Categories, ABC Class, Stock Critical Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-outline-variant/15">
              {/* Categories Pill Group */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-3xl">
                <button
                  type="button"
                  onClick={() => setCategoriaFiltro('')}
                  className={`px-4 py-2 rounded-full font-headline-md text-body-sm transition-all whitespace-nowrap cursor-pointer ${
                    !categoriaFiltro 
                      ? 'bg-inverse-surface text-inverse-on-surface shadow-xs' 
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  Todas ({productos.length})
                </button>
                {categorias.map(c => {
                  const count = productos.filter(p => p.categoria_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoriaFiltro(c.id)}
                      className={`px-4 py-2 rounded-full font-headline-md text-body-sm transition-all whitespace-nowrap cursor-pointer ${
                        categoriaFiltro === c.id 
                          ? 'bg-inverse-surface text-inverse-on-surface shadow-xs' 
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {c.nombre} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Secondary ABC + Critical Toggle Controls */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* ABC Filters Pills */}
                <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-full">
                  <button
                    type="button"
                    onClick={() => setFiltroABC('')}
                    className={`px-3 py-1 rounded-full font-headline-md text-label-caps transition-all cursor-pointer ${
                      !filtroABC ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    TODAS ABC
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroABC('A')}
                    className={`px-3 py-1 rounded-full font-headline-md text-label-caps flex items-center gap-1 transition-all cursor-pointer ${
                      filtroABC === 'A' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-primary"></span>CLASE A
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroABC('B')}
                    className={`px-3 py-1 rounded-full font-headline-md text-label-caps flex items-center gap-1 transition-all cursor-pointer ${
                      filtroABC === 'B' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>CLASE B
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroABC('C')}
                    className={`px-3 py-1 rounded-full font-headline-md text-label-caps flex items-center gap-1 transition-all cursor-pointer ${
                      filtroABC === 'C' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-outline"></span>CLASE C
                  </button>
                </div>

                {/* Critical Stock Switch */}
                <label className="flex items-center gap-2 cursor-pointer bg-surface-container-low px-3.5 py-1.5 rounded-full select-none">
                  <input
                    type="checkbox"
                    checked={soloStockCritico}
                    onChange={(e) => setSoloStockCritico(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-outline-variant peer-checked:bg-error rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-surface-container-lowest after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                  <span className="font-headline-md text-body-sm text-on-surface">Solo Stock Crítico</span>
                </label>

                {/* Mostrar Inactivos */}
                <label className="flex items-center gap-2 cursor-pointer bg-surface-container-low px-3.5 py-1.5 rounded-full select-none">
                  <input
                    type="checkbox"
                    checked={mostrarInactivos}
                    onChange={(e) => setMostrarInactivos(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-outline-variant peer-checked:bg-primary rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-surface-container-lowest after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                  <span className="font-headline-md text-body-sm text-on-surface">Inactivos</span>
                </label>
              </div>
            </div>
          </div>

          {/* Master Catalog Table Container */}
          <div className="bg-surface-container-lowest rounded-3xl shadow-xs border border-outline-variant/20 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-caps text-label-caps uppercase select-none">
                    <th className="py-4 pl-6 pr-3">SKU &amp; Barras</th>
                    <th className="py-4 px-3">Producto &amp; Marca</th>
                    <th className="py-4 px-3">Categoría</th>
                    <th className="py-4 px-3">Clasif. ABC</th>
                    {!isBodeguero && <th className="py-4 px-3">Costo / Venta</th>}
                    {!isBodeguero && <th className="py-4 px-3">Margen Bruto</th>}
                    <th className="py-4 px-3">Stock Consolidado</th>
                    <th className="py-4 px-3">Trazabilidad FEFO</th>
                    <th className="py-4 px-3">Estado</th>
                    <th className="py-4 pr-6 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 text-on-surface font-body-md">
                  {productosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={isBodeguero ? 7 : 10} className="py-16 text-center text-on-surface-variant font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-on-surface-variant">inventory_2</span>
                          <span className="font-headline-md text-title-md text-on-surface">No se encontraron productos</span>
                          <span className="font-body-sm text-on-surface-variant">Modifica los filtros de búsqueda o registra un nuevo SKU</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    productosFiltrados.map((item) => {
                      const margenPct = item.precio_venta > 0 
                        ? (((item.precio_venta - item.costo_base) / item.precio_venta) * 100).toFixed(1)
                        : '0.0';
                      const stockEsCero = item.stock_total <= 0;

                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => handleVerDetalleProducto(item)}
                          className={`hover:bg-surface-container-low/50 transition-colors group cursor-pointer ${
                            !item.activo ? 'opacity-60 bg-surface-container-low/20' : ''
                          }`}
                        >
                          {/* SKU & Barras con thumbnail */}
                          <td className="py-4 pl-6 pr-3 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                                {item.imagen ? (
                                  <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="material-symbols-outlined text-xl text-on-surface-variant">package_2</span>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-headline-md text-body-md text-on-surface">{item.sku}</span>
                                <span className="font-label-caps text-body-sm text-on-surface-variant">
                                  {item.codigo_barras || 'SIN BARRAS'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Producto & Marca */}
                          <td className="py-4 px-3">
                            <div className="flex flex-col min-w-[180px]">
                              <span className="font-headline-md text-title-md text-on-surface leading-tight">
                                {item.nombre}
                              </span>
                              <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                                {item.categoria_nombre || 'General'} • {item.requiere_pesaje ? 'Pesable Báscula' : 'Empacado'}
                              </span>
                            </div>
                          </td>

                          {/* Categoría */}
                          <td className="py-4 px-3 whitespace-nowrap">
                            <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface font-headline-md text-body-sm">
                              {item.categoria_nombre || 'General'}
                            </span>
                          </td>

                          {/* Clasif. ABC con stock dot */}
                          <td className="py-4 px-3 whitespace-nowrap">
                            {item.clasificacion_abc === 'A' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-headline-md text-body-sm">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>Clase A
                              </span>
                            ) : item.clasificacion_abc === 'B' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-headline-md text-body-sm">
                                <span className="w-2 h-2 rounded-full bg-secondary"></span>Clase B
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-headline-md text-body-sm">
                                <span className="w-2 h-2 rounded-full bg-outline"></span>Clase C
                              </span>
                            )}
                          </td>

                          {/* Costo / Venta */}
                          {!isBodeguero && (
                            <td className="py-4 px-3 whitespace-nowrap">
                              <div className="flex flex-col font-label-numeric-md">
                                <span className="text-on-surface text-body-md font-bold">
                                  ${Number(item.costo_base).toFixed(2)} <span className="text-body-sm font-normal text-on-surface-variant">Costo</span>
                                </span>
                                <span className="text-primary text-body-md font-bold">
                                  ${Number(item.precio_venta).toFixed(2)} <span className="text-body-sm font-normal text-on-surface-variant">PVP</span>
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Margen Bruto */}
                          {!isBodeguero && (
                            <td className="py-4 px-3 whitespace-nowrap">
                              <div className="flex flex-col gap-1 w-28">
                                <span className="font-label-numeric-md text-body-md text-primary font-bold">
                                  {margenPct}%
                                </span>
                                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-primary h-full rounded-full" 
                                    style={{ width: `${Math.min(Math.max(parseFloat(margenPct), 5), 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Stock Consolidado */}
                          <td className="py-4 px-3 whitespace-nowrap">
                            {stockEsCero ? (
                              <div className="flex items-center gap-1.5 text-error font-bold">
                                <span className="font-label-numeric-md text-title-md">0 {item.requiere_pesaje ? 'kg' : 'uds'}</span>
                                <span className="material-symbols-outlined text-sm text-error">warning</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                <span className="font-label-numeric-md text-title-md text-on-surface">
                                  {item.stock_total} <span className="text-body-sm text-on-surface-variant">{item.requiere_pesaje ? 'kg' : 'uds'}</span>
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Trazabilidad FEFO */}
                          <td className="py-4 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface font-headline-md text-body-sm">
                              <span className="material-symbols-outlined text-base text-primary">verified</span>
                              <span>{item.lotes_activos_count} {item.lotes_activos_count === 1 ? 'Lote FEFO' : 'Lotes FEFO'}</span>
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="py-4 px-3 whitespace-nowrap">
                            {item.activo ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-caps text-label-caps uppercase">
                                Activo POS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-caps text-label-caps uppercase">
                                Baja Lógica
                              </span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="py-4 pr-6 pl-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleVerDetalleProducto(item)}
                                className="w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                                title="Ver Ficha y Lotes"
                              >
                                <span className="material-symbols-outlined text-lg">visibility</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAbrirIngresoLote(item.id)}
                                className="w-8 h-8 rounded-full hover:bg-primary-fixed hover:text-on-primary-fixed text-primary flex items-center justify-center transition-colors cursor-pointer"
                                title="Ingresar Lote Directo"
                              >
                                <span className="material-symbols-outlined text-lg">add_box</span>
                              </button>
                              {!isBodeguero && (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirEditarProducto(item)}
                                  className="w-8 h-8 rounded-full hover:bg-secondary-fixed hover:text-on-secondary-fixed text-secondary flex items-center justify-center transition-colors cursor-pointer"
                                  title="Editar SKU"
                                >
                                  <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                              )}
                              {isSupervisorOrDirector && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleActivoProducto(item)}
                                  className="w-8 h-8 rounded-full hover:bg-error-container text-error flex items-center justify-center transition-colors cursor-pointer"
                                  title={item.activo ? "Dar de baja lógica" : "Reactivar producto"}
                                >
                                  <span className="material-symbols-outlined text-lg">
                                    {item.activo ? 'delete' : 'restore_from_trash'}
                                  </span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Telemetría */}
            <div className="px-6 py-4 bg-surface-container-low/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-outline-variant/15">
              <div className="flex items-center gap-4 text-body-sm text-on-surface-variant">
                <span className="font-headline-md text-body-sm text-on-surface">
                  Mostrando {productosFiltrados.length} de {productos.length} SKUs activos
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-primary font-body-sm">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  Catálogo Sincronizado POS Local
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface-variant flex items-center justify-center shadow-xs opacity-40 cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <div className="flex items-center gap-1 font-label-numeric-md text-body-sm">
                  <span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold shadow-xs">
                    1
                  </span>
                </div>
                <button
                  type="button"
                  disabled
                  className="w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface-variant flex items-center justify-center shadow-xs opacity-40 cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PESTAÑA: LOTES & FEFO */}
      {/* ========================================================================= */}
      {activeTab === 'lotes' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-3xl shadow-xs border border-outline-variant/20 overflow-hidden flex-1 flex flex-col">
            <div className="p-5 border-b border-outline-variant/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low/40">
              <div>
                <h3 className="font-headline-md text-title-lg text-on-surface">
                  Lotes Físicos &amp; Trazabilidad Sanitaria FEFO
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Despacho prioritario First-Expired, First-Out con semáforo de riesgo por fecha de caducidad
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAbrirIngresoLote()}
                className="h-11 px-5 bg-primary text-on-primary rounded-full font-headline-md text-body-sm hover:opacity-95 shadow-xs flex items-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <span className="material-symbols-outlined text-lg">add_box</span>
                <span>Registrar Ingreso Directo</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-caps text-label-caps uppercase select-none">
                    <th className="py-4 pl-6 pr-3">Código Lote</th>
                    <th className="py-4 px-3">Producto &amp; SKU</th>
                    <th className="py-4 px-3 text-center">Disponible</th>
                    <th className="py-4 px-3 text-center">Inicial</th>
                    {!isBodeguero && <th className="py-4 px-3 text-right">Costo Unitario</th>}
                    <th className="py-4 px-3 text-center">Fecha Caducidad</th>
                    <th className="py-4 px-3 text-center">Semáforo FEFO</th>
                    <th className="py-4 px-3 text-center">Estado</th>
                    <th className="py-4 pr-6 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 text-on-surface font-body-md">
                  {lotes.length === 0 ? (
                    <tr>
                      <td colSpan={isBodeguero ? 8 : 9} className="py-16 text-center text-on-surface-variant font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-on-surface-variant">layers_clear</span>
                          <span className="font-headline-md text-title-md text-on-surface">No hay lotes registrados</span>
                          <span className="font-body-sm text-on-surface-variant">Utiliza "Registrar Ingreso Directo" o recibe una orden de compra para nutrir el stock</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    lotes.map((lote) => {
                      const sem = getSemaforoFefo(lote.fecha_vencimiento);
                      return (
                        <tr 
                          key={lote.id} 
                          onClick={() => handleVerDetalleLote(lote)}
                          className="hover:bg-surface-container-low/50 transition-colors cursor-pointer group"
                        >
                          <td className="py-4 pl-6 pr-3 font-mono font-bold text-body-md text-on-surface">
                            {lote.codigo_lote}
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex flex-col min-w-[180px]">
                              <span className="font-headline-md text-title-md text-on-surface leading-tight">
                                {lote.producto_nombre}
                              </span>
                              <span className="font-label-caps text-body-sm text-on-surface-variant mt-0.5">
                                {lote.producto_sku}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <span className="font-label-numeric-md text-title-md text-on-surface bg-surface-container-high px-3 py-1 rounded-full">
                              {lote.cantidad_disponible} uds
                            </span>
                          </td>
                          <td className="py-4 px-3 text-center font-label-numeric-md text-body-sm text-on-surface-variant">
                            {lote.cantidad_inicial || '-'}
                          </td>
                          {!isBodeguero && (
                            <td className="py-4 px-3 text-right font-label-numeric-md font-bold text-on-surface">
                              ${Number(lote.costo_unitario || 0).toFixed(2)}
                            </td>
                          )}
                          <td className="py-4 px-3 text-center font-mono text-body-sm text-on-surface">
                            {lote.fecha_vencimiento || 'Sin caducidad'}
                          </td>
                          {/* Semáforo FEFO */}
                          <td className="py-4 px-3 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-caps font-headline-md uppercase border ${sem.color}`}>
                              <span className={`w-2 h-2 rounded-full ${sem.dotColor}`}></span>
                              {sem.texto}
                            </span>
                          </td>
                          {/* Estado */}
                          <td className="py-4 px-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-label-caps font-label-caps uppercase ${
                              lote.estado === 'ACTIVO' ? 'bg-primary/10 text-primary' :
                              lote.estado === 'MERMA' ? 'bg-amber-100 text-amber-900' :
                              lote.estado === 'CADUCADO' ? 'bg-error-container text-on-error-container' : 'bg-surface-container-highest text-on-surface-variant'
                            }`}>
                              {lote.estado}
                            </span>
                          </td>
                          {/* Acciones */}
                          <td className="py-4 pr-6 pl-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleVerDetalleLote(lote)}
                                className="w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                                title="Ver Ficha de Lote"
                              >
                                <span className="material-symbols-outlined text-lg">visibility</span>
                              </button>
                              {lote.estado === 'ACTIVO' && lote.cantidad_disponible > 0 && isSupervisorOrDirector && (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirBajaLote(lote)}
                                  className="h-8 px-3 rounded-full bg-error-container hover:bg-error text-on-error-container hover:text-on-error transition-all font-headline-md text-label-caps flex items-center gap-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
                                  <span>Baja Merma</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PESTAÑA: RECEPCIÓN & ÓRDENES DE COMPRA */}
      {/* ========================================================================= */}
      {activeTab === 'ordenes' && (
        <div className="space-y-6">
          {/* Toolbar de Órdenes */}
          <div className="bg-surface-container-lowest p-5 rounded-3xl shadow-xs border border-outline-variant/20 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[300px]">
              <select
                value={filtroEstadoOrden}
                onChange={(e) => setFiltroEstadoOrden(e.target.value)}
                className="h-11 px-4 bg-surface-container-low text-on-surface rounded-full text-body-md font-headline-md focus:bg-surface-container focus:outline-none transition-all cursor-pointer"
              >
                <option value="">Todos los estados</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="RECIBIDA">RECIBIDA</option>
                <option value="CANCELADA">CANCELADA</option>
              </select>

              <select
                value={filtroProveedorOrden}
                onChange={(e) => setFiltroProveedorOrden(e.target.value)}
                className="h-11 px-4 bg-surface-container-low text-on-surface rounded-full text-body-md font-headline-md focus:bg-surface-container focus:outline-none transition-all cursor-pointer"
              >
                <option value="">Todos los proveedores</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleAbrirCrearOrden()}
                className="h-11 px-6 bg-primary text-on-primary rounded-full font-headline-md text-body-md hover:opacity-95 shadow-xs flex items-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
                <span>Nueva Orden de Compra</span>
              </button>
            </div>
          </div>

          {/* Tabla de Órdenes de Compra */}
          <div className="bg-surface-container-lowest rounded-3xl shadow-xs border border-outline-variant/20 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-caps text-label-caps uppercase select-none">
                    <th className="py-4 pl-6 pr-3">Folio / Emisión</th>
                    <th className="py-4 px-3">Proveedor</th>
                    <th className="py-4 px-3 text-center">Líneas Solicitadas</th>
                    {!isBodeguero && <th className="py-4 px-3 text-right">Total Estimado</th>}
                    <th className="py-4 px-3 text-center">Estado</th>
                    <th className="py-4 px-3 text-center">Fecha Recepción</th>
                    <th className="py-4 pr-6 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 text-on-surface font-body-md">
                  {ordenesCompra.length === 0 ? (
                    <tr>
                      <td colSpan={isBodeguero ? 6 : 7} className="py-16 text-center text-on-surface-variant font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-on-surface-variant">local_shipping</span>
                          <span className="font-headline-md text-title-md text-on-surface">No hay órdenes de compra registradas</span>
                          <span className="font-body-sm text-on-surface-variant">Genera una nueva orden de aprovisionamiento formal para tus proveedores</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ordenesCompra.map((orden) => (
                      <tr
                        key={orden.id}
                        onClick={() => handleVerDetalleOrden(orden)}
                        className="hover:bg-surface-container-low/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 pl-6 pr-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-headline-md text-body-md text-on-surface">#{orden.id.slice(0, 8)}</span>
                            <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                              {new Date(orden.fecha_emision).toLocaleDateString()}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-3">
                          <div className="flex flex-col min-w-[180px]">
                            <span className="font-headline-md text-title-md text-on-surface">
                              {orden.proveedor_nombre || 'Proveedor'}
                            </span>
                            {orden.notas && (
                              <span className="font-body-sm text-body-sm text-on-surface-variant truncate max-w-xs mt-0.5">
                                {orden.notas}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-3 text-center">
                          <span className="font-label-numeric-md text-body-md text-on-surface bg-surface-container-high px-3 py-1 rounded-full">
                            {orden.detalles?.length || 0} {orden.detalles?.length === 1 ? 'línea' : 'líneas'}
                          </span>
                        </td>

                        {!isBodeguero && (
                          <td className="py-4 px-3 text-right font-label-numeric-md font-bold text-title-md text-on-surface">
                            ${Number(orden.total_estimado || 0).toFixed(2)}
                          </td>
                        )}

                        <td className="py-4 px-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-label-caps font-label-caps uppercase ${
                            orden.estado === 'RECIBIDA' 
                              ? 'bg-primary/10 text-primary' 
                              : orden.estado === 'RECIBIDA_PARCIAL'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                              : orden.estado === 'PENDIENTE'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : 'bg-surface-container-highest text-on-surface-variant'
                          }`}>
                            {orden.estado === 'RECIBIDA_PARCIAL' ? 'PARCIAL' : orden.estado}
                          </span>
                        </td>

                        <td className="py-4 px-3 text-center font-mono text-body-sm text-on-surface-variant">
                          {orden.fecha_recepcion ? new Date(orden.fecha_recepcion).toLocaleDateString() : 'Pendiente'}
                        </td>

                        <td className="py-4 pr-6 pl-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleVerDetalleOrden(orden)}
                              className="w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                              title="Ver Detalle de Orden"
                            >
                              <span className="material-symbols-outlined text-lg">visibility</span>
                            </button>

                            {(orden.estado === 'PENDIENTE' || orden.estado === 'RECIBIDA_PARCIAL') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAbrirRecibirOrden(orden)}
                                  className="h-8 px-3 rounded-full bg-primary text-on-primary hover:opacity-95 font-headline-md text-label-caps flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="Recibir Mercancía"
                                >
                                  <span className="material-symbols-outlined text-base">verified</span>
                                  <span>{orden.estado === 'RECIBIDA_PARCIAL' ? 'Completar' : 'Recibir'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCancelarOrden(orden.id)}
                                  className="w-8 h-8 rounded-full hover:bg-error-container text-error flex items-center justify-center transition-colors cursor-pointer"
                                  title="Cancelar Orden"
                                >
                                  <span className="material-symbols-outlined text-lg">cancel</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PESTAÑA: REORDEN & PROVEEDORES */}
      {/* ========================================================================= */}
      {activeTab === 'reorden' && (
        <div className="space-y-6">
          {/* Tarjetas de Sugerencias de Reorden */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-xs border border-outline-variant/20 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-xl">auto_graph</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-title-lg text-on-surface">
                    Sugerencias Predictivas de Reorden ({sugerenciasReorden.length})
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Puntos de reorden calculados por velocidad diaria de venta y factor de seguridad ABC
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAbrirCrearOrden()}
                className="h-10 px-5 rounded-full bg-primary text-on-primary font-headline-md text-body-sm hover:opacity-95 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                <span>Nueva Orden</span>
              </button>
            </div>

            {sugerenciasReorden.length === 0 ? (
              <div className="p-8 bg-surface-container-low rounded-2xl text-center font-body-md text-on-surface-variant border border-outline-variant/15">
                ✅ Todos los productos mantienen existencias por encima de su umbral de reorden.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {sugerenciasReorden.map((sug) => {
                  const stockPct = Math.min(Math.round((sug.stock_actual / (sug.punto_reorden || 1)) * 100), 100);
                  const esQuiebreInminente = sug.stock_actual <= 0 || stockPct <= 35;
                  const prod = productos.find(p => p.id === sug.producto_id);

                  return (
                    <div key={sug.producto_id} className="group bg-surface-container-low/40 rounded-2xl p-5 border border-outline-variant/20 flex flex-col justify-between hover:shadow-md transition-all">
                      <div>
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0 overflow-hidden">
                            {prod?.imagen ? (
                              <img src={prod.imagen} alt={sug.nombre} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-xl text-on-surface-variant">package_2</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{sug.sku}</span>
                              {esQuiebreInminente ? (
                                <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-caps text-label-caps uppercase whitespace-nowrap">
                                  Quiebre Inminente
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary font-label-caps text-label-caps uppercase whitespace-nowrap">
                                  Clase {sug.clasificacion_abc || 'A'}
                                </span>
                              )}
                            </div>
                            <h4 className="font-headline-md text-title-md text-on-surface truncate mt-0.5" title={sug.nombre}>
                              {sug.nombre}
                            </h4>
                            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                              {sug.proveedor_sugerido_nombre || 'Proveedor Sugerido'}
                            </p>
                          </div>
                        </div>

                        <div className="my-4 p-3 rounded-xl bg-surface-container-lowest flex flex-col gap-2">
                          <div className="flex items-center justify-between font-body-sm text-body-sm">
                            <span className="text-on-surface-variant">Stock Actual / Mínimo</span>
                            <span className={`font-label-numeric-md text-body-md ${esQuiebreInminente ? 'text-error font-bold' : 'text-on-surface'}`}>
                              {sug.stock_actual} <span className="text-on-surface-variant font-body-sm">/ {sug.punto_reorden} uds</span>
                            </span>
                          </div>
                          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${esQuiebreInminente ? 'bg-error' : 'bg-primary'}`} 
                              style={{ width: `${Math.max(stockPct, 5)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-body-sm pt-1">
                            <span className="text-on-surface-variant font-body-sm">Sugerencia IA:</span>
                            <span className="font-label-numeric-md text-title-md text-primary font-bold">+{sug.sugerido_compra} uds</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAbrirCrearOrden(sug.producto_id)}
                        className="w-full h-10 rounded-full bg-primary text-on-primary hover:opacity-95 transition-all font-headline-md text-body-sm flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                      >
                        <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                        <span>Ordenar Ahora</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Directorio Oficial de Proveedores */}
          <div className="bg-surface-container-lowest rounded-3xl shadow-xs border border-outline-variant/20 overflow-hidden flex-1 flex flex-col">
            <div className="p-5 border-b border-outline-variant/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low/40">
              <div>
                <h3 className="font-headline-md text-title-lg text-on-surface">
                  Directorio Oficial de Proveedores
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Catálogo de distribuidores con tiempos de entrega de reorden (Lead Time)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAbrirCrearProveedor}
                className="h-10 px-5 rounded-full bg-primary-container text-on-primary-container font-headline-md text-body-sm hover:opacity-90 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Nuevo Proveedor</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-caps text-label-caps uppercase select-none">
                    <th className="py-4 pl-6 pr-3">Razón Social</th>
                    <th className="py-4 px-3">Contacto</th>
                    <th className="py-4 px-3">Teléfono</th>
                    <th className="py-4 px-3">Email</th>
                    <th className="py-4 px-3 text-center">Lead Time</th>
                    <th className="py-4 px-3 text-center">Estado</th>
                    <th className="py-4 pr-6 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 text-on-surface font-body-md">
                  {proveedores.map((prov) => (
                    <tr 
                      key={prov.id} 
                      onClick={() => handleVerDetalleProveedor(prov)}
                      className="hover:bg-surface-container-low/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 pl-6 pr-3 font-headline-md text-title-md text-on-surface">
                        {prov.nombre}
                      </td>
                      <td className="py-4 px-3 text-on-surface-variant font-body-md">
                        {prov.contacto_nombre || '-'}
                      </td>
                      <td className="py-4 px-3 font-mono text-body-sm text-on-surface">
                        {prov.telefono || '-'}
                      </td>
                      <td className="py-4 px-3 font-mono text-body-sm text-secondary">
                        {prov.email || '-'}
                      </td>
                      <td className="py-4 px-3 text-center">
                        <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-headline-md text-body-sm">
                          {prov.lead_time_dias} días
                        </span>
                      </td>
                      <td className="py-4 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-label-caps font-label-caps uppercase ${
                          prov.activo ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          {prov.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-4 pr-6 pl-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleVerDetalleProveedor(prov)}
                            className="w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                            title="Ver Ficha Proveedor"
                          >
                            <span className="material-symbols-outlined text-lg">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PESTAÑA: MOVIMIENTOS & KÁRDEX */}
      {/* ========================================================================= */}
      {activeTab === 'movimientos' && (
        <div className="space-y-6">
          {/* Toolbar de Movimientos */}
          <div className="bg-surface-container-lowest p-5 rounded-3xl shadow-xs border border-outline-variant/20 flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl pointer-events-none">search</span>
              <input
                type="text"
                value={searchMovimiento}
                onChange={(e) => setSearchMovimiento(e.target.value)}
                placeholder="Buscar por lote, producto o SKU..."
                className="w-full h-11 pl-12 pr-4 rounded-full bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltroTipoMovimiento('')}
                className={`px-4 py-2 rounded-full font-headline-md text-body-sm transition-all cursor-pointer ${
                  !filtroTipoMovimiento ? 'bg-inverse-surface text-inverse-on-surface shadow-xs' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipoMovimiento('INGRESO_DIRECTO')}
                className={`px-4 py-2 rounded-full font-headline-md text-body-sm transition-all cursor-pointer ${
                  filtroTipoMovimiento === 'INGRESO_DIRECTO' ? 'bg-inverse-surface text-inverse-on-surface shadow-xs' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                Ingresos
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipoMovimiento('RECEPCION_OC')}
                className={`px-4 py-2 rounded-full font-headline-md text-body-sm transition-all cursor-pointer ${
                  filtroTipoMovimiento === 'RECEPCION_OC' ? 'bg-inverse-surface text-inverse-on-surface shadow-xs' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                Recepciones OC
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipoMovimiento('BAJA_MERMA')}
                className={`px-4 py-2 rounded-full font-headline-md text-body-sm transition-all cursor-pointer ${
                  filtroTipoMovimiento === 'BAJA_MERMA' ? 'bg-inverse-surface text-inverse-on-surface shadow-xs' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                Bajas / Merma
              </button>
            </div>
          </div>

          {/* Tabla Kárdex de Movimientos */}
          <div className="bg-surface-container-lowest rounded-3xl shadow-xs border border-outline-variant/20 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-caps text-label-caps uppercase select-none">
                    <th className="py-4 pl-6 pr-3">Fecha &amp; Hora</th>
                    <th className="py-4 px-3">Tipo Movimiento</th>
                    <th className="py-4 px-3">Producto &amp; SKU</th>
                    <th className="py-4 px-3">Lote / Referencia</th>
                    <th className="py-4 px-3 text-center">Variación Stock</th>
                    <th className="py-4 px-3">Origen / Destino</th>
                    <th className="py-4 pr-6 pl-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 text-on-surface font-body-md">
                  {movimientosKardex.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-on-surface-variant font-medium">
                        No hay movimientos registrados con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    movimientosKardex.map((mov) => {
                      const esPositivo = mov.cantidad > 0;
                      return (
                        <tr key={mov.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-4 pl-6 pr-3 font-mono text-body-sm text-on-surface-variant whitespace-nowrap">
                            {new Date(mov.fecha).toLocaleString()}
                          </td>
                          <td className="py-4 px-3 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-label-caps font-headline-md uppercase ${
                              mov.tipo === 'INGRESO_DIRECTO' ? 'bg-secondary-fixed text-on-secondary-fixed' :
                              mov.tipo === 'RECEPCION_OC' ? 'bg-primary-fixed text-on-primary-fixed' :
                              'bg-error-container text-on-error-container'
                            }`}>
                              {mov.tipoEtiqueta}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex flex-col">
                              <span className="font-headline-md text-title-md text-on-surface">{mov.producto_nombre}</span>
                              <span className="font-label-caps text-body-sm text-on-surface-variant">{mov.producto_sku}</span>
                            </div>
                          </td>
                          <td className="py-4 px-3 font-mono font-bold text-body-sm text-on-surface">
                            {mov.codigo_lote}
                          </td>
                          <td className="py-4 px-3 text-center">
                            <span className={`font-label-numeric-md text-title-md font-bold ${
                              esPositivo ? 'text-primary' : 'text-error'
                            }`}>
                              {esPositivo ? `+${mov.cantidad}` : mov.cantidad} uds
                            </span>
                          </td>
                          <td className="py-4 px-3 text-on-surface-variant font-body-sm">
                            {mov.origen}
                          </td>
                          <td className="py-4 pr-6 pl-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-caps text-label-caps uppercase">
                              {mov.estado}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PESTAÑA: CATEGORÍAS */}
      {/* ========================================================================= */}
      {activeTab === 'categorias' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-3xl shadow-xs border border-outline-variant/20 overflow-hidden flex-1 flex flex-col">
            <div className="p-5 border-b border-outline-variant/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low/40">
              <div>
                <h3 className="font-headline-md text-title-lg text-on-surface">
                  Familias y Categorías de Catálogo
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Organización taxonómica para agrupación de productos y reportes de rentabilidad
                </p>
              </div>
              <button
                type="button"
                onClick={handleAbrirCrearCategoria}
                className="h-10 px-5 rounded-full bg-primary-container text-on-primary-container font-headline-md text-body-sm hover:opacity-90 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Nueva Categoría</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-caps text-label-caps uppercase select-none">
                    <th className="py-4 pl-6 pr-3">Nombre</th>
                    <th className="py-4 px-3">Descripción</th>
                    <th className="py-4 px-3 text-center">Productos Vinculados</th>
                    <th className="py-4 px-3 text-center">Estado</th>
                    <th className="py-4 pr-6 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 text-on-surface font-body-md">
                  {categorias.map((cat) => {
                    const count = productos.filter(p => p.categoria_id === cat.id).length;
                    return (
                      <tr 
                        key={cat.id} 
                        onClick={() => handleVerDetalleCategoria(cat)}
                        className="hover:bg-surface-container-low/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 pl-6 pr-3 font-headline-md text-title-md text-on-surface">
                          {cat.nombre}
                        </td>
                        <td className="py-4 px-3 text-on-surface-variant font-body-md">
                          {cat.descripcion || '-'}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span className="px-3 py-1 rounded-full bg-surface-container font-label-numeric-md text-body-sm text-on-surface">
                            {count} productos
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-label-caps font-label-caps uppercase ${
                            cat.activo ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
                          }`}>
                            {cat.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="py-4 pr-6 pl-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleVerDetalleCategoria(cat)}
                            className="w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                            title="Ver Ficha Categoría"
                          >
                            <span className="material-symbols-outlined text-lg">visibility</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. PESTAÑA: TRASPASOS INTER-SUCURSAL */}
      {/* ========================================================================= */}
      {activeTab === 'traspasos' && (
        <div className="space-y-6">
          {/* Toolbar de Traspasos */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-surface-container-lowest p-4 rounded-3xl border border-outline-variant/20 shadow-xs">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Buscar por folio, sucursal o producto..."
                  value={searchTransferencia}
                  onChange={(e) => setSearchTransferencia(e.target.value)}
                  className="w-full pl-10 pr-4 h-11 bg-surface-container-low rounded-full text-body-md font-headline-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container transition-colors"
                />
              </div>

              <select
                value={filtroEstadoTransferencia}
                onChange={(e) => setFiltroEstadoTransferencia(e.target.value)}
                className="h-11 px-4 bg-surface-container-low rounded-full text-body-sm font-headline-md text-on-surface focus:outline-none focus:bg-surface-container transition-colors cursor-pointer"
              >
                <option value="">Todos los Estados</option>
                <option value="SOLICITADA">Solicitadas</option>
                <option value="EN_TRANSITO">En Tránsito</option>
                <option value="RECIBIDA">Recibidas</option>
                <option value="CANCELADA">Canceladas</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setModalTransferenciaOpen(true)}
              className="h-11 px-6 rounded-full bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary transition-all font-headline-md text-body-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span>Solicitar Traspaso</span>
            </button>
          </div>

          {/* Tabla de Traspasos */}
          <div className="bg-surface-container-lowest rounded-3xl shadow-xs border border-outline-variant/20 overflow-hidden flex-1 flex flex-col">
            <div className="p-5 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/40">
              <div>
                <h3 className="font-headline-md text-title-lg text-on-surface">
                  Transferencias Logísticas Inter-Sucursal
                </h3>
                <p className="font-body-md text-body-sm text-on-surface-variant">
                  Control de despachos y recepciones con trazabilidad FEFO entre sucursales
                </p>
              </div>
              <span className="font-label-numeric-md text-body-sm text-on-surface-variant font-bold">
                {transferenciasFiltradas.length} traspasos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/15 bg-surface-container-low/70 text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
                    <th className="py-3 px-6">Folio</th>
                    <th className="py-3 px-6">Ruta de Custodia</th>
                    <th className="py-3 px-6">Fecha / Solicitante</th>
                    <th className="py-3 px-6 text-center">Artículos</th>
                    <th className="py-3 px-6 text-center">Estado</th>
                    <th className="py-3 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-body-md">
                  {transferenciasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-outline">sync_alt</span>
                          <span className="font-title-md">No se encontraron traspasos inter-sucursal</span>
                          <span className="text-body-sm text-outline">Usa el botón "Solicitar Traspaso" para reabastecer mercancía</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transferenciasFiltradas.map((t) => {
                      const totalCant = (t.detalles || []).reduce((acc, d) => acc + Number(d.cantidad), 0);
                      return (
                        <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-3.5 px-6">
                            <button
                              type="button"
                              onClick={() => setDetalleTransferencia(t)}
                              className="font-mono font-bold text-primary text-body-sm hover:underline text-left cursor-pointer"
                            >
                              {t.folio}
                            </button>
                            {t.notas && (
                              <span className="text-xs text-on-surface-variant truncate block max-w-xs">
                                {t.notas}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6">
                            <div className="flex items-center gap-2 text-body-sm font-title-md">
                              <span className="font-semibold text-on-surface">
                                {t.sucursal_origen_nombre || 'Matriz'}
                              </span>
                              <span className="material-symbols-outlined text-sm text-primary">arrow_forward</span>
                              <span className="font-semibold text-on-surface">
                                {t.sucursal_destino_nombre || 'Destino'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-6">
                            <div className="text-body-sm text-on-surface font-title-md">
                              {formatDate(t.fecha_solicitud)}
                            </div>
                            <span className="text-xs text-on-surface-variant">
                              Por: {t.usuario_solicita_nombre || 'Operador'}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high font-label-numeric-md text-xs font-bold text-on-surface">
                              {t.detalles?.length || 0} SKUs • {totalCant} uds
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <span className={`px-3 py-1 rounded-full font-label-caps text-xs font-bold uppercase tracking-wider ${
                              t.estado === 'SOLICITADA'
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                                : t.estado === 'EN_TRANSITO'
                                ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
                                : t.estado === 'RECIBIDA'
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                                : 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300'
                            }`}>
                              {t.estado.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setDetalleTransferencia(t)}
                                className="h-8 px-3 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-xs transition-colors cursor-pointer"
                              >
                                Ver Detalle
                              </button>

                              {t.estado === 'SOLICITADA' && (isSupervisorOrDirector || isBodeguero) && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm(`¿Despachar mercancía para traspaso ${t.folio}?`)) return;
                                    try {
                                      await api.post(`/transferencias/${t.id}/despachar`);
                                      mostrarToast({
                                        titulo: 'Traspaso Despachado',
                                        mensaje: `${t.folio} ahora está en tránsito`,
                                        severidad: 'SUCCESS',
                                      });
                                      void cargarTransferencias();
                                      void cargarDatos();
                                    } catch (err: any) {
                                      mostrarToast({
                                        titulo: 'Error al Despachar',
                                        mensaje: err.response?.data?.detail || 'No se pudo despachar',
                                        severidad: 'CRITICO',
                                      });
                                    }
                                  }}
                                  className="h-8 px-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-headline-md text-xs transition-colors cursor-pointer"
                                >
                                  Despachar
                                </button>
                              )}

                              {t.estado === 'EN_TRANSITO' && (isSupervisorOrDirector || isBodeguero) && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm(`¿Confirmar recepción de mercancía para ${t.folio}?`)) return;
                                    try {
                                      await api.post(`/transferencias/${t.id}/recibir`);
                                      mostrarToast({
                                        titulo: 'Traspaso Recibido',
                                        mensaje: `${t.folio} recibido e inventariado`,
                                        severidad: 'SUCCESS',
                                      });
                                      void cargarTransferencias();
                                      void cargarDatos();
                                    } catch (err: any) {
                                      mostrarToast({
                                        titulo: 'Error al Recibir',
                                        mensaje: err.response?.data?.detail || 'No se pudo recibir',
                                        severidad: 'CRITICO',
                                      });
                                    }
                                  }}
                                  className="h-8 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-headline-md text-xs transition-colors cursor-pointer"
                                >
                                  Recibir
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE DETALLE UNIFICADO (FICHA TÉCNICA) */}
      {/* ========================================================================= */}
      {detalleItem && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-2xl w-full border border-outline-variant/30 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header Detalle */}
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/40 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-2xl">
                    {detalleItem.tipo === 'producto' && 'package_2'}
                    {detalleItem.tipo === 'lote' && 'layers'}
                    {detalleItem.tipo === 'proveedor' && 'local_shipping'}
                    {detalleItem.tipo === 'categoria' && 'sell'}
                    {detalleItem.tipo === 'orden' && 'shopping_bag'}
                  </span>
                </div>
                <div>
                  <span className="text-label-caps font-label-caps uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    Ficha de {detalleItem.tipo.toUpperCase()}
                  </span>
                  <h3 className="font-headline-md text-title-lg text-on-surface mt-0.5">
                    {detalleItem.tipo === 'producto' && detalleItem.data.nombre}
                    {detalleItem.tipo === 'lote' && `Lote: ${detalleItem.data.codigo_lote}`}
                    {detalleItem.tipo === 'proveedor' && detalleItem.data.nombre}
                    {detalleItem.tipo === 'categoria' && detalleItem.data.nombre}
                    {detalleItem.tipo === 'orden' && `Orden #${detalleItem.data.id.slice(0, 8)}`}
                  </h3>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setDetalleItem(null)} 
                className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-body-md">
              {/* DETALLE: ORDEN DE COMPRA */}
              {detalleItem.tipo === 'orden' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">Estado</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-label-caps font-label-caps uppercase ${
                        detalleItem.data.estado === 'RECIBIDA' ? 'bg-primary/10 text-primary' :
                        detalleItem.data.estado === 'RECIBIDA_PARCIAL' ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold' :
                        detalleItem.data.estado === 'PENDIENTE' ? 'bg-blue-100 text-blue-900' : 'bg-surface-container-highest text-on-surface-variant'
                      }`}>
                        {detalleItem.data.estado === 'RECIBIDA_PARCIAL' ? 'PARCIAL' : detalleItem.data.estado}
                      </span>
                    </div>

                    <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">Proveedor</span>
                      <span className="font-headline-md text-title-md text-on-surface truncate block">
                        {detalleItem.data.proveedor_nombre || 'N/A'}
                      </span>
                    </div>

                    {!isBodeguero && (
                      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20">
                        <span className="font-label-caps text-label-caps text-primary uppercase block mb-1">Total Estimado</span>
                        <span className="font-label-numeric-lg text-title-lg text-primary font-bold">
                          ${Number(detalleItem.data.total_estimado || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-headline-md text-title-md text-on-surface">Líneas y Cumplimiento</h4>
                    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden">
                      <table className="w-full text-left text-body-sm">
                        <thead className="bg-surface-container-low font-label-caps text-label-caps text-on-surface-variant uppercase">
                          <tr>
                            <th className="py-3 px-4">Producto</th>
                            <th className="py-3 px-4 text-center">Solicitado</th>
                            <th className="py-3 px-4 text-center">Recibido</th>
                            <th className="py-3 px-4 text-center">Pendiente</th>
                            {!isBodeguero && <th className="py-3 px-4 text-right">Costo Pactado</th>}
                            {!isBodeguero && <th className="py-3 px-4 text-right">Subtotal</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                          {(detalleItem.data.detalles || []).map((det: any, i: number) => {
                            const yaRecibido = Number(det.cantidad_recibida || 0);
                            const pendiente = det.cantidad_pendiente !== undefined 
                              ? Number(det.cantidad_pendiente) 
                              : Math.max(0, Number(det.cantidad_solicitada || 0) - yaRecibido);
                            return (
                              <tr key={i}>
                                <td className="py-3 px-4">
                                  <span className="font-headline-md text-on-surface block">{det.producto_nombre || 'Producto'}</span>
                                  <span className="font-label-caps text-on-surface-variant">{det.producto_sku}</span>
                                </td>
                                <td className="py-3 px-4 text-center font-label-numeric-md text-on-surface">
                                  {det.cantidad_solicitada} uds
                                </td>
                                <td className="py-3 px-4 text-center font-label-numeric-md font-bold text-primary">
                                  {yaRecibido} uds
                                </td>
                                <td className="py-3 px-4 text-center font-label-numeric-md font-bold text-amber-700">
                                  {pendiente} uds
                                </td>
                                {!isBodeguero && (
                                  <td className="py-3 px-4 text-right font-label-numeric-md text-on-surface-variant">
                                    ${Number(det.costo_unitario_pactado).toFixed(2)}
                                  </td>
                                )}
                                {!isBodeguero && (
                                  <td className="py-3 px-4 text-right font-label-numeric-md font-bold text-on-surface">
                                    ${Number(det.subtotal || 0).toFixed(2)}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* DETALLE: PRODUCTO */}
              {detalleItem.tipo === 'producto' && (
                <div className="space-y-4">
                  <div className={`grid ${isBodeguero ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20">
                      <span className="font-label-caps text-label-caps text-primary uppercase block mb-1">Stock Disponible</span>
                      <div className="font-label-numeric-lg text-headline-md text-primary font-bold">
                        {detalleItem.data.stock_total} <span className="text-body-sm font-normal text-on-surface-variant">{detalleItem.data.requiere_pesaje ? 'kg' : 'uds'}</span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant mt-1 block">
                        {detalleItem.data.lotes_activos_count} {detalleItem.data.lotes_activos_count === 1 ? 'lote activo' : 'lotes activos'}
                      </span>
                    </div>

                    {!isBodeguero && (
                      <div className="bg-secondary/5 p-4 rounded-2xl border border-secondary/20">
                        <span className="font-label-caps text-label-caps text-secondary uppercase block mb-1">Precio de Venta</span>
                        <div className="font-label-numeric-lg text-headline-md text-secondary font-bold">
                          ${Number(detalleItem.data.precio_venta).toFixed(2)}
                        </div>
                        <span className="font-body-sm text-body-sm text-on-surface-variant mt-1 block">
                          Costo: ${Number(detalleItem.data.costo_base).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {!isBodeguero && (
                      <div className="bg-tertiary/5 p-4 rounded-2xl border border-tertiary/20">
                        <span className="font-label-caps text-label-caps text-tertiary uppercase block mb-1">Margen Comercial</span>
                        <div className="font-label-numeric-lg text-headline-md text-tertiary font-bold">
                          {Number(detalleItem.data.precio_venta) > 0 
                            ? (((Number(detalleItem.data.precio_venta) - Number(detalleItem.data.costo_base)) / Number(detalleItem.data.precio_venta)) * 100).toFixed(1)
                            : 0}%
                        </div>
                        <span className="font-body-sm text-body-sm text-on-surface-variant mt-1 block">
                          Ganancia: +${(Number(detalleItem.data.precio_venta) - Number(detalleItem.data.costo_base)).toFixed(2)}/ud
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 text-body-sm grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-0.5">Familia / Categoría</span>
                      <span className="font-headline-md text-title-md text-on-surface">{detalleItem.data.categoria_nombre || 'Sin clasificar'}</span>
                    </div>
                    <div>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-0.5">Clasificación ABC</span>
                      <span className="font-headline-md text-title-md text-on-surface">
                        Rotación Tipo {detalleItem.data.clasificacion_abc || 'A'}
                      </span>
                    </div>
                  </div>

                  {/* Tabla de Lotes FEFO del Producto */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-headline-md text-title-md text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">verified</span>
                        <span>Trazabilidad de Lotes Físicos (FEFO)</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleAbrirIngresoLote(detalleItem.data.id)}
                        className="h-8 px-3 rounded-full bg-primary-container text-on-primary-container font-headline-md text-body-sm flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">add</span>
                        <span>Ingresar Lote</span>
                      </button>
                    </div>

                    {detalleItem.loadingLotes ? (
                      <div className="p-8 text-center text-on-surface-variant flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-xl animate-spin text-primary">progress_activity</span>
                        <span className="text-body-sm font-semibold">Cargando lotes...</span>
                      </div>
                    ) : !detalleItem.lotesProducto || detalleItem.lotesProducto.length === 0 ? (
                      <div className="p-6 bg-surface-container-low rounded-2xl text-center text-on-surface-variant text-body-sm border border-outline-variant/15">
                        Este producto no tiene lotes activos.
                      </div>
                    ) : (
                      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-xs">
                        <table className="w-full text-left text-body-sm">
                          <thead>
                            <tr className="bg-surface-container-low font-label-caps text-label-caps text-on-surface-variant uppercase">
                              <th className="py-3 px-3">Lote</th>
                              <th className="py-3 px-3 text-center">Disponible</th>
                              {!isBodeguero && <th className="py-3 px-3 text-right">Costo</th>}
                              <th className="py-3 px-3 text-center">Vencimiento</th>
                              <th className="py-3 px-3 text-center">Semáforo FEFO</th>
                              <th className="py-3 px-3 text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/10">
                            {detalleItem.lotesProducto.map((lot) => {
                              const sem = getSemaforoFefo(lot.fecha_vencimiento);
                              return (
                                <tr key={lot.id} className="hover:bg-surface-container-low/40">
                                  <td className="py-2.5 px-3 font-mono font-bold text-on-surface">{lot.codigo_lote}</td>
                                  <td className="py-2.5 px-3 text-center font-label-numeric-md font-bold text-on-surface">{lot.cantidad_disponible} uds</td>
                                  {!isBodeguero && (
                                    <td className="py-2.5 px-3 text-right font-label-numeric-md text-on-surface-variant">${Number(lot.costo_unitario || 0).toFixed(2)}</td>
                                  )}
                                  <td className="py-2.5 px-3 text-center font-mono text-on-surface-variant">{lot.fecha_vencimiento || '-'}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`px-2.5 py-0.5 rounded-full text-label-caps font-headline-md uppercase border ${sem.color}`}>
                                      {sem.texto}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface text-label-caps font-label-caps uppercase">
                                      {lot.estado}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DETALLE: LOTE */}
              {detalleItem.tipo === 'lote' && (
                <div className="space-y-4">
                  <div className={`grid ${isBodeguero ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20">
                      <span className="font-label-caps text-label-caps text-primary uppercase block mb-1">Stock Remanente</span>
                      <div className="font-label-numeric-lg text-headline-md text-primary font-bold">
                        {detalleItem.data.cantidad_disponible} <span className="text-body-sm font-normal text-on-surface-variant">uds</span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant mt-1 block">
                        Inicial recibido: {detalleItem.data.cantidad_inicial || detalleItem.data.cantidad_disponible} uds
                      </span>
                    </div>

                    {!isBodeguero && (
                      <div className="bg-secondary/5 p-4 rounded-2xl border border-secondary/20">
                        <span className="font-label-caps text-label-caps text-secondary uppercase block mb-1">Valoración en Almacén</span>
                        <div className="font-label-numeric-lg text-headline-md text-secondary font-bold">
                          ${(Number(detalleItem.data.costo_unitario || 0) * Number(detalleItem.data.cantidad_disponible)).toFixed(2)}
                        </div>
                        <span className="font-body-sm text-body-sm text-on-surface-variant mt-1 block">
                          Costo unitario: ${Number(detalleItem.data.costo_unitario || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 text-body-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Artículo:</span>
                      <span className="font-headline-md text-on-surface">{detalleItem.data.producto_nombre} ({detalleItem.data.producto_sku})</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Caducidad Sanitaria:</span>
                      <span className="font-mono font-bold text-on-surface">{detalleItem.data.fecha_vencimiento || 'Sin caducidad'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Semáforo FEFO:</span>
                      <span className={`px-3 py-1 rounded-full text-label-caps font-headline-md uppercase border ${getSemaforoFefo(detalleItem.data.fecha_vencimiento).color}`}>
                        {getSemaforoFefo(detalleItem.data.fecha_vencimiento).texto}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DETALLE: PROVEEDOR */}
              {detalleItem.tipo === 'proveedor' && (
                <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/20 text-body-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Razón Social:</span>
                    <span className="font-headline-md text-title-md text-on-surface">{detalleItem.data.nombre}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Contacto:</span>
                    <span className="font-body-md text-on-surface">{detalleItem.data.contacto_nombre || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Lead Time (Entrega):</span>
                    <span className="px-3 py-1 bg-secondary-fixed text-on-secondary-fixed rounded-full font-headline-md text-body-sm">
                      {detalleItem.data.lead_time_dias} días naturales
                    </span>
                  </div>
                </div>
              )}

              {/* DETALLE: CATEGORÍA */}
              {detalleItem.tipo === 'categoria' && (
                <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/20 text-body-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Nombre:</span>
                    <span className="font-headline-md text-title-md text-on-surface">{detalleItem.data.nombre}</span>
                  </div>
                  <div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">Descripción:</span>
                    <p className="text-on-surface bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/20 text-body-sm">
                      {detalleItem.data.descripcion || 'Sin descripción.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Detalle */}
            <div className="p-6 border-t border-outline-variant/20 bg-surface-container-low/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {detalleItem.tipo === 'orden' && (detalleItem.data.estado === 'PENDIENTE' || detalleItem.data.estado === 'RECIBIDA_PARCIAL') && (
                  <button
                    type="button"
                    onClick={() => {
                      const ord = detalleItem.data;
                      setDetalleItem(null);
                      handleAbrirRecibirOrden(ord);
                    }}
                    className="h-11 px-6 rounded-full bg-primary text-on-primary hover:opacity-95 font-headline-md text-body-md flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">verified</span>
                    <span>{detalleItem.data.estado === 'RECIBIDA_PARCIAL' ? 'Continuar Recepción' : 'Recibir Mercancía'}</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetalleItem(null)}
                className="h-11 px-6 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PRODUCTO (CREAR / EDITAR) */}
      {/* ========================================================================= */}
      {modalProducto.open && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full border border-outline-variant/30 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/40">
              <h3 className="font-headline-md text-title-lg text-on-surface">
                {modalProducto.editando ? 'Editar Producto SKU' : 'Nuevo Producto SKU'}
              </h3>
              <button 
                type="button"
                onClick={() => setModalProducto({ open: false })} 
                className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarProducto} className="p-6 space-y-4 overflow-y-auto" noValidate>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">SKU *</label>
                  <input
                    type="text"
                    value={formProd.sku}
                    onChange={(e) => {
                      setFormProd({ ...formProd, sku: e.target.value });
                      if (errorsProd.sku) setErrorsProd((prev) => ({ ...prev, sku: null }));
                    }}
                    placeholder="Ej. BEB-COCA-001"
                    className={`w-full h-11 px-4 rounded-full font-mono text-body-md text-on-surface focus:outline-none transition-all ${
                      errorsProd.sku
                        ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                        : 'bg-surface-container-low focus:bg-surface-container'
                    }`}
                  />
                  {errorsProd.sku && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsProd.sku}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Categoría *</label>
                  <select
                    value={formProd.categoria_id}
                    onChange={(e) => {
                      setFormProd({ ...formProd, categoria_id: e.target.value });
                      if (errorsProd.categoria_id) setErrorsProd((prev) => ({ ...prev, categoria_id: null }));
                    }}
                    className={`w-full h-11 px-4 rounded-full font-body-md text-on-surface focus:outline-none cursor-pointer transition-all ${
                      errorsProd.categoria_id
                        ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                        : 'bg-surface-container-low focus:bg-surface-container'
                    }`}
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  {errorsProd.categoria_id && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsProd.categoria_id}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Nombre del Producto *</label>
                <input
                  type="text"
                  value={formProd.nombre}
                  onChange={(e) => {
                    setFormProd({ ...formProd, nombre: e.target.value });
                    if (errorsProd.nombre) setErrorsProd((prev) => ({ ...prev, nombre: null }));
                  }}
                  placeholder="Ej. Bebida Gaseosa 500ml"
                  className={`w-full h-11 px-4 rounded-full font-headline-md text-body-md text-on-surface focus:outline-none transition-all ${
                    errorsProd.nombre
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                      : 'bg-surface-container-low focus:bg-surface-container'
                  }`}
                />
                {errorsProd.nombre && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsProd.nombre}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Código de Barras (EAN-13)</label>
                  <input
                    type="text"
                    value={formProd.codigo_barras}
                    onChange={(e) => {
                      setFormProd({ ...formProd, codigo_barras: e.target.value });
                      if (errorsProd.codigo_barras) setErrorsProd((prev) => ({ ...prev, codigo_barras: null }));
                    }}
                    placeholder="Ej. 7861000100014"
                    className={`w-full h-11 px-4 rounded-full font-mono text-body-md text-on-surface focus:outline-none transition-all ${
                      errorsProd.codigo_barras
                        ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                        : 'bg-surface-container-low focus:bg-surface-container'
                    }`}
                  />
                  {errorsProd.codigo_barras && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsProd.codigo_barras}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Clasificación ABC</label>
                  <select
                    value={formProd.clasificacion_abc}
                    onChange={(e) => setFormProd({ ...formProd, clasificacion_abc: e.target.value })}
                    className="w-full h-11 px-4 rounded-full bg-surface-container-low text-on-surface font-headline-md text-body-md focus:bg-surface-container focus:outline-none cursor-pointer"
                  >
                    <option value="A">A (Alta rotación / valor)</option>
                    <option value="B">B (Media rotación)</option>
                    <option value="C">C (Baja rotación)</option>
                  </select>
                </div>
              </div>

              {!isBodeguero && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Costo Base ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formProd.costo_base}
                        onChange={(e) => {
                          setFormProd({ ...formProd, costo_base: e.target.value });
                          if (errorsProd.costo_base) setErrorsProd((prev) => ({ ...prev, costo_base: null }));
                          if (errorsProd.precio_venta) setErrorsProd((prev) => ({ ...prev, precio_venta: null }));
                        }}
                        className={`w-full h-11 px-4 rounded-full text-on-surface font-label-numeric-md text-body-md text-right focus:outline-none transition-all ${
                          errorsProd.costo_base
                            ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                            : 'bg-surface-container-low focus:bg-surface-container'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Precio Venta ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formProd.precio_venta}
                        onChange={(e) => {
                          setFormProd({ ...formProd, precio_venta: e.target.value });
                          if (errorsProd.precio_venta) setErrorsProd((prev) => ({ ...prev, precio_venta: null }));
                        }}
                        className={`w-full h-11 px-4 rounded-full text-on-surface font-label-numeric-md text-body-md text-right focus:outline-none transition-all ${
                          errorsProd.precio_venta
                            ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                            : 'bg-surface-container-low focus:bg-surface-container'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Margen Mín %</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formProd.margen_minimo_pct}
                        onChange={(e) => {
                          setFormProd({ ...formProd, margen_minimo_pct: e.target.value });
                          if (errorsProd.margen_minimo_pct) setErrorsProd((prev) => ({ ...prev, margen_minimo_pct: null }));
                        }}
                        className={`w-full h-11 px-4 rounded-full text-on-surface font-label-numeric-md text-body-md text-right focus:outline-none transition-all ${
                          errorsProd.margen_minimo_pct
                            ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                            : 'bg-surface-container-low focus:bg-surface-container'
                        }`}
                      />
                    </div>
                  </div>
                  {errorsProd.costo_base && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsProd.costo_base}</span>
                    </div>
                  )}
                  {errorsProd.precio_venta && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsProd.precio_venta}</span>
                    </div>
                  )}
                  {errorsProd.margen_minimo_pct && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsProd.margen_minimo_pct}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="requiere_pesaje"
                  checked={formProd.requiere_pesaje}
                  onChange={(e) => setFormProd({ ...formProd, requiere_pesaje: e.target.checked })}
                  className="rounded-md text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="requiere_pesaje" className="font-body-md text-body-md text-on-surface cursor-pointer">
                  Requiere pesaje en báscula (producto a granel)
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setModalProducto({ open: false })}
                  className="h-11 px-6 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-6 rounded-full bg-primary text-on-primary hover:opacity-95 active:scale-98 font-headline-md text-body-md transition-all shadow-xs cursor-pointer"
                >
                  {modalProducto.editando ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL INGRESO DIRECTO DE LOTE */}
      {/* ========================================================================= */}
      {modalIngresoLote && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full border border-outline-variant/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/40">
              <h3 className="font-headline-md text-title-lg text-on-surface">Registrar Ingreso de Lote</h3>
              <button 
                type="button"
                onClick={() => setModalIngresoLote(false)} 
                className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarIngresoLote} className="p-6 space-y-4" noValidate>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Artículo / Producto *</label>
                <select
                  value={formLote.producto_id}
                  onChange={(e) => {
                    setFormLote({ ...formLote, producto_id: e.target.value });
                    if (errorsLote.producto_id) setErrorsLote((prev) => ({ ...prev, producto_id: null }));
                  }}
                  className={`w-full h-11 px-4 rounded-full text-on-surface font-body-md focus:outline-none cursor-pointer transition-all ${
                    errorsLote.producto_id
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                      : 'bg-surface-container-low focus:bg-surface-container'
                  }`}
                >
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} • {p.nombre}</option>
                  ))}
                </select>
                {errorsLote.producto_id && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsLote.producto_id}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Código de Lote Sanitario *</label>
                <input
                  type="text"
                  value={formLote.codigo_lote}
                  onChange={(e) => {
                    setFormLote({ ...formLote, codigo_lote: e.target.value });
                    if (errorsLote.codigo_lote) setErrorsLote((prev) => ({ ...prev, codigo_lote: null }));
                  }}
                  className={`w-full h-11 px-4 rounded-full text-on-surface font-mono text-body-md focus:outline-none transition-all ${
                    errorsLote.codigo_lote
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                      : 'bg-surface-container-low focus:bg-surface-container'
                  }`}
                />
                {errorsLote.codigo_lote && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsLote.codigo_lote}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Cantidad *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={formLote.cantidad}
                    onChange={(e) => {
                      setFormLote({ ...formLote, cantidad: e.target.value });
                      if (errorsLote.cantidad) setErrorsLote((prev) => ({ ...prev, cantidad: null }));
                    }}
                    className={`w-full h-11 px-4 rounded-full text-on-surface font-label-numeric-md text-body-md text-center focus:outline-none transition-all ${
                      errorsLote.cantidad
                        ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                        : 'bg-surface-container-low focus:bg-surface-container'
                    }`}
                  />
                  {errorsLote.cantidad && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsLote.cantidad}</span>
                    </div>
                  )}
                </div>
                {!isBodeguero && (
                  <div>
                    <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Costo Unitario ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formLote.costo_unitario}
                      onChange={(e) => {
                        setFormLote({ ...formLote, costo_unitario: e.target.value });
                        if (errorsLote.costo_unitario) setErrorsLote((prev) => ({ ...prev, costo_unitario: null }));
                      }}
                      className={`w-full h-11 px-4 rounded-full text-on-surface font-label-numeric-md text-body-md text-right focus:outline-none transition-all ${
                        errorsLote.costo_unitario
                          ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                          : 'bg-surface-container-low focus:bg-surface-container'
                      }`}
                    />
                    {errorsLote.costo_unitario && (
                      <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                        <span className="material-symbols-outlined text-[15px]">error</span>
                        <span>{errorsLote.costo_unitario}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Fecha de Caducidad Sanitaria (FEFO) *</label>
                <input
                  type="date"
                  value={formLote.fecha_vencimiento}
                  onChange={(e) => {
                    setFormLote({ ...formLote, fecha_vencimiento: e.target.value });
                    if (errorsLote.fecha_vencimiento) setErrorsLote((prev) => ({ ...prev, fecha_vencimiento: null }));
                  }}
                  className={`w-full h-11 px-4 rounded-full text-on-surface font-body-md focus:outline-none transition-all ${
                    errorsLote.fecha_vencimiento
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                      : 'bg-surface-container-low focus:bg-surface-container'
                  }`}
                />
                {errorsLote.fecha_vencimiento && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsLote.fecha_vencimiento}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setModalIngresoLote(false)}
                  className="h-11 px-6 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-6 rounded-full bg-primary text-on-primary hover:opacity-95 active:scale-98 font-headline-md text-body-md transition-all shadow-xs cursor-pointer"
                >
                  Registrar Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL BAJA LÓGICA DE LOTE */}
      {/* ========================================================================= */}
      {modalBajaLote.open && modalBajaLote.lote && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full border border-outline-variant/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/40">
              <h3 className="font-headline-md text-title-lg text-on-surface">Baja de Inventario / Merma</h3>
              <button 
                type="button"
                onClick={() => setModalBajaLote({ open: false })} 
                className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmarBajaLote} className="p-6 space-y-4" noValidate>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Motivo de Baja *</label>
                <select
                  value={formBaja.motivo}
                  onChange={(e) => setFormBaja({ ...formBaja, motivo: e.target.value })}
                  className="w-full h-11 px-4 rounded-full bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container focus:outline-none cursor-pointer"
                >
                  <option value="MERMA">Merma / Desperdicio / Deterioro</option>
                  <option value="CADUCADO">Caducidad Expirada (Sanitaria)</option>
                  <option value="DANADO">Empaque Roto / Dañado en Traslado</option>
                  <option value="CUARENTENA">Aislamiento por Cuarentena</option>
                </select>
              </div>

              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">
                  Cantidad a dar de baja (Disponible: {modalBajaLote.lote.cantidad_disponible}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={modalBajaLote.lote.cantidad_disponible}
                  value={formBaja.cantidad_baja}
                  onChange={(e) => {
                    setFormBaja({ ...formBaja, cantidad_baja: e.target.value });
                    if (errorsBaja.cantidad_baja) setErrorsBaja((prev) => ({ ...prev, cantidad_baja: null }));
                  }}
                  className={`w-full h-11 px-4 rounded-full font-label-numeric-md text-body-md text-center focus:outline-none transition-all ${
                    errorsBaja.cantidad_baja
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20 text-on-surface'
                      : 'bg-surface-container-low text-on-surface focus:bg-surface-container'
                  }`}
                />
                {errorsBaja.cantidad_baja && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsBaja.cantidad_baja}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Notas / Justificación</label>
                <textarea
                  rows={2}
                  value={formBaja.notas}
                  onChange={(e) => setFormBaja({ ...formBaja, notas: e.target.value })}
                  className="w-full p-3 rounded-2xl bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setModalBajaLote({ open: false })}
                  className="h-11 px-6 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-6 rounded-full bg-error text-on-error hover:opacity-95 active:scale-98 font-headline-md text-body-md transition-all shadow-xs cursor-pointer"
                >
                  Confirmar Baja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PROVEEDOR */}
      {/* ========================================================================= */}
      {modalProveedor.open && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full border border-outline-variant/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/40">
              <h3 className="font-headline-md text-title-lg text-on-surface">
                {modalProveedor.editando ? 'Editar Proveedor' : 'Registrar Proveedor'}
              </h3>
              <button 
                type="button"
                onClick={() => setModalProveedor({ open: false })} 
                className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarProveedor} className="p-6 space-y-4" noValidate>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Razón Social *</label>
                <input
                  type="text"
                  value={formProv.nombre}
                  onChange={(e) => {
                    setFormProv({ ...formProv, nombre: e.target.value });
                    if (errorsProv.nombre) setErrorsProv((prev) => ({ ...prev, nombre: null }));
                  }}
                  className={`w-full h-11 px-4 rounded-full font-headline-md text-body-md text-on-surface focus:outline-none transition-all ${
                    errorsProv.nombre
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                      : 'bg-surface-container-low focus:bg-surface-container'
                  }`}
                />
                {errorsProv.nombre && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsProv.nombre}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Contacto</label>
                  <input
                    type="text"
                    value={formProv.contacto_nombre}
                    onChange={(e) => setFormProv({ ...formProv, contacto_nombre: e.target.value })}
                    className="w-full h-11 px-4 rounded-full bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Lead Time (Días)</label>
                  <input
                    type="number"
                    min="0"
                    value={formProv.lead_time_dias}
                    onChange={(e) => {
                      setFormProv({ ...formProv, lead_time_dias: e.target.value });
                      if (errorsProv.lead_time_dias) setErrorsProv((prev) => ({ ...prev, lead_time_dias: null }));
                    }}
                    className={`w-full h-11 px-4 rounded-full text-on-surface font-label-numeric-md text-body-md text-center focus:outline-none transition-all ${
                      errorsProv.lead_time_dias
                        ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                        : 'bg-surface-container-low focus:bg-surface-container'
                    }`}
                  />
                  {errorsProv.lead_time_dias && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsProv.lead_time_dias}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Teléfono</label>
                  <input
                    type="text"
                    value={formProv.telefono}
                    onChange={(e) => {
                      setFormProv({ ...formProv, telefono: e.target.value });
                      if (errorsProv.telefono) setErrorsProv((prev) => ({ ...prev, telefono: null }));
                    }}
                    placeholder="Ej. 0991234567"
                    className={`w-full h-11 px-4 rounded-full font-mono text-body-md text-on-surface focus:outline-none transition-all ${
                      errorsProv.telefono
                        ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                        : 'bg-surface-container-low focus:bg-surface-container'
                    }`}
                  />
                  {errorsProv.telefono && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsProv.telefono}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Correo Electrónico</label>
                  <input
                    type="email"
                    value={formProv.email}
                    onChange={(e) => {
                      setFormProv({ ...formProv, email: e.target.value });
                      if (errorsProv.email) setErrorsProv((prev) => ({ ...prev, email: null }));
                    }}
                    placeholder="proveedor@empresa.com"
                    className={`w-full h-11 px-4 rounded-full text-body-md text-on-surface focus:outline-none transition-all ${
                      errorsProv.email
                        ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                        : 'bg-surface-container-low focus:bg-surface-container'
                    }`}
                  />
                  {errorsProv.email && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errorsProv.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setModalProveedor({ open: false })}
                  className="h-11 px-6 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-6 rounded-full bg-primary text-on-primary hover:opacity-95 active:scale-98 font-headline-md text-body-md transition-all shadow-xs cursor-pointer"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CATEGORÍA */}
      {/* ========================================================================= */}
      {modalCategoria.open && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-sm w-full border border-outline-variant/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/40">
              <h3 className="font-headline-md text-title-lg text-on-surface">
                {modalCategoria.editando ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button 
                type="button"
                onClick={() => setModalCategoria({ open: false })} 
                className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarCategoria} className="p-6 space-y-4" noValidate>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Nombre *</label>
                <input
                  type="text"
                  value={formCat.nombre}
                  onChange={(e) => {
                    setFormCat({ ...formCat, nombre: e.target.value });
                    if (errorsCat.nombre) setErrorsCat((prev) => ({ ...prev, nombre: null }));
                  }}
                  className={`w-full h-11 px-4 rounded-full font-headline-md text-body-md text-on-surface focus:outline-none transition-all ${
                    errorsCat.nombre
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                      : 'bg-surface-container-low focus:bg-surface-container'
                  }`}
                />
                {errorsCat.nombre && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsCat.nombre}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">Descripción</label>
                <textarea
                  rows={2}
                  value={formCat.descripcion}
                  onChange={(e) => setFormCat({ ...formCat, descripcion: e.target.value })}
                  className="w-full p-3 rounded-2xl bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setModalCategoria({ open: false })}
                  className="h-11 px-6 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-6 rounded-full bg-primary text-on-primary hover:opacity-95 active:scale-98 font-headline-md text-body-md transition-all shadow-xs cursor-pointer"
                >
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL ORDEN DE COMPRA (CREAR Y RECIBIR MERCANCÍA CON LOTES SANITARIOS) */}
      {/* ========================================================================= */}
      <OrdenCompraModal
        isOpen={modalOrden.open}
        onClose={() => setModalOrden({ open: false, modo: 'crear' })}
        onSuccess={(msg) => {
          if (msg) showToast('success', msg);
          cargarDatos();
          cargarOrdenes();
        }}
        modo={modalOrden.modo}
        ordenParaRecibir={modalOrden.ordenParaRecibir}
        proveedores={proveedores}
        productos={productos}
        isBodeguero={isBodeguero}
        productoPreseleccionadoId={modalOrden.productoPreseleccionadoId}
      />

      {/* ========================================================================= */}
      {/* MODAL TRASPASO INTER-SUCURSAL (SOLICITUD) */}
      {/* ========================================================================= */}
      <TransferenciaModal
        isOpen={modalTransferenciaOpen}
        onClose={() => setModalTransferenciaOpen(false)}
        onSuccess={() => {
          void cargarTransferencias();
          void cargarDatos();
        }}
        sucursales={sucursales}
        sucursalOrigenDefaultId={sucursalActual?.id}
        productos={productos}
      />

      {/* ========================================================================= */}
      {/* MODAL DETALLE DE TRASPASO (DESPACHO Y RECEPCIÓN) */}
      {/* ========================================================================= */}
      <TransferenciaDetalleModal
        isOpen={detalleTransferencia !== null}
        onClose={() => setDetalleTransferencia(null)}
        transferencia={detalleTransferencia}
        onActualizado={() => {
          void cargarTransferencias();
          void cargarDatos();
        }}
        puedeGestionar={isSupervisorOrDirector || isBodeguero}
      />
    </div>
  );
}
