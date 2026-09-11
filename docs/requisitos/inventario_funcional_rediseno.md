# Inventario Funcional Exhaustivo del Sistema para Diseño de UI/UX

**Proyecto:** Quantix Retail OS  
**Propósito:** Especificación funcional completa, desglosada por rol de usuario y módulo, para guiar la interfaz y experiencia de usuario (UI/UX).  
**Versión:** 2.0 (Alineación Integral Multi-Sede, Notificaciones Toasts y Logística)  
**Fecha:** Septiembre 2026  

---

## 1. Arquitectura de Roles y Matriz de Acceso (RBAC)

Quantix organiza sus módulos operacionales basándose en la **Pirámide de Anthony** (Nivel Estratégico, Táctico y Operativo). Cada rol posee una superficie de trabajo delimitada con aislamiento físico por sucursal:

| Módulo / Ruta | Cajero | Bodeguero | Supervisor | Director | Propósito General y Alcance |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Login (`/login`)** | Público | Público | Público | Público | Autenticación JWT y selección de contexto |
| **POS (`/pos`)** | Pleno | — | Pleno + Override | Pleno | Cobro multimodal, catálogo por categorías, báscula, movimientos de caja, tickets |
| **Clientes & Fidelización (`/clientes`)** | Lectura/Alta | — | Gestión Local | Global + Promos | CRM con cédula, puntos de lealtad, cupones locales y combos |
| **Inventario (`/inventario`)** | — | Pleno | Pleno | Pleno | Catálogo maestro, lotes FEFO, órdenes con recepción parcial, traspasos de stock |
| **Táctico (`/tactico`)** | — | — | Solo su Sede | Pleno Global | Arqueos ciegos, cortes X y Z, auditoría inmutable, desempeño cajeros |
| **Usuarios (`/usuarios`)** | — | — | Solo su Sede | CRUD Total | Directorio con teléfono, roles RBAC y sucursal asignada |
| **Análisis & Reportes (`/analisis`)**| — | — | Solo su Sede | Pleno Global | KPIs ejecutivos, Recharts, Pareto ABC, RFM, estacionalidad 7x24, constructor OLAP |
| **Dashboard BI (`/dashboard`)** | — | — | — | Pleno Global | Métricas ejecutivas DuckDB Gold y proyecciones inmediatas |
| **Operaciones & ETL (`/operaciones`)** | — | — | — | Pleno Global | Pipeline Medallion, scheduler APScheduler, supervisión de incidencias offline |
| **Configuración (`/configuracion`)** | — | — | — | Pleno Global | Parámetros SMTP con test en vivo, tolerancias de descuadre y umbrales FEFO |

*Nota:* Los usuarios con rol `SUPERVISOR`, `CAJERO` y `BODEGUERO` tienen su acceso estrictamente confinado a su sucursal asignada (`current_user.sucursal_id`), recibiendo HTTP 403 ante cualquier intento de fuga de datos. El rol `DIRECTOR` posee visibilidad multi-sede global y conmutación dinámica.

---

## 2. Componentes Globales y Transversales (Layout)

Todos los módulos autenticados se encuentran envueltos en el contenedor principal `Layout.tsx`.

### 2.1 Barra Lateral (Sidebar Izquierdo)
- **Logotipo y Marca:**
  - Icono `Store` en contenedor estilizado con sombras.
  - Título: **QUANTIX** (edición: `Enterprise Retail OS`).
- **Navegación Dinámica por Secciones:**
  - *Sección Estratégica (Badge: Dirección):* Enlaces a `Panel de Control` (`/dashboard`), `Análisis & Reportes` (`/analisis`), `Sincronización de Datos` (`/operaciones`), `Ajustes del Sistema` (`/configuracion`). Visible solo para `DIRECTOR`.
  - *Sección Táctica (Badge: Supervisión):* Enlaces a `Supervisión de Cajas` (`/tactico`), `Análisis & Reportes` (`/analisis`) y `Usuarios y Accesos` (`/usuarios`). Visible para `DIRECTOR` y `SUPERVISOR`.
  - *Sección Operativa (Badge: Piso & Venta):* Enlaces a `Punto de Venta` (`/pos`), `Clientes y Cupones` (`/clientes`), `Control de Inventario` (`/inventario`). Filtrado según rol.
- **Tarjeta Inferior de Usuario:**
  - Foto de perfil (avatar circular con compresión canvas) y botón de cámara para edición.
  - Nombre completo del usuario, correo corporativo y teléfono móvil.
  - Badge de Rol semántico (Morado: Director, Ámbar: Supervisor, Esmeralda: Cajero, Azul: Bodeguero).
  - Badge de Sucursal asignada.
  - Botón: **"Editar Perfil"** (abre `PerfilUsuarioModal`).
  - Botón: **"Cerrar Sesión"** (`LogOut` con limpieza de token y redirección a `/login`).

