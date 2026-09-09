import { useState, useEffect, useCallback } from 'react';
import { 
  Users, UserPlus, Search, Award, 
  Tag, CheckCircle2, Eye, Edit3, 
  Trash2, X, Plus, RefreshCw, ShoppingBag, Ban,
  Sparkles, Download
} from 'lucide-react';
import api from '../services/api';
import { exportToCSV, formatDate, formatBoolean } from '../utils/exportUtils';
import { mostrarToast } from '../hooks/useWebSocket';

interface Cliente {
  id: string;
  cedula?: string | null;
  telefono: string;
  nombre: string;
  email: string | null;
  puntos_acumulados: number;
  activo: boolean;
  fecha_registro: string;
}

interface Cupon {
  id: string;
  cliente_id: string;
  cliente_nombre?: string;
  codigo: string;
  tipo: string;
  descuento_tipo: string;
  descuento_valor: number;
  valido_desde: string;
  valido_hasta: string;
  estado: string;
  creado_en: string;
}

interface VentaHistorial {
  id: string;
  folio_ticket: string;
  fecha_hora: string;
  total_bruto: number;
  total_descuento: number;
  total_pagar: number;
  estado: string;
}

interface ReglaPromocionItem {
  id: string;
  nombre: string;
  tipo_regla: 'COMBO' | 'VOLUMEN' | 'MONTO_MINIMO';
  producto_disparador_id?: string | null;
  producto_disparador_nombre?: string | null;
  producto_beneficio_id?: string | null;
  producto_beneficio_nombre?: string | null;
  categoria_id?: string | null;
  categoria_nombre?: string | null;
  descuento_tipo: 'PORCENTAJE' | 'MONTO_FIJO';
  descuento_valor: number;
  cantidad_minima: number;
  monto_minimo: number;
  activo: boolean;
  creado_en: string;
}

interface CatalogoItem {
  id: string;
  nombre: string;
  sku?: string;
}

