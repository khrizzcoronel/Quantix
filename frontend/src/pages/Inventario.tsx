import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, PlusCircle, AlertCircle, CheckCircle2, 
  Search, Edit, Trash2, RotateCcw, 
  Truck, Tag, Layers, X, Eye,
  ShieldAlert, Loader2, ShoppingBag, ArrowUpRight,
  AlertTriangle, Download
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import OrdenCompraModal from '../components/OrdenCompraModal';
import type { OrdenCompraData } from '../components/OrdenCompraModal';
import { exportToCSV, formatCurrency, formatNumber, formatDate } from '../utils/exportUtils';

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

export default function Inventario() {
  const { user } = useAuthStore();
  const isSupervisorOrDirector = user?.rol === 'SUPERVISOR' || user?.rol === 'DIRECTOR';
  const isBodeguero = user?.rol === 'BODEGUERO';

  const [activeTab, setActiveTab] = useState<'productos' | 'lotes' | 'ordenes' | 'proveedores' | 'categorias'>(
    isBodeguero ? 'lotes' : 'productos'
  );
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Estados de datos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ordenesCompra, setOrdenesCompra] = useState<OrdenCompraData[]>([]);
  const [sugerenciasReorden, setSugerenciasReorden] = useState<SugerenciaReorden[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [alertasFefoCount, setAlertasFefoCount] = useState(0);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [filtroEstadoOrden, setFiltroEstadoOrden] = useState('');
  const [filtroProveedorOrden, setFiltroProveedorOrden] = useState('');

  // Modal de Detalles Unificado
  const [detalleItem, setDetalleItem] = useState<DetalleModalState | null>(null);

  // Modales de Acción
  const [modalProducto, setModalProducto] = useState<{ open: boolean; editando?: Producto | null }>({ open: false });
  const [modalIngresoLote, setModalIngresoLote] = useState(false);
  const [modalBajaLote, setModalBajaLote] = useState<{ open: boolean; lote?: Lote | null }>({ open: false });
  const [modalProveedor, setModalProveedor] = useState<{ open: boolean; editando?: Proveedor | null }>({ open: false });
  const [modalCategoria, setModalCategoria] = useState<{ open: boolean; editando?: Categoria | null }>({ open: false });

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

  const showToast = useCallback((tipo: 'success' | 'error', mensaje: string) => {
    setFeedback({ tipo, mensaje });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [resProd, resLot, resProv, resCat, resOC, resSug, resFefo] = await Promise.all([
        api.get('/inventario/productos', { params: { activo_only: !mostrarInactivos } }),
        api.get('/inventario/lotes'),
        api.get('/inventario/proveedores', { params: { activo_only: !mostrarInactivos } }),
        api.get('/inventario/categorias', { params: { activo_only: !mostrarInactivos } }),
        api.get('/inventario/ordenes-compra', { params: { estado: filtroEstadoOrden || undefined, proveedor_id: filtroProveedorOrden || undefined } }),
        api.get('/inventario/ordenes-compra/sugerencias'),
        api.get('/inventario/alertas-caducidad', { params: { dias_alerta: 15 } })
      ]);
      setProductos(resProd.data);
      setLotes(resLot.data);
      setProveedores(resProv.data);
      setCategorias(resCat.data);
      setOrdenesCompra(resOC.data);
      setSugerenciasReorden(resSug.data);
      setAlertasFefoCount(resFefo.data?.length || 0);
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al sincronizar datos de inventario');
    } finally {
      setLoading(false);
    }
  }, [filtroEstadoOrden, filtroProveedorOrden, mostrarInactivos, showToast]);

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
      const res = await api.get('/inventario/lotes', { params: { producto_id: prod.id } });
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
    setModalProducto({ open: true, editando: prod });
  };

  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        categoria_id: formProd.categoria_id,
        sku: formProd.sku,
        nombre: formProd.nombre,
        codigo_barras: formProd.codigo_barras || null,
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
      showToast('error', err.response?.data?.detail || 'Error al guardar producto');
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
    setModalIngresoLote(true);
  };

  const handleGuardarIngresoLote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventario/lotes/ingreso-directo', {
        producto_id: formLote.producto_id,
        codigo_lote: formLote.codigo_lote,
        cantidad: parseFloat(formLote.cantidad),
        costo_unitario: parseFloat(formLote.costo_unitario),
        fecha_vencimiento: formLote.fecha_vencimiento || null,
        notas: formLote.notas
      });
      showToast('success', `Lote ${formLote.codigo_lote} ingresado. FEFO activo.`);
      setModalIngresoLote(false);
      if (detalleItem?.tipo === 'producto') setDetalleItem(null);
      cargarDatos();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al ingresar lote');
    }
  };

  const handleAbrirBajaLote = (lote: Lote) => {
    setFormBaja({
      motivo: 'MERMA',
      cantidad_baja: String(lote.cantidad_disponible),
      notas: ''
    });
    setModalBajaLote({ open: true, lote });
  };

  const handleConfirmarBajaLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalBajaLote.lote) return;
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
    setModalProveedor({ open: true, editando: null });
  };

  const handleGuardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: formProv.nombre,
        contacto_nombre: formProv.contacto_nombre || null,
        telefono: formProv.telefono || null,
        email: formProv.email || null,
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
    setModalCategoria({ open: true, editando: null });
  };

  const handleGuardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalCategoria.editando) {
        await api.put(`/inventario/categorias/${modalCategoria.editando.id}`, formCat);
        showToast('success', 'Categoría actualizada');
      } else {
        await api.post('/inventario/categorias', formCat);
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
    return matchSearch && matchCat;
  });

  const getSemaforoFefo = (fechaVencimiento?: string) => {
    if (!fechaVencimiento) return { color: 'bg-gray-100 text-gray-700', texto: 'Sin fecha' };
    const hoy = new Date();
    const venc = new Date(fechaVencimiento);
    const diffDias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) return { color: 'bg-red-100 text-red-800 border-red-200', texto: `Vencido (${Math.abs(diffDias)}d)` };
    if (diffDias <= 15) return { color: 'bg-red-50 text-red-700 border-red-300 font-bold', texto: `Crítico: ${diffDias}d` };
    if (diffDias <= 30) return { color: 'bg-amber-100 text-amber-800 border-amber-300', texto: `Alerta: ${diffDias}d` };
    return { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', texto: `${diffDias} días` };
  };

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
    <div className="p-8 h-full overflow-y-auto bg-gray-50 flex flex-col">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`fixed top-5 right-8 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all ${
          feedback.tipo === 'success' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-red-600 text-white border-red-700'
        }`}>
          {feedback.tipo === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{feedback.mensaje}</span>
        </div>
      )}

      {/* Banner de Modo Bodeguero */}
      {isBodeguero && (
        <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-300/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              <strong>Modo Bodeguero Activo:</strong> Vista operativa de almacén y piso. Los costos unitarios, precios de venta y márgenes de ganancia están ocultos.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('lotes')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Recepción Rápida
            </button>
            <button
              onClick={() => setActiveTab('ordenes')}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Órdenes de Compra
            </button>
          </div>
        </div>
      )}

      {/* Banner de Alerta Sanitaria FEFO Urgente */}
      {alertasFefoCount > 0 && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-300 rounded-2xl flex items-center justify-between gap-3 text-red-900 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>
              ¡Alerta FEFO Sanitaria Urgente! Existen <strong>{alertasFefoCount} lotes</strong> que vencen en los próximos 15 días. Priorizar rotación y despacho en piso de venta.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('lotes')}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 shadow-sm"
          >
            Ver Lotes en Riesgo
          </button>
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              isBodeguero ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {isBodeguero ? 'Modo Bodeguero • Almacén & Lotes' : 'Operativo • Piso & Venta'}
            </span>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-quantix-600 ml-2" />}
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight mt-1">Control de Inventario</h2>
          <p className="text-gray-500 text-sm font-medium">
            Catálogo de stock, lotes FEFO, órdenes de compra, proveedores y trazabilidad sanitaria
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportarCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
            title="Exportar catálogo y lotes con valorización a CSV / Excel"
          >
            <Download className="w-4 h-4 text-quantix-600" />
            <span>Exportar a CSV</span>
          </button>
          <button
            onClick={() => handleAbrirCrearOrden()}
            className="flex items-center gap-2 px-4 py-2.5 bg-quantix-600 hover:bg-quantix-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            Nueva Orden
          </button>
          <button
            onClick={() => handleAbrirIngresoLote()}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            Ingreso de Mercancía
          </button>
          {!isBodeguero && (
            <button
              onClick={handleAbrirCrearProducto}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex items-center gap-2 border-b border-gray-200 mb-6 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('productos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${
            activeTab === 'productos' 
              ? 'bg-quantix-600 text-white shadow-sm' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Package className="w-4 h-4" />
          Catálogo de Productos
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-black/20">{productos.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('lotes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${
            activeTab === 'lotes' 
              ? 'bg-quantix-600 text-white shadow-sm' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          Ingresos y Lotes FEFO
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-black/20">{lotes.length}</span>
          {alertasFefoCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white">
              {alertasFefoCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ordenes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${
            activeTab === 'ordenes' 
              ? 'bg-quantix-600 text-white shadow-sm' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Órdenes de Compra
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-black/20">{ordenesCompra.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('proveedores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${
            activeTab === 'proveedores' 
              ? 'bg-quantix-600 text-white shadow-sm' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          Directorio de Proveedores
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-black/20">{proveedores.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('categorias')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${
            activeTab === 'categorias' 
              ? 'bg-quantix-600 text-white shadow-sm' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Tag className="w-4 h-4" />
          Categorías
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-black/20">{categorias.length}</span>
        </button>
      </div>

      {/* Pestaña: Catálogo de Productos */}
      {activeTab === 'productos' && (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por SKU, nombre o código de barras..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700"
              >
                <option value="">Todas las categorías</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-600 select-none">
              <input
                type="checkbox"
                checked={mostrarInactivos}
                onChange={(e) => setMostrarInactivos(e.target.checked)}
                className="rounded border-gray-300 text-quantix-600 focus:ring-quantix-500 w-4 h-4"
              />
              Mostrar dados de baja (inactivos)
            </label>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">SKU / Código</th>
                    <th className="py-3 px-4">Descripción</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-center">Stock Total</th>
                    <th className="py-3 px-4 text-center">Lotes Activos</th>
                    {!isBodeguero && <th className="py-3 px-4 text-right">Costo Reposición</th>}
                    {!isBodeguero && <th className="py-3 px-4 text-right">Precio Venta</th>}
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {productosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={isBodeguero ? 7 : 9} className="py-12 text-center text-gray-400 font-medium">
                        No se encontraron productos registrados con los criterios seleccionados.
                      </td>
                    </tr>
                  ) : (
                    productosFiltrados.map((item) => (
                      <tr 
                        key={item.id} 
                        onClick={() => handleVerDetalleProducto(item)}
                        title="Haz clic para ver el detalle y lotes de este producto"
                        className={`cursor-pointer hover:bg-quantix-50/60 transition-colors ${!item.activo ? 'opacity-60 bg-gray-50/30' : ''}`}
                      >
                        <td className="py-3.5 px-4 font-mono text-xs">
                          <span className="font-bold text-gray-800">{item.sku}</span>
                          {item.codigo_barras && (
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5">{item.codigo_barras}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          <div className="flex items-center gap-3">
                            {item.imagen ? (
                              <img 
                                src={item.imagen} 
                                alt={item.nombre} 
                                className="w-10 h-10 object-cover rounded-xl border border-gray-200 shrink-0 shadow-sm" 
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span>{item.nombre}</span>
                              <span className="text-gray-300 text-xs">🔍</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold">
                            {item.categoria_nombre || 'Sin categoría'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            item.stock_total > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {item.stock_total} {item.requiere_pesaje ? 'kg' : 'uds'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-quantix-600 text-xs">
                          {item.lotes_activos_count} {item.lotes_activos_count === 1 ? 'lote' : 'lotes'}
                        </td>
                        {!isBodeguero && (
                          <td className="py-3.5 px-4 text-right font-mono text-gray-600 font-medium">${Number(item.costo_base).toFixed(2)}</td>
                        )}
                        {!isBodeguero && (
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">${Number(item.precio_venta).toFixed(2)}</td>
                        )}
                        <td className="py-3.5 px-4 text-center">
                          {item.activo ? (
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">Activo</span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-bold">Baja Lógica</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleVerDetalleProducto(item)}
                              title="Ver Ficha Técnica y Lotes"
                              className="p-1.5 text-quantix-600 hover:bg-quantix-50 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAbrirIngresoLote(item.id)}
                              title="Ingresar Lote / Mercancía"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                            {!isBodeguero && (
                              <button
                                onClick={() => handleAbrirEditarProducto(item)}
                                title="Editar Producto"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {isSupervisorOrDirector && (
                              <button
                                onClick={() => handleToggleActivoProducto(item)}
                                title={item.activo ? "Dar de baja lógica" : "Reactivar producto"}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  item.activo ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {item.activo ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                              </button>
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

      {/* Pestaña: Lotes e Ingresos */}
      {activeTab === 'lotes' && (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Historial de Ingresos de Mercancía y Caducidad FEFO</h3>
                <p className="text-xs text-gray-500">Gestión sanitaria con despacho First-Expired, First-Out</p>
              </div>
              <button
                onClick={() => handleAbrirIngresoLote()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Registrar Ingreso Directo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/20 text-xs font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-4">Código Lote</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4 text-center">Disponible</th>
                    <th className="py-3 px-4 text-center">Inicial</th>
                    {!isBodeguero && <th className="py-3 px-4 text-right">Costo Unitario</th>}
                    <th className="py-3 px-4 text-center">Fecha Caducidad</th>
                    <th className="py-3 px-4 text-center">Semáforo FEFO</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {lotes.length === 0 ? (
                    <tr>
                      <td colSpan={isBodeguero ? 8 : 9} className="py-12 text-center text-gray-400 font-medium">
                        No hay lotes registrados. Utilice el botón "Registrar Ingreso Directo" para nutrir el stock.
                      </td>
                    </tr>
                  ) : (
                    lotes.map((lote) => {
                      const sem = getSemaforoFefo(lote.fecha_vencimiento);
                      return (
                        <tr 
                          key={lote.id} 
                          onClick={() => handleVerDetalleLote(lote)}
                          title="Haz clic para ver trazabilidad de este lote"
                          className="cursor-pointer hover:bg-quantix-50/60 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-xs text-gray-800">{lote.codigo_lote}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-gray-900">{lote.producto_nombre}</span>
                            <span className="block text-xs font-mono text-gray-400">{lote.producto_sku}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-black text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg text-xs">
                              {lote.cantidad_disponible} uds
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center text-xs text-gray-500">{lote.cantidad_inicial || '-'}</td>
                          {!isBodeguero && (
                            <td className="py-3.5 px-4 text-right font-mono text-gray-700">${Number(lote.costo_unitario || 0).toFixed(2)}</td>
                          )}
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-gray-600">
                            {lote.fecha_vencimiento || 'Sin caducidad'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${sem.color}`}>
                              {sem.texto}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              lote.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' :
                              lote.estado === 'MERMA' ? 'bg-amber-100 text-amber-800' :
                              lote.estado === 'CADUCADO' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {lote.estado}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleVerDetalleLote(lote)}
                                title="Ver Ficha de Lote"
                                className="p-1.5 text-quantix-600 hover:bg-quantix-50 rounded-lg transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {lote.estado === 'ACTIVO' && lote.cantidad_disponible > 0 && isSupervisorOrDirector && (
                                <button
                                  onClick={() => handleAbrirBajaLote(lote)}
                                  className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                                >
                                  Baja Merma/Caducidad
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

      {/* Pestaña: Órdenes de Compra y Recepción de Mercancía */}
      {activeTab === 'ordenes' && (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[300px]">
              <select
                value={filtroEstadoOrden}
                onChange={(e) => setFiltroEstadoOrden(e.target.value)}
                className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700"
              >
                <option value="">Todos los estados</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="RECIBIDA">RECIBIDA</option>
                <option value="CANCELADA">CANCELADA</option>
              </select>

              <select
                value={filtroProveedorOrden}
                onChange={(e) => setFiltroProveedorOrden(e.target.value)}
                className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700"
              >
                <option value="">Todos los proveedores</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMostrarSugerencias(!mostrarSugerencias)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  mostrarSugerencias 
                    ? 'bg-amber-100 text-amber-900 border-amber-300' 
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Sugerencias de Reorden ({sugerenciasReorden.length})</span>
              </button>

              <button
                onClick={() => handleAbrirCrearOrden()}
                className="flex items-center gap-1.5 px-4 py-2 bg-quantix-600 hover:bg-quantix-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                Nueva Orden
              </button>
            </div>
          </div>

          {/* Panel de Sugerencias de Reorden */}
          {mostrarSugerencias && (
            <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-200 text-amber-800 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                  </span>
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                    Productos con Stock por Debajo del Punto de Reorden Sugerido
                  </h4>
                </div>
                <span className="text-xs text-amber-700 font-medium">Algoritmo dinámico por velocidad de venta y factor de seguridad ABC</span>
              </div>

              {sugerenciasReorden.length === 0 ? (
                <div className="p-4 bg-white rounded-xl text-center text-xs text-gray-500 font-medium border border-amber-100">
                  ✅ Todos los productos mantienen niveles de inventario por encima de su umbral de reorden.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sugerenciasReorden.map((sug) => (
                    <div key={sug.producto_id} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-gray-800">{sug.sku}</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                            {sug.motivo || 'Reorden necesario'}
                          </span>
                        </div>
                        <h5 className="font-bold text-sm text-gray-900 mt-1">{sug.nombre}</h5>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span>Stock: <strong className="text-red-600 font-mono">{sug.stock_actual} uds</strong></span>
                          <span>•</span>
                          <span>Pto. Reorden: <strong className="text-gray-800 font-mono">{sug.punto_reorden} uds</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-xs font-bold text-quantix-700">
                          Sugerido: <strong className="text-sm font-black text-quantix-900">{sug.sugerido_compra} uds</strong>
                        </span>
                        <button
                          onClick={() => handleAbrirCrearOrden(sug.producto_id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-quantix-600 hover:bg-quantix-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm"
                        >
                          <span>Ordenar</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tabla de Órdenes de Compra */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Folio / Fecha</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4 text-center">Líneas Solicitadas</th>
                    {!isBodeguero && <th className="py-3 px-4 text-right">Total Estimado</th>}
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Fecha Recepción</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {ordenesCompra.length === 0 ? (
                    <tr>
                      <td colSpan={isBodeguero ? 6 : 7} className="py-12 text-center text-gray-400 font-medium">
                        No hay órdenes de compra registradas con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    ordenesCompra.map((orden) => (
                      <tr
                        key={orden.id}
                        onClick={() => handleVerDetalleOrden(orden)}
                        className="cursor-pointer hover:bg-quantix-50/60 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono text-xs">
                          <span className="font-black text-gray-800">#{orden.id.slice(0, 8)}</span>
                          <div className="text-[11px] text-gray-400 font-sans mt-0.5">
                            {new Date(orden.fecha_emision).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-gray-900 block">{orden.proveedor_nombre || 'Proveedor'}</span>
                          {orden.notas && <span className="text-xs text-gray-400 truncate max-w-xs block">{orden.notas}</span>}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-gray-700 text-xs">
                          {orden.detalles?.length || 0} {orden.detalles?.length === 1 ? 'producto' : 'productos'}
                        </td>
                        {!isBodeguero && (
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                            ${Number(orden.total_estimado || 0).toFixed(2)}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            orden.estado === 'RECIBIDA' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : orden.estado === 'PENDIENTE'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {orden.estado}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-xs text-gray-600">
                          {orden.fecha_recepcion ? new Date(orden.fecha_recepcion).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleVerDetalleOrden(orden)}
                              title="Ver Detalle de Orden"
                              className="p-1.5 text-quantix-600 hover:bg-quantix-50 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {orden.estado === 'PENDIENTE' && (
                              <>
                                <button
                                  onClick={() => handleAbrirRecibirOrden(orden)}
                                  title="Recibir Mercancía"
                                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>Recibir Mercancía</span>
                                </button>

                                <button
                                  onClick={() => handleCancelarOrden(orden.id)}
                                  title="Cancelar Orden"
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <X className="w-4 h-4" />
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

      {/* Pestaña: Proveedores */}
      {activeTab === 'proveedores' && (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-sm">Directorio Oficial de Proveedores de Mercancía</h3>
              <button
                onClick={handleAbrirCrearProveedor}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-quantix-600 text-white rounded-xl text-xs font-bold hover:bg-quantix-700"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Nuevo Proveedor
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/20 text-xs font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-4">Nombre Comercial</th>
                    <th className="py-3 px-4">Contacto</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-center">Lead Time (Entrega)</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {proveedores.map((prov) => (
                    <tr 
                      key={prov.id} 
                      onClick={() => handleVerDetalleProveedor(prov)}
                      title="Haz clic para ver datos completos del proveedor"
                      className={`cursor-pointer hover:bg-quantix-50/60 transition-colors ${!prov.activo ? 'opacity-60' : ''}`}
                    >
                      <td className="py-3.5 px-4 font-bold text-gray-900">{prov.nombre}</td>
                      <td className="py-3.5 px-4 text-gray-600">{prov.contacto_nombre || '-'}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-700">{prov.telefono || '-'}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-blue-600">{prov.email || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg text-xs font-bold">
                          {prov.lead_time_dias} días
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          prov.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {prov.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleVerDetalleProveedor(prov)}
                          title="Ver Ficha Proveedor"
                          className="p-1.5 text-quantix-600 hover:bg-quantix-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pestaña: Categorías */}
      {activeTab === 'categorias' && (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-sm">Familias y Categorías de Catálogo</h3>
              <button
                onClick={handleAbrirCrearCategoria}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-quantix-600 text-white rounded-xl text-xs font-bold hover:bg-quantix-700"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Nueva Categoría
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/20 text-xs font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-4">Nombre</th>
                    <th className="py-3 px-4">Descripción</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {categorias.map((cat) => (
                    <tr 
                      key={cat.id} 
                      onClick={() => handleVerDetalleCategoria(cat)}
                      title="Haz clic para ver detalle de la categoría"
                      className={`cursor-pointer hover:bg-quantix-50/60 transition-colors ${!cat.activo ? 'opacity-60' : ''}`}
                    >
                      <td className="py-3.5 px-4 font-bold text-gray-900">{cat.nombre}</td>
                      <td className="py-3.5 px-4 text-gray-600 text-xs">{cat.descripcion || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          cat.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {cat.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleVerDetalleCategoria(cat)}
                          title="Ver Ficha Categoría"
                          className="p-1.5 text-quantix-600 hover:bg-quantix-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
      {/* MODAL DE DETALLE UNIFICADO */}
      {/* ========================================================================= */}
      {detalleItem && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-quantix-50 text-quantix-600 rounded-2xl">
                  {detalleItem.tipo === 'producto' && <Package className="w-6 h-6" />}
                  {detalleItem.tipo === 'lote' && <Layers className="w-6 h-6" />}
                  {detalleItem.tipo === 'proveedor' && <Truck className="w-6 h-6" />}
                  {detalleItem.tipo === 'categoria' && <Tag className="w-6 h-6" />}
                  {detalleItem.tipo === 'orden' && <ShoppingBag className="w-6 h-6" />}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-quantix-600 bg-quantix-50 px-2 py-0.5 rounded-full">
                    Ficha de {detalleItem.tipo.toUpperCase()}
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900 mt-0.5">
                    {detalleItem.tipo === 'producto' && detalleItem.data.nombre}
                    {detalleItem.tipo === 'lote' && `Lote: ${detalleItem.data.codigo_lote}`}
                    {detalleItem.tipo === 'proveedor' && detalleItem.data.nombre}
                    {detalleItem.tipo === 'categoria' && detalleItem.data.nombre}
                    {detalleItem.tipo === 'orden' && `Orden #${detalleItem.data.id.slice(0, 8)}`}
                  </h3>
                </div>
              </div>
              <button onClick={() => setDetalleItem(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* DETALLE: ORDEN DE COMPRA */}
              {detalleItem.tipo === 'orden' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Estado</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        detalleItem.data.estado === 'RECIBIDA' ? 'bg-emerald-100 text-emerald-800' :
                        detalleItem.data.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {detalleItem.data.estado}
                      </span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Proveedor</span>
                      <span className="font-bold text-gray-900 text-xs truncate block">{detalleItem.data.proveedor_nombre || 'N/A'}</span>
                    </div>

                    {!isBodeguero && (
                      <div className="bg-quantix-50 p-3.5 rounded-xl border border-quantix-200">
                        <span className="text-[10px] font-bold text-quantix-700 uppercase block mb-1">Total Estimado</span>
                        <span className="font-black text-sm font-mono text-quantix-900">
                          ${Number(detalleItem.data.total_estimado || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase">Líneas Solicitadas</h4>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Producto</th>
                            <th className="py-2.5 px-3 text-center">Cantidad</th>
                            {!isBodeguero && <th className="py-2.5 px-3 text-right">Costo Pactado</th>}
                            {!isBodeguero && <th className="py-2.5 px-3 text-right">Subtotal</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(detalleItem.data.detalles || []).map((det: any, i: number) => (
                            <tr key={i}>
                              <td className="py-2.5 px-3 font-semibold text-gray-900">
                                {det.producto_nombre || 'Producto'}
                                <span className="block text-[10px] font-mono text-gray-400">{det.producto_sku}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-gray-800">{det.cantidad_solicitada} uds</td>
                              {!isBodeguero && (
                                <td className="py-2.5 px-3 text-right font-mono text-gray-700">${Number(det.costo_unitario_pactado).toFixed(2)}</td>
                              )}
                              {!isBodeguero && (
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">${Number(det.subtotal || 0).toFixed(2)}</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {detalleItem.data.lotes && detalleItem.data.lotes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        Lotes Sanitarios Ingresados en Recepción ({detalleItem.data.lotes.length})
                      </h4>
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                            <tr>
                              <th className="py-2 px-3">Lote Sanitario</th>
                              <th className="py-2 px-3">Artículo</th>
                              <th className="py-2 px-3 text-center">Disponible</th>
                              <th className="py-2 px-3 text-center">Caducidad</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {detalleItem.data.lotes.map((lt: any, idx: number) => (
                              <tr key={idx}>
                                <td className="py-2 px-3 font-mono font-bold text-gray-800">{lt.codigo_lote}</td>
                                <td className="py-2 px-3 font-medium text-gray-900">{lt.producto_nombre}</td>
                                <td className="py-2 px-3 text-center font-bold text-emerald-700">{lt.cantidad_disponible} uds</td>
                                <td className="py-2 px-3 text-center font-mono text-gray-600">{lt.fecha_vencimiento || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DETALLE: PRODUCTO */}
              {detalleItem.tipo === 'producto' && (
                <div className="space-y-4">
                  <div className={`grid ${isBodeguero ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                    <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/60">
                      <span className="text-xs font-bold text-emerald-800 uppercase block mb-1">Stock Disponible</span>
                      <div className="text-2xl font-black text-emerald-900">
                        {detalleItem.data.stock_total} <span className="text-sm font-semibold">{detalleItem.data.requiere_pesaje ? 'kg' : 'uds'}</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 mt-1 block font-medium">
                        {detalleItem.data.lotes_activos_count} {detalleItem.data.lotes_activos_count === 1 ? 'lote activo' : 'lotes activos'}
                      </span>
                    </div>

                    {!isBodeguero && (
                      <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200/60">
                        <span className="text-xs font-bold text-blue-800 uppercase block mb-1">Precio de Venta</span>
                        <div className="text-2xl font-black text-blue-900 font-mono">
                          ${Number(detalleItem.data.precio_venta).toFixed(2)}
                        </div>
                        <span className="text-[11px] text-blue-700 mt-1 block font-medium">
                          Costo: ${Number(detalleItem.data.costo_base).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {!isBodeguero && (
                      <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200/60">
                        <span className="text-xs font-bold text-purple-800 uppercase block mb-1">Margen Comercial</span>
                        <div className="text-2xl font-black text-purple-900 font-mono">
                          {Number(detalleItem.data.precio_venta) > 0 
                            ? (((Number(detalleItem.data.precio_venta) - Number(detalleItem.data.costo_base)) / Number(detalleItem.data.precio_venta)) * 100).toFixed(1)
                            : 0}%
                        </div>
                        <span className="text-[11px] text-purple-700 mt-1 block font-medium">
                          Ganancia: +${(Number(detalleItem.data.precio_venta) - Number(detalleItem.data.costo_base)).toFixed(2)}/ud
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-400 font-bold block uppercase mb-0.5">Familia / Categoría</span>
                      <span className="font-bold text-gray-900 text-sm">{detalleItem.data.categoria_nombre || 'Sin clasificar'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold block uppercase mb-0.5">Clasificación ABC</span>
                      <span className="font-bold text-gray-900 text-sm">
                        Rotación Tipo {detalleItem.data.clasificacion_abc || 'A'}
                      </span>
                    </div>
                  </div>

                  {/* Tabla de Lotes FEFO del Producto */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-quantix-600" />
                        Trazabilidad de Lotes Físicos (FEFO)
                      </h4>
                      <button
                        onClick={() => handleAbrirIngresoLote(detalleItem.data.id)}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Ingresar Lote
                      </button>
                    </div>

                    {detalleItem.loadingLotes ? (
                      <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-quantix-600" />
                        <span className="text-xs font-semibold">Cargando lotes...</span>
                      </div>
                    ) : !detalleItem.lotesProducto || detalleItem.lotesProducto.length === 0 ? (
                      <div className="p-6 bg-gray-50 rounded-2xl text-center text-gray-400 text-xs font-medium border border-dashed border-gray-300">
                        Este producto no tiene lotes activos.
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                              <th className="py-2.5 px-3">Lote</th>
                              <th className="py-2.5 px-3 text-center">Disponible</th>
                              {!isBodeguero && <th className="py-2.5 px-3 text-right">Costo</th>}
                              <th className="py-2.5 px-3 text-center">Vencimiento</th>
                              <th className="py-2.5 px-3 text-center">Prioridad FEFO</th>
                              <th className="py-2.5 px-3 text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {detalleItem.lotesProducto.map((lot) => {
                              const sem = getSemaforoFefo(lot.fecha_vencimiento);
                              return (
                                <tr key={lot.id} className="hover:bg-gray-50/80">
                                  <td className="py-2.5 px-3 font-mono font-bold text-gray-800">{lot.codigo_lote}</td>
                                  <td className="py-2.5 px-3 text-center font-bold text-gray-900">{lot.cantidad_disponible} uds</td>
                                  {!isBodeguero && (
                                    <td className="py-2.5 px-3 text-right font-mono text-gray-700">${Number(lot.costo_unitario || 0).toFixed(2)}</td>
                                  )}
                                  <td className="py-2.5 px-3 text-center font-mono text-gray-600">{lot.fecha_vencimiento || '-'}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sem.color}`}>
                                      {sem.texto}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-bold">
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
                    <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/60">
                      <span className="text-xs font-bold text-emerald-800 uppercase block mb-1">Stock Remanente</span>
                      <div className="text-3xl font-black text-emerald-900">
                        {detalleItem.data.cantidad_disponible} <span className="text-sm font-semibold">uds</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 mt-1 block font-medium">
                        Inicial recibido: {detalleItem.data.cantidad_inicial || detalleItem.data.cantidad_disponible} uds
                      </span>
                    </div>

                    {!isBodeguero && (
                      <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/60">
                        <span className="text-xs font-bold text-amber-800 uppercase block mb-1">Valoración en Almacén</span>
                        <div className="text-3xl font-black text-amber-900 font-mono">
                          ${(Number(detalleItem.data.costo_unitario || 0) * Number(detalleItem.data.cantidad_disponible)).toFixed(2)}
                        </div>
                        <span className="text-[11px] text-amber-700 mt-1 block font-medium">
                          Costo unitario: ${Number(detalleItem.data.costo_unitario || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-bold uppercase">Artículo Asociado:</span>
                      <span className="font-bold text-gray-900">{detalleItem.data.producto_nombre} ({detalleItem.data.producto_sku})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-bold uppercase">Fecha de Caducidad Sanitaria:</span>
                      <span className="font-mono font-bold text-gray-900">{detalleItem.data.fecha_vencimiento || 'Sin caducidad'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-bold uppercase">Semáforo FEFO:</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getSemaforoFefo(detalleItem.data.fecha_vencimiento).color}`}>
                        {getSemaforoFefo(detalleItem.data.fecha_vencimiento).texto}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DETALLE: PROVEEDOR */}
              {detalleItem.tipo === 'proveedor' && (
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase">Razón Social:</span>
                    <span className="font-bold text-gray-900 text-sm">{detalleItem.data.nombre}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase">Contacto:</span>
                    <span className="font-semibold text-gray-800">{detalleItem.data.contacto_nombre || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase">Lead Time (Entrega):</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold">
                      {detalleItem.data.lead_time_dias} días naturales
                    </span>
                  </div>
                </div>
              )}

              {/* DETALLE: CATEGORÍA */}
              {detalleItem.tipo === 'categoria' && (
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase">Nombre:</span>
                    <span className="font-bold text-gray-900 text-sm">{detalleItem.data.nombre}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-bold uppercase block mb-1">Descripción:</span>
                    <p className="text-gray-700 bg-white p-3 rounded-xl border border-gray-200 text-xs leading-relaxed">
                      {detalleItem.data.descripcion || 'Sin descripción.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer de Acciones del Modal */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {detalleItem.tipo === 'orden' && detalleItem.data.estado === 'PENDIENTE' && (
                  <button
                    onClick={() => {
                      const ord = detalleItem.data;
                      setDetalleItem(null);
                      handleAbrirRecibirOrden(ord);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Recibir Mercancía
                  </button>
                )}
              </div>
              <button
                onClick={() => setDetalleItem(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-300"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-extrabold text-gray-900 text-lg">
                {modalProducto.editando ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setModalProducto({ open: false })} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarProducto} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={formProd.sku}
                    onChange={(e) => setFormProd({ ...formProd, sku: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Categoría *</label>
                  <select
                    value={formProd.categoria_id}
                    onChange={(e) => setFormProd({ ...formProd, categoria_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-quantix-500"
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={formProd.nombre}
                  onChange={(e) => setFormProd({ ...formProd, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Código de Barras</label>
                  <input
                    type="text"
                    value={formProd.codigo_barras}
                    onChange={(e) => setFormProd({ ...formProd, codigo_barras: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Clasificación ABC</label>
                  <select
                    value={formProd.clasificacion_abc}
                    onChange={(e) => setFormProd({ ...formProd, clasificacion_abc: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-quantix-500"
                  >
                    <option value="A">A (Alta rotación / valor)</option>
                    <option value="B">B (Media rotación)</option>
                    <option value="C">C (Baja rotación)</option>
                  </select>
                </div>
              </div>

              {!isBodeguero && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Costo Base ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formProd.costo_base}
                      onChange={(e) => setFormProd({ ...formProd, costo_base: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Precio Venta ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formProd.precio_venta}
                      onChange={(e) => setFormProd({ ...formProd, precio_venta: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Margen Mín %</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formProd.margen_minimo_pct}
                      onChange={(e) => setFormProd({ ...formProd, margen_minimo_pct: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="requiere_pesaje"
                  checked={formProd.requiere_pesaje}
                  onChange={(e) => setFormProd({ ...formProd, requiere_pesaje: e.target.checked })}
                  className="rounded text-quantix-600 focus:ring-quantix-500 h-4 w-4"
                />
                <label htmlFor="requiere_pesaje" className="text-xs font-bold text-gray-700">
                  Requiere pesaje en báscula (producto a granel)
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalProducto({ open: false })}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-quantix-600 hover:bg-quantix-700 rounded-xl shadow-md"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-extrabold text-gray-900 text-lg">Registrar Ingreso de Lote</h3>
              <button onClick={() => setModalIngresoLote(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarIngresoLote} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Artículo / Producto *</label>
                <select
                  value={formLote.producto_id}
                  onChange={(e) => setFormLote({ ...formLote, producto_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-quantix-500"
                >
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} • {p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Código de Lote Sanitario *</label>
                <input
                  type="text"
                  required
                  value={formLote.codigo_lote}
                  onChange={(e) => setFormLote({ ...formLote, codigo_lote: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cantidad *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={formLote.cantidad}
                    onChange={(e) => setFormLote({ ...formLote, cantidad: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
                {!isBodeguero && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Costo Unitario ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formLote.costo_unitario}
                      onChange={(e) => setFormLote({ ...formLote, costo_unitario: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha de Caducidad</label>
                <input
                  type="date"
                  value={formLote.fecha_vencimiento}
                  onChange={(e) => setFormLote({ ...formLote, fecha_vencimiento: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalIngresoLote(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-extrabold text-gray-900 text-lg">Baja de Inventario / Merma</h3>
              <button onClick={() => setModalBajaLote({ open: false })} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmarBajaLote} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Motivo de Baja *</label>
                <select
                  value={formBaja.motivo}
                  onChange={(e) => setFormBaja({ ...formBaja, motivo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-quantix-500"
                >
                  <option value="MERMA">Merma / Desperdicio / Deterioro</option>
                  <option value="CADUCADO">Caducidad Expirada (Sanitaria)</option>
                  <option value="DANADO">Empaque Roto / Dañado en Traslado</option>
                  <option value="CUARENTENA">Aislamiento por Cuarentena</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Cantidad a dar de baja (Disponible: {modalBajaLote.lote.cantidad_disponible}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={modalBajaLote.lote.cantidad_disponible}
                  required
                  value={formBaja.cantidad_baja}
                  onChange={(e) => setFormBaja({ ...formBaja, cantidad_baja: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Notas / Justificación</label>
                <textarea
                  rows={2}
                  value={formBaja.notas}
                  onChange={(e) => setFormBaja({ ...formBaja, notas: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalBajaLote({ open: false })}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-extrabold text-gray-900 text-lg">
                {modalProveedor.editando ? 'Editar Proveedor' : 'Registrar Proveedor'}
              </h3>
              <button onClick={() => setModalProveedor({ open: false })} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarProveedor} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Razón Social *</label>
                <input
                  type="text"
                  required
                  value={formProv.nombre}
                  onChange={(e) => setFormProv({ ...formProv, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Contacto</label>
                  <input
                    type="text"
                    value={formProv.contacto_nombre}
                    onChange={(e) => setFormProv({ ...formProv, contacto_nombre: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lead Time (Días)</label>
                  <input
                    type="number"
                    min="0"
                    value={formProv.lead_time_dias}
                    onChange={(e) => setFormProv({ ...formProv, lead_time_dias: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalProveedor({ open: false })}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-quantix-600 hover:bg-quantix-700 rounded-xl shadow-md"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-extrabold text-gray-900 text-lg">
                {modalCategoria.editando ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button onClick={() => setModalCategoria({ open: false })} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarCategoria} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={formCat.nombre}
                  onChange={(e) => setFormCat({ ...formCat, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={formCat.descripcion}
                  onChange={(e) => setFormCat({ ...formCat, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalCategoria({ open: false })}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-quantix-600 hover:bg-quantix-700 rounded-xl shadow-md"
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
    </div>
  );
}