---

### 2.2 Barra Superior Global (Header)
- **Ruta / Miga de Pan:** `Quantix OS / [Nombre del Módulo Actual]`.
- **Selector Reactivo de Sucursal:**
  - Para `DIRECTOR`: Menú desplegable interactivo que lista todas las sedes activas y la opción de ver consolidado global. Al cambiar de sede, todas las vistas refrescan sus datos automáticamente sin recargar la página (`useSucursalStore`).
  - Para `SUPERVISOR`, `CAJERO` y `BODEGUERO`: Indicador fijo con el nombre de su sucursal y un icono de candado bloqueado que garantiza aislamiento visual y operativo.
- **Píldora de Conectividad en Tiempo Real:**
  - `ONLINE` (Verde): Ping en ms con el backend central.
  - `OFFLINE_LISTO` (Ámbar): Alerta de contingencia offline con catálogo local en IndexedDB y cobro exclusivo en efectivo.
  - `OFFLINE_NO_DISPONIBLE` (Rojo): Sin conexión ni catálogo local válido. Checkout bloqueado.
- **Selector de Modo Oscuro / Claro:**
  - Toggle `Sun` / `Moon` persistente en `themeStore`.
- **Centro de Notificaciones Push (`NotificationCenter.tsx`):**
  - Icono de campana con contador dinámico de no leídas en rojo alimentado por WebSocket en tiempo real.
  - Drawer desplegable con historial de alertas (descuadres de arqueo, quiebres de stock, lotes caducados, transferencias e incidencias offline).
  - Botones para marcar todas como leídas y limpiar historial.

---

### 2.3 Sistema Unificado de Notificaciones Toast Flotante (`ToastContainer.tsx`)
- **Directriz de Cero Banners Locales:** No existen banners fijos en cabeceras ni mensajes inline invasivos que desplacen el contenido de formularios o tablas.
- **Ubicación y Montaje:** Montado como un único componente raíz en `Layout.tsx` en la posición fija superior-derecha (`fixed top-20 right-6 z-50`).
- **Taxonomía de Severidades Semánticas:**
  - `CRITICO` (Rojo, 8,000 ms): Borde animado, para descuadres de caja mayores a $50 y fallos de servidor.
  - `WARNING` (Ámbar, 5,000 ms): Contingencias offline, cupones rechazados, stock bajo.
  - `SUCCESS` (Esmeralda, 5,000 ms): Ventas cobradas, transferencias recibidas, plantillas guardadas.
  - `INFO` (Azul/Violeta, 5,000 ms): Avisos generales y sincronizaciones finalizadas.
- **Interacción Avanzada:** Barra de progreso decreciente, pausa automática del temporizador al pasar el cursor (`onMouseEnter`), botón de descarte manual y soporte para botones de acción contextual interactivos.

---

### 2.4 Catálogo de Modales Globales del Sistema

1. **Modal de Edición de Perfil (`PerfilUsuarioModal.tsx`):** Carga de avatar con compresión canvas (JPEG 200×200 px), edición de nombre, correo, teléfono y cambio de contraseña con medidor de fortaleza.
2. **Modal de Apertura de Caja (`AperturaCajaModal.tsx`):** Captura del fondo inicial de efectivo, identificador de terminal y sucursal activa.
3. **Modal de Movimientos de Caja (`MovimientoCajaModal.tsx`):** Registro justificado de dotaciones de cambio (`INGRESO`) o retiros menores/sangrías (`EGRESO`), con validación previa de efectivo disponible en gaveta.
4. **Modal de Arqueo Ciego (`ArqueoCiegoModal.tsx`):** Desglose físico de billetes y monedas, cálculo del total en cliente y envío ciego al servidor. Si el descuadre supera la tolerancia, activa el override de supervisor en caliente.
5. **Modal de Corte X (`CorteXModal.tsx`):** Visualización instantánea del balance provisional del turno activo (ventas por método de pago, ingresos, egresos y efectivo teórico) sin cerrar sesión.
6. **Modal de Corte Z:** Resumen fiscal definitivo de fin de turno con folios primero/último, anulaciones y resultado del arqueo ciego.
7. **Modal de Ticket Térmico (`TicketModal.tsx`):** Vista de impresión térmica (80 mm) con soporte para reimpresión (`window.print()`), descarga ESC/POS (.txt) y leyenda condicional para comprobantes offline pendientes de sincronizar.
8. **Modal de Simulador de Pagos (`SimuladorPagoModal.tsx`):** Emulador interactivo para pagos Contactless (animación NFC/chip de 3s) y QR DeUna de Banco Pichincha (matriz procedural 25×25 SVG).
9. **Modal de Transferencia de Stock (`TransferenciaModal.tsx`):** Selección de sucursal destino, selección de producto y lote FEFO de origen, cantidad y notas de despacho.
10. **Modal de Detalle de Transferencia (`TransferenciaDetalleModal.tsx`):** Trazabilidad completa con botones contextuales según rol para despachar (`EN_TRANSITO`), recepcionar (`RECIBIDA`) o cancelar con reversión (`CANCELADA`).
11. **Constructor de Reportes Personalizados (`ReportePersonalizadoBuilder.tsx`):** Configuración ad-hoc de 15 columnas OLAP, filtros, agrupaciones y guardado de plantillas en PostgreSQL.
12. **Vista Previa de Reportes (`ReportePreview.tsx`):** Tabla paginada con fila fija de totales consolidados y exportación a CSV (BOM UTF-8) y PDF formal.