export default function Clientes() {
  const [activeTab, setActiveTab] = useState<'CLIENTES' | 'CUPONES' | 'PROMOCIONES'>('CLIENTES');
  const [loading, setLoading] = useState(false);

  // Clientes
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [soloActivos, setSoloActivos] = useState(false);

  // Cupones
  const [cupones, setCupones] = useState<Cupon[]>([]);

  // Promociones y Combos
  const [reglasPromocion, setReglasPromocion] = useState<ReglaPromocionItem[]>([]);
  const [productosCatalogo, setProductosCatalogo] = useState<CatalogoItem[]>([]);
  const [categoriasCatalogo, setCategoriasCatalogo] = useState<CatalogoItem[]>([]);
  const [showModalCrearPromo, setShowModalCrearPromo] = useState(false);
  const [formPromo, setFormPromo] = useState({
    nombre: '',
    tipo_regla: 'COMBO' as 'COMBO' | 'VOLUMEN' | 'MONTO_MINIMO',
    producto_disparador_id: '',
    producto_beneficio_id: '',
    categoria_id: '',
    descuento_tipo: 'PORCENTAJE' as 'PORCENTAJE' | 'MONTO_FIJO',
    descuento_valor: 10,
    cantidad_minima: 1,
    monto_minimo: 0,
  });

  // Modales de detalle
  const [detalleCliente, setDetalleCliente] = useState<Cliente | null>(null);
  const [historialVentas, setHistorialVentas] = useState<VentaHistorial[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [detalleCupon, setDetalleCupon] = useState<Cupon | null>(null);

  // Modales de CRUD Cliente
  const [showModalCrearCliente, setShowModalCrearCliente] = useState(false);
  const [clienteAEditar, setClienteAEditar] = useState<Cliente | null>(null);
  const [formCliente, setFormCliente] = useState({
    cedula: '',
    nombre: '',
    telefono: '',
    email: '',
  });

  // Modales de CRUD Cupón
  const [showModalCrearCupon, setShowModalCrearCupon] = useState(false);
  const [formCupon, setFormCupon] = useState({
    cliente_id: '',
    codigo: '',
    tipo: 'MANUAL',
    descuento_tipo: 'PORCENTAJE',
    descuento_valor: 10,
    valido_desde: '',
    valido_hasta: '',
  });

  const [notificacion, setNotificacion] = useState<string | null>(null);

  const mostrarAviso = (msg: string, severidad: 'SUCCESS' | 'CRITICO' | 'WARNING' | 'INFO' = 'SUCCESS') => {
    setNotificacion(msg);
    mostrarToast({
      titulo: severidad === 'CRITICO' ? 'Error en Clientes / CRM' : 'Clientes & CRM',
      mensaje: msg,
      severidad,
    });
    setTimeout(() => setNotificacion(null), 3500);
  };

  const cargarClientes = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (soloActivos) params.append('activo_only', 'true');
      if (query.trim()) params.append('q', query.trim());
      const res = await api.get(`/crm/clientes?${params.toString()}`);
      setClientes(res.data);
    } catch {
      setClientes([]);
      mostrarAviso('No se pudo cargar el directorio de clientes.');
    } finally {
      setLoading(false);
    }
  }, [soloActivos]);

  const cargarCupones = async () => {
    try {
      const res = await api.get('/crm/cupones');
      setCupones(res.data);
    } catch {
      setCupones([]);
      mostrarAviso('No se pudieron cargar los cupones.');
    }
  };

  const cargarPromociones = async () => {
    try {
      const res = await api.get('/promociones/');
      setReglasPromocion(res.data);
    } catch {
      setReglasPromocion([]);
      mostrarAviso('No se pudieron cargar las promociones.');
    }
  };

  const cargarCatalogos = async () => {
    try {
      const [resP, resC] = await Promise.allSettled([
        api.get('/inventario/productos'),
        api.get('/inventario/categorias')
      ]);
      if (resP.status === 'fulfilled' && Array.isArray(resP.value.data)) {
        setProductosCatalogo(resP.value.data.map((p: any) => ({ id: p.id, nombre: p.nombre, sku: p.sku })));
      }
      if (resC.status === 'fulfilled' && Array.isArray(resC.value.data)) {
        setCategoriasCatalogo(resC.value.data.map((c: any) => ({ id: c.id, nombre: c.nombre })));
      }
    } catch {
      setProductosCatalogo([]);
      setCategoriasCatalogo([]);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void cargarClientes();
      void cargarCupones();
      void cargarPromociones();
      void cargarCatalogos();
    });
  }, [cargarClientes]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    cargarClientes(searchQuery);
  };

  const verDetalleCliente = async (cliente: Cliente) => {
    setDetalleCliente(cliente);
    setLoadingHistorial(true);
    try {
      const res = await api.get(`/crm/clientes/${cliente.id}/historial`);
      setHistorialVentas(res.data);
    } catch {
      setHistorialVentas([]);
      mostrarAviso('No se pudo cargar el historial real del cliente.');
    } finally {
      setLoadingHistorial(false);
    }
  };

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/crm/clientes', {
        cedula: formCliente.cedula.trim() || null,
        nombre: formCliente.nombre.trim(),
        telefono: formCliente.telefono.trim(),
        email: formCliente.email.trim() || null,
      });
      mostrarAviso('¡Cliente registrado exitosamente!');
      setShowModalCrearCliente(false);
      setFormCliente({ cedula: '', nombre: '', telefono: '', email: '' });
      cargarClientes();
    } catch (err: any) {
      mostrarAviso(err.response?.data?.detail || 'Error al registrar cliente', 'CRITICO');
    }
  };

  const handleActualizarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteAEditar) return;
    try {
      await api.put(`/crm/clientes/${clienteAEditar.id}`, {
        cedula: formCliente.cedula.trim() || null,
        nombre: formCliente.nombre.trim(),
        telefono: formCliente.telefono.trim(),
        email: formCliente.email.trim() || null,
      });
      mostrarAviso('¡Datos de cliente actualizados!');
      setClienteAEditar(null);
      setFormCliente({ cedula: '', nombre: '', telefono: '', email: '' });
      cargarClientes();
    } catch (err: any) {
      mostrarAviso(err.response?.data?.detail || 'Error al actualizar cliente', 'CRITICO');
    }
  };

  const handleBajaLogicaCliente = async (cliente: Cliente) => {
    const accion = cliente.activo ? 'dar de baja lógica' : 'reactivar';
    if (!confirm(`¿Confirmas que deseas ${accion} al cliente "${cliente.nombre}"?`)) return;

    try {
      if (cliente.activo) {
        await api.delete(`/crm/clientes/${cliente.id}`);
        mostrarAviso('Cliente desactivado lógicamente (historial preservado)');
      } else {
        await api.put(`/crm/clientes/${cliente.id}`, { activo: true });
        mostrarAviso('¡Cliente reactivado con éxito!');
      }
      cargarClientes();
      if (detalleCliente && detalleCliente.id === cliente.id) {
        setDetalleCliente({ ...detalleCliente, activo: !cliente.activo });
      }
    } catch (err: any) {
      mostrarAviso(err.response?.data?.detail || 'Error al cambiar estado del cliente', 'CRITICO');
    }
  };

  const handleCrearCupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/crm/cupones', {
        cliente_id: formCupon.cliente_id,
        codigo: formCupon.codigo,
        tipo: formCupon.tipo,
        descuento_tipo: formCupon.descuento_tipo,
        descuento_valor: Number(formCupon.descuento_valor),
        valido_desde: formCupon.valido_desde ? new Date(formCupon.valido_desde).toISOString() : null,
        valido_hasta: formCupon.valido_hasta ? new Date(formCupon.valido_hasta).toISOString() : null,
      });
      mostrarAviso('¡Cupón emitido con éxito!');
      setShowModalCrearCupon(false);
      setFormCupon({
        cliente_id: '',
        codigo: '',
        tipo: 'MANUAL',
        descuento_tipo: 'PORCENTAJE',
        descuento_valor: 10,
        valido_desde: '',
        valido_hasta: '',
      });
      cargarCupones();
    } catch (err: any) {
      mostrarAviso(err.response?.data?.detail || 'Error al emitir cupón', 'CRITICO');
    }
  };

  const handleBajaLogicaCupon = async (cupon: Cupon) => {
    if (!confirm(`¿Deseas dar de baja lógica al cupón "${cupon.codigo}" marcándolo como EXPIRADO?`)) return;
    try {
      await api.delete(`/crm/cupones/${cupon.id}`);
      mostrarAviso('Cupón dado de baja lógica (estado EXPIRADO)');
      cargarCupones();
      if (detalleCupon && detalleCupon.id === cupon.id) {
        setDetalleCupon({ ...detalleCupon, estado: 'EXPIRADO' });
      }
    } catch (err: any) {
      mostrarAviso(err.response?.data?.detail || 'Error al expirar cupón', 'CRITICO');
    }
  };

  const handleCrearPromocion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/promociones/', {
        nombre: formPromo.nombre,
        tipo_regla: formPromo.tipo_regla,
        producto_disparador_id: formPromo.producto_disparador_id || null,
        producto_beneficio_id: formPromo.producto_beneficio_id || null,
        categoria_id: formPromo.categoria_id || null,
        descuento_tipo: formPromo.descuento_tipo,
        descuento_valor: Number(formPromo.descuento_valor),
        cantidad_minima: Number(formPromo.cantidad_minima),
        monto_minimo: Number(formPromo.monto_minimo),
        activo: true,
      });
      mostrarAviso('¡Regla de promoción creada exitosamente!');
      setShowModalCrearPromo(false);
      setFormPromo({
        nombre: '',
        tipo_regla: 'COMBO',
        producto_disparador_id: '',
        producto_beneficio_id: '',
        categoria_id: '',
        descuento_tipo: 'PORCENTAJE',
        descuento_valor: 10,
        cantidad_minima: 1,
        monto_minimo: 0,
      });
      cargarPromociones();
    } catch (err: any) {
      mostrarAviso(err.response?.data?.detail || 'Error al crear la regla de promoción', 'CRITICO');
    }
  };

  const handleBajaLogicaPromocion = async (regla: ReglaPromocionItem) => {
    const accion = regla.activo ? 'desactivar (baja lógica)' : 'reactivar';
    if (!confirm(`¿Confirmas que deseas ${accion} la regla "${regla.nombre}"?`)) return;

    try {
      if (regla.activo) {
        await api.delete(`/promociones/${regla.id}`);
        mostrarAviso('Regla desactivada con éxito (baja lógica preservada)');
      } else {
        await api.put(`/promociones/${regla.id}`, { activo: true });
        mostrarAviso('¡Regla reactivada con éxito!');
      }
    } catch (err: any) {
      mostrarAviso(err.response?.data?.detail || 'Error al modificar estado de la regla', 'CRITICO');
    }
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto bg-background text-on-surface select-none">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-high/60 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-primary-fixed/30 text-on-primary-fixed-variant rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
              Nivel Operativo • Piso & Fidelización
            </span>
          </div>
          <h2 className="font-headline-xl text-2xl md:text-3xl font-bold text-on-surface tracking-tight mt-2">
            Clientes, Fidelización & Promociones
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Directorio maestro RFM, monedero de lealtad, emisión de cupones y reglas de combo
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              cargarClientes();
              cargarCupones();
              cargarPromociones();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-surface-container-high hover:bg-surface-container text-on-surface rounded-full font-title-md text-body-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'CLIENTES') {
                exportToCSV({
                  filename: `padron_clientes_quantix_${new Date().toISOString().slice(0, 10)}.csv`,
                  data: clientes,
                  columns: [
                    { key: 'nombre', header: 'Nombre Cliente' },
                    { key: 'telefono', header: 'Teléfono' },
                    { key: 'email', header: 'Correo Electrónico', formatter: (v) => v || 'N/A' },
                    { key: 'puntos_acumulados', header: 'Puntos Acumulados' },
                    { key: 'activo', header: 'Activo', formatter: (v) => formatBoolean(v) },
                    { key: 'fecha_registro', header: 'Fecha Registro', formatter: (v) => formatDate(v) }
                  ]
                });
              } else if (activeTab === 'CUPONES') {
                exportToCSV({
                  filename: `cupones_fidelizacion_${new Date().toISOString().slice(0, 10)}.csv`,
                  data: cupones,
                  columns: [
                    { key: 'codigo', header: 'Código Cupón' },
                    { key: 'tipo', header: 'Tipo Cupón' },
                    { key: 'descuento_tipo', header: 'Tipo Descuento' },
                    { key: 'descuento_valor', header: 'Valor Descuento' },
                    { key: 'estado', header: 'Estado' },
                    { key: 'cliente_nombre', header: 'Cliente Asignado', formatter: (v) => v || 'General' },
                    { key: 'valido_desde', header: 'Válido Desde', formatter: (v) => formatDate(v) },
                    { key: 'valido_hasta', header: 'Válido Hasta', formatter: (v) => formatDate(v) }
                  ]
                });
              } else {
                exportToCSV({
                  filename: `reglas_promociones_${new Date().toISOString().slice(0, 10)}.csv`,
                  data: reglasPromocion,
                  columns: [
                    { key: 'nombre', header: 'Nombre Regla' },
                    { key: 'tipo_regla', header: 'Tipo' },
                    { key: 'descuento_tipo', header: 'Tipo Descuento' },
                    { key: 'descuento_valor', header: 'Descuento' },
                    { key: 'monto_minimo', header: 'Monto Mínimo' },
                    { key: 'cantidad_minima', header: 'Cantidad Mínima' },
                    { key: 'activo', header: 'Activa', formatter: (v) => formatBoolean(v) }
                  ]
                });
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-surface-container-high text-on-surface hover:bg-surface-container rounded-full font-title-md text-body-sm shadow-xs transition-all cursor-pointer"
            title="Exportar registros a CSV / Excel"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Exportar CSV</span>
          </button>

          {activeTab === 'CLIENTES' ? (
            <button
              onClick={() => {
                setFormCliente({ cedula: '', nombre: '', telefono: '', email: '' });
                setShowModalCrearCliente(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-container hover:bg-primary-container/90 text-on-primary-container rounded-full font-title-md text-body-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuevo Cliente</span>
            </button>
          ) : activeTab === 'CUPONES' ? (
            <button
              onClick={() => {
                if (clientes.length > 0) {
                  setFormCupon({
                    ...formCupon,
                    cliente_id: clientes[0].id,
                    codigo: `PROMO-${Math.floor(100 + Math.random() * 900)}`
                  });
                }
                setShowModalCrearCupon(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-container hover:bg-primary-container/90 text-on-primary-container rounded-full font-title-md text-body-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Emitir Cupón</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setShowModalCrearPromo(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-container hover:bg-primary-container/90 text-on-primary-container rounded-full font-title-md text-body-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Nueva Promoción</span>
            </button>
          )}
        </div>
      </div>

      {notificacion && (
        <div className="bg-primary-fixed/30 border border-primary-fixed text-on-primary-fixed-variant text-body-sm p-4 rounded-2xl mb-6 flex items-center gap-2.5 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <span className="font-bold">{notificacion}</span>
        </div>
      )}

      {/* KPI Cards CRM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-surface-container-high/60 flex items-center justify-between">
          <div>
            <span className="font-label-caps text-[10px] font-bold text-outline uppercase tracking-wider">Clientes Registrados</span>
            <p className="font-headline-md text-2xl font-bold text-on-surface mt-1">{clientes.length} Clientes</p>
            <span className="font-body-sm text-[11px] text-primary font-semibold">
              {clientes.filter(c => c.activo).length} Activos en plataforma
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary-fixed/30 flex items-center justify-center text-primary">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-surface-container-high/60 flex items-center justify-between">
          <div>
            <span className="font-label-caps text-[10px] font-bold text-outline uppercase tracking-wider">Puntos de Lealtad</span>
            <p className="font-headline-md text-2xl font-bold text-primary mt-1">
              {clientes.reduce((acc, c) => acc + (c.puntos_acumulados || 0), 0)} pts
            </p>
            <span className="font-body-sm text-[11px] text-outline font-medium">Acumulados en monedero</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary-fixed/20 flex items-center justify-center text-primary">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-surface-container-high/60 flex items-center justify-between">
          <div>
            <span className="font-label-caps text-[10px] font-bold text-tertiary uppercase tracking-wider">Cupones Vigentes</span>
            <p className="font-headline-md text-2xl font-bold text-tertiary mt-1">
              {cupones.filter(cp => cp.estado === 'EMITIDO').length} Cupones
            </p>
            <span className="font-body-sm text-[11px] text-outline font-medium">Listos para canje en POS</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-surface-container-high/60 flex items-center justify-between">
          <div>
            <span className="font-label-caps text-[10px] font-bold text-secondary uppercase tracking-wider">Promociones Activas</span>
            <p className="font-headline-md text-2xl font-bold text-secondary mt-1">
              {reglasPromocion.filter(r => r.activo).length} Reglas
            </p>
            <span className="font-body-sm text-[11px] text-outline font-medium">Motor de Combos en Caja</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Selector de Pestañas — SegmentedControl Neo-Retail */}
      <div className="inline-flex p-1 bg-surface-container-low rounded-full gap-1 mb-6">
        <button
          onClick={() => setActiveTab('CLIENTES')}
          className={`px-5 py-2 rounded-full font-title-md text-body-sm transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'CLIENTES'
              ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Directorio de Clientes ({clientes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CUPONES')}
          className={`px-5 py-2 rounded-full font-title-md text-body-sm transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'CUPONES'
              ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Cupones de Descuento ({cupones.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PROMOCIONES')}
          className={`px-5 py-2 rounded-full font-title-md text-body-sm transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'PROMOCIONES'
              ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Motor de Promociones ({reglasPromocion.length})</span>
        </button>
      </div>

      {/* PESTAÑA 1: CLIENTES */}
      {activeTab === 'CLIENTES' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Barra de Filtros */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between bg-gray-50/50">
            <form onSubmit={handleBuscar} className="flex gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por teléfono o nombre de cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-quantix-500"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
              >
                Buscar
              </button>
            </form>

            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
                className="rounded text-quantix-600 focus:ring-quantix-500"
              />
              <span>Mostrar solo clientes activos</span>
            </label>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/20 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-3.5 px-4">Nombre Completo</th>
                <th className="py-3.5 px-4">Teléfono (ID)</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4 text-center">Puntos Acumulados</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No se encontraron clientes registrados con los filtros aplicados
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr 
                    key={c.id} 
                    onClick={() => verDetalleCliente(c)}
                    className="hover:bg-quantix-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-bold text-gray-900 group-hover:text-quantix-700">
                      <div>{c.nombre}</div>
                      {c.cedula && (
                        <div className="text-[11px] font-mono text-gray-500 font-normal">
                          Cédula: {c.cedula}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-700 font-semibold">
                      {c.telefono}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {c.email || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-quantix-600">
                      {c.puntos_acumulados} pts
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        c.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {c.activo ? 'Activo' : 'Inactivo (Baja Lógica)'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => verDetalleCliente(c)}
                          className="p-1.5 hover:bg-quantix-100 text-quantix-600 rounded-lg transition-colors"
                          title="Ver Ficha y Compras"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setClienteAEditar(c);
                            setFormCliente({
                              cedula: c.cedula || '',
                              nombre: c.nombre,
                              telefono: c.telefono,
                              email: c.email || '',
                            });
                          }}
                          className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                          title="Editar Datos"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleBajaLogicaCliente(c)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            c.activo ? 'hover:bg-red-100 text-red-600' : 'hover:bg-emerald-100 text-emerald-600'
                          }`}
                          title={c.activo ? "Dar de baja lógica" : "Reactivar cliente"}
                        >
                          {c.activo ? <Trash2 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA 2: CUPONES */}
      {activeTab === 'CUPONES' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Cupones de Descuento Emitidos</h3>
              <p className="text-xs text-gray-400">Haz clic en cualquier cupón para ver los detalles de emisión y validación</p>
            </div>
            <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-bold border border-purple-200">
              {cupones.length} Registros
            </span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/20 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-3.5 px-4">Código Promocional</th>
                <th className="py-3.5 px-4">Cliente Beneficiario</th>
                <th className="py-3.5 px-4 text-center">Tipo de Cupón</th>
                <th className="py-3.5 px-4 text-center">Descuento</th>
                <th className="py-3.5 px-4">Vigencia</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {cupones.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">No hay cupones emitidos</td>
                </tr>
              ) : (
                cupones.map((cp) => (
                  <tr 
                    key={cp.id} 
                    onClick={() => setDetalleCupon(cp)}
                    className="hover:bg-quantix-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-quantix-600 text-sm">
                      {cp.codigo}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-800">
                      {cp.cliente_nombre || 'Cliente Asignado'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold text-[11px]">
                        {cp.tipo}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-black text-gray-900">
                      {cp.descuento_tipo === 'PORCENTAJE' ? `${Number(cp.descuento_valor)}% OFF` : `$${Number(cp.descuento_valor).toFixed(2)} OFF`}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {cp.valido_desde} al {cp.valido_hasta}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        cp.estado === 'EMITIDO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : cp.estado === 'CANJEADO'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {cp.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDetalleCupon(cp)}
                          className="p-1.5 hover:bg-quantix-100 text-quantix-600 rounded-lg transition-colors"
                          title="Ver Detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {cp.estado === 'EMITIDO' && (
                          <button
                            onClick={() => handleBajaLogicaCupon(cp)}
                            className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                            title="Expirar / Baja Lógica"
                          >
                            <Ban className="w-4 h-4" />
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
      )}

      {/* PESTAÑA 3: PROMOCIONES & COMBOS */}
      {activeTab === 'PROMOCIONES' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Reglas de Promociones Automáticas</h3>
              <p className="text-xs text-gray-400">Combos inteligentes, mayoreo por volumen y descuentos por monto mínimo aplicados al checkout</p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-bold border border-amber-200">
              {reglasPromocion.length} Reglas Registradas
            </span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/20 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-3.5 px-4">Nombre de Regla</th>
                <th className="py-3.5 px-4 text-center">Tipo</th>
                <th className="py-3.5 px-4">Condición / Parámetros</th>
                <th className="py-3.5 px-4 text-center">Descuento</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {reglasPromocion.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No hay reglas de promoción configuradas
                  </td>
                </tr>
              ) : (
                reglasPromocion.map((regla) => (
                  <tr key={regla.id} className="hover:bg-quantix-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      {regla.nombre}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                        regla.tipo_regla === 'COMBO'
                          ? 'bg-purple-100 text-purple-800'
                          : regla.tipo_regla === 'VOLUMEN'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {regla.tipo_regla}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {regla.tipo_regla === 'COMBO' ? (
                        <div className="flex flex-col gap-0.5">
                          <span><span className="font-semibold text-gray-700">Disparador:</span> {regla.producto_disparador_nombre || 'Producto Base'}</span>
                          <span><span className="font-semibold text-gray-700">Beneficio:</span> {regla.producto_beneficio_nombre || 'Producto Bonificado'}</span>
                        </div>
                      ) : regla.tipo_regla === 'VOLUMEN' ? (
                        <span>
                          <span className="font-semibold text-gray-700">Mínimo:</span> {Number(regla.cantidad_minima)} unidades
                          {regla.categoria_nombre && ` (Categoría: ${regla.categoria_nombre})`}
                          {regla.producto_disparador_nombre && ` (Producto: ${regla.producto_disparador_nombre})`}
                        </span>
                      ) : (
                        <span>
                          <span className="font-semibold text-gray-700">Subtotal Mínimo:</span> ${Number(regla.monto_minimo).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-black text-gray-900">
                      {regla.descuento_tipo === 'PORCENTAJE'
                        ? `${Number(regla.descuento_valor)}% OFF`
                        : `$${Number(regla.descuento_valor).toFixed(2)} OFF`}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        regla.activo
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {regla.activo ? 'ACTIVA' : 'INACTIVA'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleBajaLogicaPromocion(regla)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          regla.activo
                            ? 'hover:bg-red-100 text-red-600'
                            : 'hover:bg-emerald-100 text-emerald-600'
                        }`}
                        title={regla.activo ? 'Desactivar (Baja Lógica)' : 'Reactivar Promoción'}
                      >
                        {regla.activo ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= MODAL DETALLE CLIENTE & HISTORIAL ================= */}
      {detalleCliente && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div>
                <span className="px-2.5 py-0.5 bg-primary text-on-primary rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Ficha de Cliente CRM
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">{detalleCliente.nombre}</h3>
                <p className="font-body-sm font-mono text-outline">ID: {detalleCliente.id}</p>
              </div>
              <button 
                onClick={() => setDetalleCliente(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-body-sm">
              {/* Tarjetas de Datos de Contacto y Fidelización */}
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high/40">
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Cédula / Identificación:</span>
                  <p className="font-title-md text-body-sm font-mono font-bold text-on-surface">{detalleCliente.cedula || 'No registrada'}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Teléfono / Celular:</span>
                  <p className="font-title-md text-body-sm font-mono font-bold text-on-surface">{detalleCliente.telefono}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Correo Electrónico:</span>
                  <p className="font-title-md text-body-sm font-semibold text-on-surface">{detalleCliente.email || 'Sin correo asociado'}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Monedero de Lealtad:</span>
                  <p className="font-headline-md text-title-md font-black text-primary">{detalleCliente.puntos_acumulados} puntos</p>
                </div>
                <div className="col-span-2">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Estado de Cuenta:</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase ${
                    detalleCliente.activo ? 'bg-primary-fixed/30 text-on-primary-fixed-variant' : 'bg-surface-container-highest text-on-surface-variant'
                  }`}>
                    {detalleCliente.activo ? 'Activo' : 'Inactivo (Baja Lógica)'}
                  </span>
                </div>
              </div>

              {/* Historial de Compras */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                    Historial de Compras & Tickets
                  </span>
                  <span className="font-mono text-[11px] text-outline">{historialVentas.length} Tickets</span>
                </div>

                {loadingHistorial ? (
                  <div className="text-center py-6 text-on-surface-variant">Cargando tickets...</div>
                ) : historialVentas.length === 0 ? (
                  <div className="text-center py-6 bg-surface-container-low rounded-2xl text-on-surface-variant border border-surface-container-high/40">
                    Este cliente no tiene compras previas registradas.
                  </div>
                ) : (
                  <div className="border border-surface-container-high/40 rounded-2xl overflow-hidden divide-y divide-surface-container-low max-h-48 overflow-y-auto">
                    {historialVentas.map((v) => (
                      <div key={v.id} className="p-3 flex justify-between items-center bg-surface-container-lowest hover:bg-surface-container-low/70 transition-colors">
                        <div>
                          <span className="font-bold font-mono text-on-surface block text-body-sm">{v.folio_ticket}</span>
                          <span className="text-[10px] text-outline">
                            {new Date(v.fecha_hora).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-headline-md font-bold text-on-surface block text-body-sm">${Number(v.total_pagar).toFixed(2)}</span>
                          <span className={`inline-block text-[10px] font-bold font-label-caps uppercase ${
                            v.estado === 'COMPLETADA' ? 'text-primary' : 'text-error'
                          }`}>
                            {v.estado}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-low flex justify-between items-center">
              <button
                onClick={() => handleBajaLogicaCliente(detalleCliente)}
                className={`px-4 py-2 font-title-md text-body-sm font-bold rounded-full cursor-pointer transition-colors shadow-xs ${
                  detalleCliente.activo 
                    ? 'text-error bg-surface-container-lowest hover:bg-error-container' 
                    : 'text-primary bg-surface-container-lowest hover:bg-primary-fixed/30'
                }`}
              >
                {detalleCliente.activo ? 'Dar de Baja Lógica' : 'Reactivar Cliente'}
              </button>
              <button
                onClick={() => setDetalleCliente(null)}
                className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DETALLE CUPÓN ================= */}
      {detalleCupon && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95 flex flex-col">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div>
                <span className="px-2.5 py-0.5 bg-secondary text-on-secondary rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Cupón Promocional
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">Detalle de Cupón</h3>
                <p className="font-body-sm font-mono text-outline">{detalleCupon.id}</p>
              </div>
              <button onClick={() => setDetalleCupon(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-body-sm">
              <div className="text-center p-5 bg-surface-container-low rounded-2xl border border-surface-container-high/40">
                <span className="font-label-caps text-[10px] text-outline font-bold uppercase tracking-wider block">Código Promocional</span>
                <span className="text-2xl font-black font-mono text-on-surface tracking-wider my-1.5 block">
                  {detalleCupon.codigo}
                </span>
                <span className="px-3 py-1 font-label-caps text-[11px] font-bold text-on-secondary-container bg-secondary-container rounded-full inline-block">
                  {detalleCupon.descuento_tipo === 'PORCENTAJE' ? `${detalleCupon.descuento_valor}% DE DESCUENTO` : `$${detalleCupon.descuento_valor} OFF DIRECTO`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high/40">
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Cliente Asignado:</span>
                  <p className="font-title-md text-body-sm font-bold text-on-surface">{detalleCupon.cliente_nombre || 'N/A'}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Tipo:</span>
                  <p className="font-title-md text-body-sm font-bold text-on-surface">{detalleCupon.tipo}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Válido Desde:</span>
                  <p className="font-mono text-body-sm text-on-surface">{detalleCupon.valido_desde}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Válido Hasta:</span>
                  <p className="font-mono text-body-sm text-on-surface">{detalleCupon.valido_hasta}</p>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 rounded-2xl bg-surface-container-low border border-surface-container-high/40">
                <span className="font-label-caps text-[10px] text-outline font-bold uppercase">Estado del Cupón:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase ${
                  detalleCupon.estado === 'EMITIDO'
                    ? 'bg-primary-fixed/30 text-on-primary-fixed-variant'
                    : detalleCupon.estado === 'CANJEADO'
                    ? 'bg-secondary-fixed/30 text-on-secondary-fixed-variant'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}>
                  {detalleCupon.estado}
                </span>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-low flex justify-between items-center">
              {detalleCupon.estado === 'EMITIDO' && (
                <button
                  onClick={() => handleBajaLogicaCupon(detalleCupon)}
                  className="px-4 py-2 font-title-md text-body-sm font-bold rounded-full text-error bg-surface-container-lowest hover:bg-error-container cursor-pointer transition-colors shadow-xs"
                >
                  Expirar Cupón (Baja Lógica)
                </button>
              )}
              <button
                onClick={() => setDetalleCupon(null)}
                className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors ml-auto"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL CREAR CLIENTE ================= */}
      {showModalCrearCliente && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-center bg-surface-container-low/50">
              <h3 className="font-headline-md text-title-lg font-bold text-on-surface">Registrar Nuevo Cliente</h3>
              <button onClick={() => setShowModalCrearCliente(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearCliente} className="p-6 space-y-4 text-body-sm">
              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Cédula / Documento de Identidad
                </label>
                <input
                  type="text"
                  value={formCliente.cedula}
                  onChange={(e) => setFormCliente({ ...formCliente, cedula: e.target.value })}
                  placeholder="Ej. 12345678"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-mono text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formCliente.nombre}
                  onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
                  placeholder="Ej. Roberto Martínez"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Teléfono Móvil (ID en Caja) *
                </label>
                <input
                  type="tel"
                  required
                  value={formCliente.telefono}
                  onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
                  placeholder="Ej. 5512345678"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-mono text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Correo Electrónico (Opcional)
                </label>
                <input
                  type="email"
                  value={formCliente.email}
                  onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div className="pt-3 border-t border-surface-container-low flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModalCrearCliente(false)}
                  className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-title-md text-body-sm font-bold bg-primary hover:opacity-95 text-on-primary rounded-full cursor-pointer transition-colors shadow-xs"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDITAR CLIENTE ================= */}
      {clienteAEditar && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-center bg-surface-container-low/50">
              <h3 className="font-headline-md text-title-lg font-bold text-on-surface">Modificar Cliente</h3>
              <button onClick={() => setClienteAEditar(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActualizarCliente} className="p-6 space-y-4 text-body-sm">
              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Cédula / Documento de Identidad
                </label>
                <input
                  type="text"
                  value={formCliente.cedula}
                  onChange={(e) => setFormCliente({ ...formCliente, cedula: e.target.value })}
                  placeholder="Ej. 12345678"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-mono text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={formCliente.nombre}
                  onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Teléfono
                </label>
                <input
                  type="tel"
                  required
                  value={formCliente.telefono}
                  onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-mono text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={formCliente.email}
                  onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div className="pt-3 border-t border-surface-container-low flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setClienteAEditar(null)}
                  className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-title-md text-body-sm font-bold bg-primary hover:opacity-95 text-on-primary rounded-full cursor-pointer transition-colors shadow-xs"
                >
                  Actualizar Datos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EMITIR CUPÓN ================= */}
      {showModalCrearCupon && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-center bg-surface-container-low/50">
              <h3 className="font-headline-md text-title-lg font-bold text-on-surface">Emitir Nuevo Cupón de Fidelización</h3>
              <button onClick={() => setShowModalCrearCupon(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearCupon} className="p-6 space-y-4 text-body-sm">
              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Cliente Beneficiario *
                </label>
                <select
                  required
                  value={formCupon.cliente_id}
                  onChange={(e) => setFormCupon({ ...formCupon, cliente_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 cursor-pointer"
                >
                  <option value="">Seleccione un cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.telefono})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Código del Cupón *
                </label>
                <input
                  type="text"
                  required
                  value={formCupon.codigo}
                  onChange={(e) => setFormCupon({ ...formCupon, codigo: e.target.value.toUpperCase() })}
                  placeholder="Ej. VERANO20"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-mono uppercase font-bold text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                    Tipo Promoción
                  </label>
                  <select
                    value={formCupon.tipo}
                    onChange={(e) => setFormCupon({ ...formCupon, tipo: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 cursor-pointer"
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="CUMPLEANIOS">Cumpleaños</option>
                    <option value="REACTIVACION">Reactivación</option>
                    <option value="COMBO">Combo</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                    Tipo Descuento
                  </label>
                  <select
                    value={formCupon.descuento_tipo}
                    onChange={(e) => setFormCupon({ ...formCupon, descuento_tipo: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 cursor-pointer"
                  >
                    <option value="PORCENTAJE">Porcentaje (%)</option>
                    <option value="MONTO_FIJO">Monto Fijo ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Valor del Descuento *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formCupon.descuento_valor}
                  onChange={(e) => setFormCupon({ ...formCupon, descuento_valor: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-headline-md font-bold text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div className="pt-3 border-t border-surface-container-low flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModalCrearCupon(false)}
                  className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-title-md text-body-sm font-bold bg-primary hover:opacity-95 text-on-primary rounded-full cursor-pointer transition-colors shadow-xs"
                >
                  Emitir Cupón
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CREAR PROMOCIÓN ================= */}
      {showModalCrearPromo && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-center bg-surface-container-low/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-900 dark:text-amber-200 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface">Nueva Regla de Promoción</h3>
              </div>
              <button onClick={() => setShowModalCrearPromo(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearPromocion} className="p-6 space-y-4 text-body-sm overflow-y-auto flex-1">
              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Nombre de la Promoción *
                </label>
                <input
                  type="text"
                  required
                  value={formPromo.nombre}
                  onChange={(e) => setFormPromo({ ...formPromo, nombre: e.target.value })}
                  placeholder="Ej. Combo Desayuno 50% en Donas"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                />
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Tipo de Regla *
                </label>
                <select
                  value={formPromo.tipo_regla}
                  onChange={(e) => setFormPromo({ ...formPromo, tipo_regla: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 cursor-pointer"
                >
                  <option value="COMBO">COMBO (Producto A dispara beneficio en Producto B)</option>
                  <option value="VOLUMEN">VOLUMEN (Cantidad mínima de producto o categoría)</option>
                  <option value="MONTO_MINIMO">MONTO MÍNIMO (Ticket superior a cierto monto)</option>
                </select>
              </div>

              {/* Campos dinámicos según tipo de regla */}
              {formPromo.tipo_regla === 'COMBO' && (
                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40 space-y-3">
                  <div>
                    <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                      Producto Disparador (A) *
                    </label>
                    <select
                      value={formPromo.producto_disparador_id}
                      onChange={(e) => setFormPromo({ ...formPromo, producto_disparador_id: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 cursor-pointer"
                      required
                    >
                      <option value="">Seleccione el producto disparador...</option>
                      {productosCatalogo.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.sku ? `(${p.sku})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                      Producto Beneficio (B) *
                    </label>
                    <select
                      value={formPromo.producto_beneficio_id}
                      onChange={(e) => setFormPromo({ ...formPromo, producto_beneficio_id: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 cursor-pointer"
                      required
                    >
                      <option value="">Seleccione el producto beneficio...</option>
                      {productosCatalogo.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.sku ? `(${p.sku})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {formPromo.tipo_regla === 'VOLUMEN' && (
                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40 space-y-3">
                  <div>
                    <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                      Cantidad Mínima Requerida *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={formPromo.cantidad_minima}
                      onChange={(e) => setFormPromo({ ...formPromo, cantidad_minima: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest rounded-2xl font-headline-md font-bold text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                        Producto Específico (Opcional)
                      </label>
                      <select
                        value={formPromo.producto_disparador_id}
                        onChange={(e) => setFormPromo({ ...formPromo, producto_disparador_id: e.target.value })}
                        className="w-full px-4 py-2.5 bg-surface-container-lowest rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 cursor-pointer"
                      >
                        <option value="">Cualquier producto / Ninguno</option>
                        {productosCatalogo.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                        Categoría (Opcional)
                      </label>
                      <select
                        value={formPromo.categoria_id}
                        onChange={(e) => setFormPromo({ ...formPromo, categoria_id: e.target.value })}
                        className="w-full px-4 py-2.5 bg-surface-container-lowest rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 cursor-pointer"
                      >
                        <option value="">Cualquier categoría / Ninguna</option>
                        {categoriasCatalogo.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {formPromo.tipo_regla === 'MONTO_MINIMO' && (
                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40 space-y-3">
                  <div>
                    <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                      Monto Mínimo de Ticket ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formPromo.monto_minimo}
                      onChange={(e) => setFormPromo({ ...formPromo, monto_minimo: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest rounded-2xl font-headline-md font-bold text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                    Tipo de Descuento
                  </label>
                  <select
                    value={formPromo.descuento_tipo}
                    onChange={(e) => setFormPromo({ ...formPromo, descuento_tipo: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 cursor-pointer"
                  >
                    <option value="PORCENTAJE">Porcentaje (%)</option>
                    <option value="MONTO_FIJO">Monto Fijo ($)</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                    Valor del Descuento *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPromo.descuento_valor}
                    onChange={(e) => setFormPromo({ ...formPromo, descuento_valor: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-2xl font-headline-md font-bold text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-surface-container-low rounded-2xl border border-surface-container-high/40 text-[11px] text-on-surface-variant flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Protección automática activada: El motor validará que el ticket mantenga margen &ge; $0.00 al cobrar.</span>
              </div>

              <div className="pt-3 border-t border-surface-container-low flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModalCrearPromo(false)}
                  className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-title-md text-body-sm font-bold bg-primary hover:opacity-95 text-on-primary rounded-full cursor-pointer transition-colors shadow-xs"
                >
                  Crear Regla de Promoción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