---

## 3. Desglose Detallado por Módulo

### 3.1 Módulo: Punto de Venta (`POS.tsx`)
- **Header Operativo:** Estado de sesión de caja, terminal, hora de apertura, fondo inicial, botón de "Cerrar Caja / Arqueo", botón de **"Movimiento de Caja"** (ingresos/egresos manuales), historial de tickets y atajos de teclado (F1 Buscar, F2 Cliente, F4 Cobrar, Esc Limpiar).
- **Catálogo Unificado:** Buscador con autocompletado en tiempo real por nombre, SKU o código de barras; selector horizontal de categorías; tarjetas de producto con indicador de stock y badge si requiere pesaje en báscula (`requiere_pesaje`).
- **Carrito y Checkout:**
  - Tabla de partidas con controles de incremento/decremento y cantidades fraccionarias decimales para báscula.
  - Búsqueda ágil de cliente por Cédula o Teléfono con visualización de puntos acumulados.
  - Aplicación de cupones territoriales y redención de puntos de lealtad (10 pts = $1).
  - Resumen financiero: Subtotal, Descuentos automáticos por promociones, IVA 16% y Total a pagar.
  - Métodos de pago: Efectivo (activo siempre), Tarjeta bancaria y QR DeUna (ambos deshabilitados automáticamente en modo offline).

### 3.2 Módulo: Clientes y Fidelización (`Clientes.tsx`)
- **Pestaña Clientes:** Directorio con Cédula, Nombre, Teléfono, Email, Puntos Acumulados y sucursal de registro. Búsqueda combinada e historial de compras previas. Alta rápida de clientes con validación Módulo 10 de Cédula.
- **Pestaña Cupones:** Emisión de cupones de cumpleaños, reactivación o manuales vinculados a la sucursal activa. Consulta de estado (`EMITIDO`, `CANJEADO`, `EXPIRADO`).
- **Pestaña Promociones (Solo Director):** Constructor de reglas promocionales (`COMBO`, `VOLUMEN`, `MONTO_MINIMO`) con aplicación a nivel de SKU o categoría completa.

### 3.3 Módulo: Control de Inventario (`Inventario.tsx`)
- **Pestaña Lotes & FEFO:** Semáforo de caducidad (Rojo vencido, Ámbar próximo en < 30 días, Verde vigente), trazabilidad por código de lote, costo unitario y existencias en la sucursal activa.
- **Pestaña Productos:** Catálogo maestro, clasificación Pareto ABC, precios de venta, costos base, asignación de categoría y flag de pesaje en balanza.
- **Pestaña Órdenes de Compra:** Gestión de pedidos a proveedores con soporte para **recepción parcial** (`RECIBIDA_PARCIAL`), generando lotes sanitarios trazables (`SAN-...`).
- **Pestaña Transferencias:** Listado de traspasos inter-sucursales (`SOLICITADA`, `EN_TRANSITO`, `RECIBIDA`, `CANCELADA`) con modales de despacho y recepción física.
- **Pestaña Reorden Inteligente:** Sugerencias automáticas de compra calculadas con la velocidad de venta a 30 días, lead time del proveedor y stocks de seguridad ABC.

### 3.4 Módulo: Supervisión Táctica (`Tactico.tsx`)
- **Monitor de Cajas en Vivo:** Sesiones abiertas, terminales, cajeros asignados, total de ventas recaudadas, movimientos manuales de caja y emisión de Cortes X y Z.
- **Auditoría de Descuadres:** Registro de diferencias de arqueo ciego, faltantes, sobrantes y alertas críticas (> $50).
- **Semáforo de Riesgo FEFO:** Detección de lotes en riesgo de merma en piso de venta con valor monetario en riesgo.
- **Desempeño de Cajeros:** Ranking con total de tickets procesados y **Tasa de Precisión de Gaveta** (`precision_gaveta_pct`).
- **Bitácora Inmutable de Auditoría:** Visor del historial de eventos forenses en `auditoria_evento`.

### 3.5 Módulo: Análisis Estadístico & Reportes Avanzados (`Analisis.tsx`)
- **Submódulo Analítico:** KPIs ejecutivos con variación porcentual, gráficos Recharts interactivos de tendencias (Ingresos vs. Margen), curva de concentración Pareto ABC, segmentación algorítmica RFM (9 segmentos), heatmap 7x24 de estacionalidad horaria y proyecciones de demanda Z / Student-t al 95% de confianza sobre DuckDB Gold.
- **Submódulo Constructor OLAP:** Panel integrado `ReportePersonalizadoBuilder.tsx` y `ReportePreview.tsx` para generar reportes ad-hoc de 15 columnas con fila fija de totales y exportación CSV/PDF.

### 3.6 Módulo: Dashboard Directivo (`Dashboard.tsx`)
- Cuadro de mando ejecutivo con ingresos del mes, margen promedio consolidado, gráfica Recharts de 7 días y proyecciones de demanda inmediata sobre DuckDB Gold.

### 3.7 Módulo: Operaciones & Sincronización (`Operaciones.tsx`)
- **Monitor Medallion ETL:** Almacenamiento en KB de DuckDB, conteo de filas en capas Bronze, Silver y Gold, planificador APScheduler con reprogramación en caliente y botón de ejecución manual inmediata con bitácora `etl_log`.
- **Supervisión de Conflictos Offline:** Tarjetas KPI de incidencias de sincronización, tabla interactiva de quiebres de stock y modal de resolución administrativa con notas de auditoría.

### 3.8 Módulo: Directorio de Usuarios (`Usuarios.tsx`)
- Gestión de usuarios corporativos con teléfono, foto de perfil, rol asignado (`DIRECTOR`, `SUPERVISOR`, `CAJERO`, `BODEGUERO`) y sucursal de adscripción. Bajas lógicas y reseteo de claves con aislamiento estricto para supervisores.

### 3.9 Módulo: Ajustes del Sistema (`Configuracion.tsx`)
- **Configuración SMTP:** Host, puerto, credenciales seguras y botón de prueba en vivo de envío de correo electrónico.
- **Políticas Operativas:** Tolerancia máxima de descuadre en arqueo ($5.00), umbrales de alerta sanitaria FEFO (días) y multiplicador de inactividad para reactivación de clientes.

---

## 4. Matriz de Componentes UI y Modales

| Componente | Tipo UI | Acciones / Interacciones | Dependencias Clave |
| :--- | :--- | :--- | :--- |
| **ToastContainer** | Root Floating | Renderiza alertas con auto-descarte, barra de progreso y pausa al hover | `useNotificationStore`, `useWebSocket` |
| **Píldora Conectividad**| Header Badge | Muestra latencia ms, contingencia offline y botón de reintento | `connectivityStore` |
| **NotificationCenter** | Header Drawer | Historial persistente de alertas WebSocket, marcar leídas, limpiar | `useNotificationStore` |
| **AperturaCajaModal** | Modal Dialog | Fondo inicial en gaveta, terminal y sucursal | `POST /caja/abrir` |
| **MovimientoCajaModal**| Modal Dialog | Ingreso/Egreso justificado de gaveta | `POST /caja/movimientos` |
| **ArqueoCiegoModal** | Modal Completo | Conteo desglosado de efectivo/monedas y override de supervisor | `POST /caja/arqueo-ciego` |
| **CorteXModal** | Modal Imprimible| Arqueo parcial de turno activo sin cierre | `GET /caja/corte-x` |
| **SimuladorPagoModal** | Modal Emulador | Animación Contactless y QR procedural DeUna SVG | `SimulatedPaymentGateway` |
| **TransferenciaModal** | Modal Form | Solicitud y despacho de stock entre sedes con lote FEFO origen | `POST /sucursales/transferencias` |
| **TransferenciaDetalle**| Modal Trazabilidad| Despachar, recepcionar o cancelar traspasos | `transferencias.py` |
| **ReportePersonalizado**| Builder Panel | Configuración de 15 columnas OLAP, filtros y plantillas | `reportes.py`, `DuckDB Gold` |
| **ReportePreview** | Data Preview | Paginación, fila fija de totales y exportación CSV/PDF | `exportUtils.ts` |
