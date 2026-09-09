# Inventario Funcional Exhaustivo del Sistema para Rediseño de UI/UX
**Proyecto:** Quantix Retail OS  
**Propósito:** Especificación funcional completa, desglosada por rol de usuario y módulo, para guiar el rediseño integral de interfaz y experiencia de usuario (UI/UX).  
**Fecha de corte:** 2026-09-09  

---

## 1. Arquitectura de Roles y Matriz de Acceso (RBAC)

Quantix organiza sus módulos operacionales basándose en la **Pirámide de Anthony** (Nivel Estratégico, Táctico y Operativo). Cada rol posee una superficie de trabajo delimitada:

| Módulo / Ruta | Cajero | Bodeguero | Supervisor | Director | Propósito General |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Login (`/login`)** | Público | Público | Público | Público | Autenticación y selección de contexto |
| **POS (`/pos`)** | Pleno | — | Pleno + Override | Pleno | Cobro, caja, catálogo, venta flash, tickets |
| **Clientes & Fidelización (`/clientes`)** | Lectura/Alta | — | Gestión | Gestión + Promos | CRM, cupones, promociones y combos |
| **Inventario (`/inventario`)** | — | Pleno | Pleno | Pleno | Catálogo, lotes FEFO, órdenes de compra |
| **Táctico (`/tactico`)** | — | — | Pleno | Pleno | Arqueos de caja, auditoría, desempeño cajeros |
| **Usuarios (`/usuarios`)** | — | — | Solo lectura | CRUD Total | Directorio, permisos, altas y bajas lógicas |
| **Dashboard BI (`/dashboard`)** | — | — | — | Pleno | Métricas ejecutivas DuckDB Gold, proyecciones Z/t |
| **Operaciones & ETL (`/operaciones`)** | — | — | — | Pleno | Pipeline Medallion, supervisión incidencias offline |
| **Configuración (`/configuracion`)** | — | — | — | Pleno | Parámetros SMTP, políticas de tolerancia y FEFO |

---

## 2. Componentes Globales y Transversales (Layout)

Todos los módulos autenticados se encuentran envueltos en el contenedor principal `Layout.tsx`.

### 2.1 Barra Lateral (Sidebar Izquierdo)
- **Logotipo y Marca:**
  - Icono `Store` en contenedor estilizado con sombras.
  - Título: **QUANTIX** (versión/edición: `Enterprise Retail OS`).
- **Navegación Dinámica por Secciones:**
  - *Sección Estratégica (Badge: Dirección):* Enlaces a `Panel de Control`, `Sincronización de Datos` (Operaciones), `Ajustes del Sistema`. Visible solo para `DIRECTOR`.
  - *Sección Táctica (Badge: Supervisión):* Enlaces a `Supervisión de Cajas` (Táctico) y `Usuarios y Accesos`. Visible para `DIRECTOR` y `SUPERVISOR`.
  - *Sección Operativa (Badge: Piso & Venta):* Enlaces a `Punto de Venta`, `Clientes y Cupones`, `Control de Inventario`. Filtrado según rol.
- **Tarjeta Inferior de Usuario:**
  - Foto de perfil (avatar circular de 40×40 px) con botón de cámara superpuesto (`Camera`) para edición rápida.
  - Nombre completo del usuario y correo electrónico en fuente monoespaciada.
  - Teléfono / Celular (si está registrado en la base de datos).
  - Badge de Rol con color temático (Morado: Director, Ámbar: Supervisor, Esmeralda: Cajero, Azul: Bodeguero).
  - Botón interactivo: **"Editar Perfil"** (abre `PerfilUsuarioModal`).
  - Botón: **"Cerrar Sesión"** (`LogOut` con confirmación, limpia token, caja y redirige a `/login`).

---

### 2.2 Barra Superior Global (Header)
- **Ruta / Miga de Pan:** `Quantix OS / [Nombre del Módulo Actual]`.
- **Píldora de Conectividad en Tiempo Real:**
  - `ONLINE` (Verde): Ping en ms con el backend.
  - `OFFLINE_LISTO` (Ámbar): Alerta de contingencia offline con catálogo local válido.
  - `OFFLINE_NO_DISPONIBLE` (Rojo): Sin conexión ni catálogo local.
- **Selector de Modo Oscuro / Claro:**
  - Botón toggle `Sun` / `Moon` con persistencia en `themeStore`.
- **Centro de Notificaciones Push (`NotificationCenter.tsx`):**
  - Icono de campana con contador dinámico de no leídas en rojo.
  - WebSocket bidireccional conectado a `/api/v1/ws/notificaciones`.
  - Menú desplegable con alertas (descuadres de caja, mermas, lotes vencidos, incidencias de sincronización).
  - Botón: **"Marcar todas como leídas"**.
  - Botón: **"Limpiar historial"**.

---

### 2.3 Banners de Contingencia Offline (Top Banner)
- **Banner Ámbar (`OFFLINE_LISTO`):**
  - Icono `AlertTriangle`, texto informativo: *"Modo Offline Seguro: Operando sin conexión. Cobros permitidos únicamente en Efectivo"*.
  - Indicador de antigüedad del catálogo local (horas).
  - Badge con número de ventas locales pendientes de sincronizar.
  - Botón: **"Reintentar"** (fuerza consulta a `/health`).
- **Banner Rojo (`OFFLINE_NO_DISPONIBLE`):**
  - Icono `AlertCircle`: *"Cobro Suspendido: Sin conexión y sin catálogo local válido. Se requiere conexión para sincronizar"*.
  - Botón: **"Reintentar"**.
- **Barra de Sincronización en Progreso:**
  - Se activa cuando la red vuelve a estar online y hay ventas en cola.
  - Icono `Loader2` animado: *"Sincronizando X ventas offline..."*.
  - Botón: **"Sincronizar ahora"** (dispara worker manual).

---

### 2.4 Modales Globales del Sistema
1. **Modal de Edición de Perfil de Usuario (`PerfilUsuarioModal.tsx`):**
   - *Avatar:* Carga de archivo desde dispositivo, previsualización circular, compresión automática HTML5 Canvas (JPEG 200×200 px calidad 0.85 con crop centrado), botón para quitar foto.
   - *Campos editables:* Nombre Completo, Correo Electrónico, Teléfono/Celular.
   - *Acordeón "Cambiar Contraseña":* Contraseña actual, Nueva contraseña (min. 6 caracteres), Confirmar contraseña (con toggles ver/ocultar contraseña).
   - *Acciones:* Botón **"Cancelar"**, Botón **"Guardar Cambios"** (consume `PUT /api/v1/usuarios/me` y actualiza `authStore`).
2. **Modal Mi Turno / Mi Actividad (`MiActividadModal.tsx`):**
   - Resumen del cajero en turno: Terminal, hora de apertura, tiempo transcurrido.
   - Totales acumulados: Fondo inicial, ventas en efectivo, ventas con tarjeta, tickets emitidos.
   - Botón de acceso directo a **"Cerrar Turno / Arqueo Ciego"**.
3. **Modal de Apertura de Caja (`AperturaCajaModal.tsx`):**
   - Input: **Fondo Inicial de Gaveta ($)**.
   - Input: **Identificador de Terminal** (ej. `CAJA-01`).
   - Botón: **"Abrir Caja e Iniciar Turno"** (consume `POST /api/v1/caja/apertura`).
4. **Modal de Arqueo Ciego (`ArqueoCiegoModal.tsx`):**
   - *Desglose de Efectivo:* Inputs numéricos por denominación de billetes ($1000, $500, $200, $100, $50, $20) y monedas ($10, $5, $2, $1, $0.50).
   - *Desglose de Tarjeta:* Input para vouchers/bauchers sumados.
   - *Otros:* Vales o créditos.
   - *Cálculo en vivo:* Conteo físico total calculado en el navegador.
   - *Acción:* Botón **"Registrar Conteo y Cerrar Turno"** (envía a `POST /api/v1/caja/cierre/arqueo-ciego`).
   - *Control de Descuadre:* Si la diferencia supera la tolerancia configurada, se activa el formulario de **Autorización de Supervisor en Caliente** (Email y contraseña de supervisor para generar `AuditoriaEvento`).
5. **Modal de Ticket / Comprobante Térmico (`TicketModal.tsx`):**
   - Diseño idéntico a impresora térmica de 80mm.
   - Logotipo, RFC, dirección, folio fiscal central o UUID local offline.
   - Leyenda condicional: `COMPROBANTE OFFLINE / PENDIENTE DE SINCRONIZACIÓN`.
   - Tabla de productos (Cantidad, Descripción, Precio Unitario, Subtotal).
   - Desglose: Subtotal, Descuento aplicado (promoción/cupón), IVA 16%, Total pagado.
   - Desglose de pagos (Efectivo recibido y cambio entregado, o Tarjeta con autorización).
   - Botón: **"Imprimir Ticket"** (`window.print()`).
   - Botón: **"Descargar Ticket (.txt)"** (formato ESC/POS compatible).
   - Botón: **"Cerrar"** (`Esc`).

---

## 3. Desglose Detallado por Módulo y Rol de Usuario

---

### ROL: CAJERO (Operación en Piso de Venta)

El cajero tiene acceso exclusivo a **Punto de Venta (POS)** y consulta/alta de **Clientes**.

#### 3.1 Módulo: Punto de Venta (`POS.tsx`)

##### A. Header Operativo del POS
- **Estado de Sesión de Caja:**
  - Si está abierta: Badge verde con terminal (`CAJA-01`), hora de inicio y fondo inicial.
  - Si está cerrada: Badge rojo con botón prominente **"Abrir Caja"** (bloquea ventas hasta abrir).
- **Gamificación / Meta del Turno:**
  - Barra de progreso interactiva con meta configurable (ej. $2,500.00). Muestra porcentaje alcanzado y premio/trofeo visual al completarse.
- **Acciones Rápidas del Encabezado:**
  - Botón toggle: **"Venta Flash Táctil"** (`Zap`): alterna entre la vista de catálogo tradicional y la cuadrícula de botones rápidos táctiles.
  - Botón: **"Historial de Tickets"** (`Receipt`): abre el drawer lateral con las últimas 50 ventas del turno.
  - Botón: **"Cerrar Caja / Arqueo"** (`LogOut`): abre el modal de arqueo ciego.
  - Botón: **"Atajos de Teclado"**: despliega guía rápida (F1: Buscar, F2: Cliente, F4: Cobrar, Esc: Limpiar).

##### B. Panel Izquierdo: Catálogo y Búsqueda de Productos
- **Buscador Principal (`Search`):**
  - Input con foco automático para teclear nombre, SKU o escanear código de barras.
  - Historial de búsquedas recientes (chips clickeables guardados en `localStorage`).
  - Popover de autocompletado en tiempo real con stock disponible y precio.
- **Selector de Categorías:**
  - Pestañas/filtros rápidos horizontales (`TODAS`, `BEBIDAS`, `BOTANAS`, `LÁCTEOS`, etc.).
- **Cuadrícula de Productos Tradicional:**
  - Tarjetas de producto con foto/placeholder, nombre, SKU, badge de categoría.
  - Precio de venta formateado en moneda ($).
  - Indicador de stock total disponible (verde si > 10, amarillo si <= 5, rojo agotado).
  - Botón **"Ver Detalle"** (`Eye`): modal con clasificación ABC, si requiere pesaje y desglose de lotes.
  - Clic en tarjeta: añade 1 unidad al carrito.
- **Modo Alternativo: Venta Flash Táctil (`VentaFlashGrid.tsx`):**
  - Botones táctiles grandes de alta sensibilidad para productos de altísima rotación.
  - Teclado numérico / calculadora rápida para productos a granel con pesaje.

##### C. Panel Derecho: Carrito de Compras y Cobro
- **Encabezado del Carrito:**
  - Contador total de artículos en carrito.
  - Botón: **"Vaciar Carrito"** (`Trash2` con diálogo de confirmación).
- **Tabla / Lista de Ítems del Carrito:**
  - Nombre del producto y SKU.
  - Controles de cantidad: Botón decrementar (`Minus`), input numérico directo, botón incrementar (`Plus`).
  - Precio unitario.
  - Subtotal de línea.
  - Botón eliminar ítem (`X` / `Trash2`).
  - Badge automático de Promoción Aplicada (si entra en regla de combo o volumen, muestra descuento en verde).
- **Sección CRM y Fidelización:**
  - Input: **Teléfono del Cliente** con botón de búsqueda (`UserCheck`).
  - Si se encuentra: muestra nombre del cliente, nivel y saldo de puntos acumulados.
  - Botón: **"Quitar Cliente"**.
- **Sección de Cupones de Descuento:**
  - Input: **Código del Cupón** (ej. `VERANO2026`).
  - Botón: **"Aplicar Cupón"** (`Tag`).
  - Mensaje de validación: Descuento reflejado o motivo de rechazo (vencido/usado).
- **Resumen Financiero:**
  - Subtotal Bruto ($).
  - Descuentos Totales (Promociones automáticas + Cupones) en color esmeralda.
  - IVA Trasladado (16%).
  - **TOTAL A PAGAR ($)** en tipografía destacada de gran tamaño.
- **Selector de Método de Pago:**
  - Botón: **"Efectivo"** (`Banknote`). Activo en online y obligatorio en offline. Muestra input de "Monto recibido" y cálculo de "Cambio a entregar".
  - Botón: **"Tarjeta"** (`CreditCard`). Deshabilitado en offline. Permite seleccionar terminal o simulación de tarjeta bancaria.
- **Botón Principal de Acción:**
  - **"PROCESAR COBRO / FINALIZAR VENTA"** (F4).
  - Estados del botón:
    - Normal: azul o esmeralda activo.
    - Deshabilitado: si la caja está cerrada, si el carrito está vacío, o si el estado es `OFFLINE_NO_DISPONIBLE`.
    - Loading: spinner mientras valida stock FEFO en servidor o persiste en IndexedDB.

##### D. Drawer Lateral de Historial de Tickets Recientes
- Lista cronológica inversa de tickets de la sesión activa.
- Folio, hora, total pagado, número de artículos, estado (`PAGADO`, `ANULADO`).
- Clic en ticket: abre el **Modal de Detalle del Ticket**.
  - Desglose de lotes descargados, costos y márgenes.
  - Desglose de método de pago.
  - Botón: **"Reimprimir Ticket"**.
  - Botón: **"Anular Venta / Devolución"**:
    - Campo para motivo de anulación.
    - Exige autorización de Supervisor si el cajero no tiene el rol.

---

#### 3.2 Módulo: Clientes y Fidelización (`Clientes.tsx`) - Vista Cajero
- **Buscador de Clientes:** Input por teléfono, nombre o correo.
- **Tabla de Clientes:** Nombre, Teléfono, Email, Puntos Acumulados, Fecha de Registro.
- **Botón "Nuevo Cliente":** Modal con Nombre, Teléfono obligatorio, Email opcional para alta rápida en piso de venta.
- **Botón "Ver Historial":** Modal con las compras previas del cliente y folios asociados.

---

### ROL: BODEGUERO (Almacén, Abastecimiento y Lotes FEFO)

El bodeguero tiene acceso prioritario a **Control de Inventario (`/inventario`)**.

#### 3.3 Módulo: Control de Inventario (`Inventario.tsx`)

##### A. Barra de Navegación por Pestañas del Inventario
- Pestañas: `Lotes & FEFO` (pestaña predeterminada para bodeguero), `Productos`, `Órdenes de Compra`, `Proveedores`, `Categorías`.
- Botón superior: **"Exportar a CSV"** (descarga la vista activa formateada).

##### B. Pestaña: Lotes & FEFO (First Expired, First Out)
- **Filtros de Lotes:** Por estado (`ACTIVO`, `AGOTADO`, `VENCIDO`) y buscador por código de lote o SKU.
- **Semáforo Visual de Caducidad:**
  - Rojo: Lote vencido (rechazado automáticamente para ventas en checkout).
  - Naranja / Ámbar: Próximo a vencer en menos de 30 días (prioridad de rotación).
  - Verde: Lote fresco con vigencia amplia.
- **Tabla de Lotes:**
  - Código de Lote (monospace).
  - Producto vinculado (nombre y SKU).
  - Fecha de ingreso y Fecha de vencimiento.
  - Días restantes para caducar.
  - Cantidad inicial vs Cantidad disponible actual.
  - Costo unitario de compra.
  - Estado del lote.
- **Acciones por Lote:**
  - Botón **"Ver Detalle"** (`Eye`): trazabilidad completa del lote, proveedor que lo surtió y orden de compra asociada.

##### C. Pestaña: Órdenes de Compra y Recepción de Mercancía
- **Botón "Nueva Orden de Compra" (`OrdenCompraModal.tsx`):**
  - Selector de proveedor (con indicador de tiempo de entrega `lead_time_dias`).
  - Buscador y selector de productos a solicitar.
  - Inputs de cantidad y costo unitario pactado.
  - Cálculo de total y fecha estimada de entrega.
  - Botón: **"Crear Orden"**.
- **Tabla de Órdenes de Compra:**
  - Folio de orden, Proveedor, Fecha de emisión, Total $, Estado (`PENDIENTE`, `EN_TRANSITO`, `RECIBIDA`, `CANCELADA`).
- **Botón Operativo Clave: "Recepcionar Mercancía" (`CheckCircle2` / `Truck`):**
  - Abre formulario de recepción física en muelle.
  - Permite ingresar la fecha de vencimiento real y el código de lote impreso por el fabricante.
  - Al confirmar, genera automáticamente los registros en `lotes_inventario` e incrementa el stock vendible en el sistema.

##### D. Pestaña: Catálogo Maestro de Productos
- **Filtros:** Buscador por SKU/nombre/código de barras, filtro por Categoría, filtro por Clasificación ABC (`A`: Alta rotación, `B`: Media, `C`: Baja).
- **Tabla de Productos:**
  - Imagen / Thumbnail.
  - SKU y Código de barras.
  - Nombre y Categoría.
  - Precio de Venta y Costo Base.
  - Margen de ganancia calculado (% y $).
  - Stock Total (suma de todos los lotes activos).
  - Estado (Activo / Inactivo).
- **Acciones:**
  - Botón: **"Nuevo Producto"** (modal con todos los atributos maestros).
  - Botón: **"Editar Producto"** (actualización de precios, costos y pesaje).
  - Botón: **"Ver Lotes"** (despliega los lotes activos que alimentan ese stock).

##### E. Sugerencias Inteligentes de Reorden (Widget Superior)
- Alerta analítica de productos bajo su punto de reorden.
- Muestra sugerencia de compra en piezas para evitar quiebre de stock según el lead time del proveedor.

---

### ROL: SUPERVISOR (Control Táctico, Cajas, Auditoría y Aprobaciones)

El supervisor tiene acceso a **POS**, **Clientes**, **Inventario**, **Supervisión de Cajas (`/tactico`)** y consulta de **Usuarios**.

#### 3.4 Módulo: Supervisión Táctica (`Tactico.tsx`)

##### A. Pestaña 1: Arqueos y Monitor de Cajas en Vivo
- **KPIs Globales de Cajas:**
  - Total ventas acumuladas hoy ($).
  - Sesiones activas / terminales abiertas.
  - Precisión global de gaveta (%).
  - Total de descuadres detectados.
- **Tabla de Sesiones de Caja:**
  - Terminal ID y Cajero asignado.
  - Hora de apertura y Estado (`ABIERTA`, `CERRADA`, `DESCUADRE`).
  - Fondo inicial ($).
  - Total Teórico del sistema vs Total Físico declarado.
  - Diferencia ($) con badge semántico (Verde: exacto, Azul: sobrante, Rojo: faltante).
- **Acciones por Sesión:**
  - Botón **"Ver Detalle de Turno"**: desglose por método de pago y tickets generados.
  - Botón **"Generar Corte Z"**: modal oficial de corte de caja consolidado con botón de impresión directa.

##### B. Pestaña 2: Semáforo de Riesgo FEFO
- Monitoreo en tiempo real de lotes con caducidad próxima en piso de venta.
- Valor monetario en riesgo de merma.
- Botón para emitir alerta a bodega o autorizar descuento de remate.

##### C. Pestaña 3: Auditoría de Seguridad y Eventos
- **Registro Append-Only de Seguridad:**
  - Tabla de eventos de auditoría: Fecha/hora, Usuario responsable, Tipo de evento (`ANULACION_TICKET`, `DESCUADRE_ARQUEO`, `OVERRIDE_SUPERVISOR`, `APERTURA_SIN_VENTA`), Severidad (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`).
- **Modal de Detalle de Auditoría:**
  - Visor del payload JSON original, IP de la terminal y usuario autorizador.

##### D. Pestaña 4: Desempeño y Ranking de Cajeros
- Tabla comparativa de cajeros:
  - Turnos completados, ventas totales, tickets por hora.
  - Tasa de precisión de gaveta (% de turnos sin descuadre).
  - Promedio de faltantes/sobrantes ($).

##### E. Modal de Autorización "Supervisor Override" en Caliente
- Componente modal invocado cuando un cajero necesita anular un ticket o cerrar una caja descuadrada.
- Inputs: Correo de Supervisor, Contraseña de Supervisor, Motivo de aprobación.
- Genera token de anulación y queda registrado en la bitácora inmutable.

---

### ROL: DIRECTOR (Estratégico, BI, Auditoría, ETL y Configuración Total)

El director posee permisos absolutos sobre todos los módulos del sistema.

#### 3.5 Módulo: Dashboard Estratégico & Business Intelligence (`Dashboard.tsx`)
- **KPIs de Alto Nivel:**
  - Ingresos del Mes Actual ($).
  - Margen Promedio Consolidado (%).
  - Variación porcentual comparativa contra la serie previa.
- **Gráfica Interactiva Recharts:**
  - Área comparativa de los últimos 7 días disponibles: Curva de **Ventas ($)** en color verde vs Curva de **Margen ($)** en color azul.
  - Tooltip con desglose diario y leyenda interactiva.
- **Tabla de Inferencia Estadística de Demanda:**
  - Basada en DuckDB Gold y cálculo estadístico Z / Student-t.
  - Columnas: Producto, Número de muestras históricas ($n$), Distribución matemática utilizada, Demanda media diaria estimada, Intervalo de Confianza al 95% ($IC_{95\%}$).
  - Botón **"Ver Detalle de Proyección"** (`Eye`): modal con gráfico de campana y parámetros de dispersión.
- Botón: **"Actualizar Métricas"** (`RefreshCw`).

---

#### 3.6 Módulo: Sincronización de Datos & Operaciones (`Operaciones.tsx`)

##### A. Pestaña 1: Pipeline ETL Medallion (DuckDB / OLAP)
- **Monitor de Almacenamiento Analítico:**
  - Ruta física del archivo DuckDB y tamaño en disco (KB/MB).
  - Total de registros en capas analíticas: Bronze (ventas crudas), Silver (ventas limpias), Gold (hechos agregados).
- **Scheduler Automático:**
  - Estado del planificador (`running`), intervalo en minutos (ej. cada 15 min).
  - Botón principal: **"Ejecutar Pipeline Manual Ahora"** (dispara extracción, transformación y carga a DuckDB).
- **Tabla de Historial de Ejecuciones ETL:**
  - ID de ejecución, Tipo de disparo (Programado / Manual), Usuario que disparó.
  - Duración exacta en milisegundos.
  - Filas procesadas por capa (Bronze / Silver / Gold).
  - Estado (`EXITOSO` con icono verde, `ERROR` con icono rojo y detalle del trace).

##### B. Pestaña 2: Supervisión de Conflictos Offline (Sync)
- **Tarjetas KPI de Incidencias:**
  - Total Incidencias registradas, Pendientes de resolución (con alerta activa), Resueltas, Estado de permisos del usuario.
- **Filtros y Búsqueda:**
  - Filtro por estado: `Todos`, `Pendientes`, `Resueltos`.
  - Buscador en tiempo real por UUID local (`id_local`), tipo de error o detalle.
  - Botón: **"Exportar a CSV"**.
- **Tabla de Conflictos de Sincronización:**
  - `ID Local`: UUID v4 generado en el navegador del cajero.
  - `Tipo de Conflicto`: Badges de color (`STOCK_INSUFICIENTE` ámbar, `SESION_INVALIDA` morado, etc.).
  - `Detalle del Conflicto`: Explicación técnica/comercial exacta del rechazo.
  - `Fecha de Registro`: Timestamp de recepción.
  - `Estado`: Resuelto o Pendiente.
  - `Auditoría`: Si ya fue resuelto, muestra la nota y el usuario que resolvió.
- **Botón de Acción: "Resolver Incidencia" (`ShieldCheck`):**
  - Abre modal de resolución para registrar la **Nota de Resolución de Auditoría** (ej. "Se ajustó inventario físico en tienda y se autorizó la venta").
  - Consume `POST /api/v1/sync/conflictos/{id}/resolver` y actualiza la lista.

---

#### 3.7 Módulo: Usuarios y Accesos (`Usuarios.tsx`)
- **KPIs de Directorio:** Total usuarios, Activos, Inactivos, Conteo por Rol.
- **Filtros:** Buscador por nombre/correo, selector de Rol (`DIRECTOR`, `SUPERVISOR`, `CAJERO`, `BODEGUERO`), checkbox "Mostrar inactivos".
- **Botón "Nuevo Usuario":**
  - Modal con Nombre Completo, Correo Corporativo, Teléfono, Selección de Rol, Contraseña inicial.
- **Tabla de Usuarios:**
  - Avatar / Iniciales.
  - Nombre y Correo.
  - Rol con badge semántico.
  - Estado: Switch o badge Activo / Inactivo.
  - Fecha de creación.
- **Acciones por Fila:**
  - Botón: **"Editar Usuario"** (modificar rol, nombre o resetear contraseña).
  - Botón: **"Baja Lógica / Desactivar"** (revoca acceso sin borrar auditorías ni historial).
  - Botón: **"Reactivar Usuario"** (para usuarios dados de baja).
  - Botón: **"Exportar a CSV"**.

---

#### 3.8 Módulo: Ajustes del Sistema (`Configuracion.tsx`)
- **Sección 1: Notificaciones y Servidor SMTP:**
  - Input: Host SMTP (ej. `smtp.gmail.com`).
  - Input: Puerto SMTP (ej. `587`).
  - Input: Usuario / Correo emisor (`alertas@quantix.local`).
  - Input: Contraseña de aplicación (con toggle ver/ocultar).
  - Formulario de prueba: Input "Email destino" y botón **"Enviar Correo de Prueba"** (consume `/configuracion/smtp/probar` y muestra log de éxito/error).
- **Sección 2: Políticas Operativas y Parámetros de Negocio:**
  - Input: **Tolerancia de Descuadre en Arqueo ($)** (monto máximo permitido de diferencia sin disparar alerta de seguridad).
  - Input: **Alerta FEFO Nivel 1 (Días)** (umbral para marcar lote en amarillo/naranja).
  - Input: **Alerta FEFO Nivel 2 (Días)** (umbral crítico para marcar lote en rojo).
  - Input: **Multiplicador de Inactividad RFM** (factor para considerar cliente en riesgo de abandono).
- **Acción:** Botón **"Guardar Parámetros Globales"** (`Save`).

---

#### 3.9 Módulo: Clientes y Promociones (`Clientes.tsx`) - Vista Director
Además de la gestión de clientes y cupones, el Director tiene acceso a la pestaña:
- **Pestaña: Promociones & Combos:**
  - Botón: **"Nueva Regla Promocional"** (`Sparkles`):
    - Tipo de Regla: `COMBO` (ej. 2x1 o Producto A + Producto B), `VOLUMEN` (ej. 3 o más unidades con descuento), `MONTO_MINIMO` (ej. compra > $500 con descuento).
    - Selector de Producto Disparador y Producto Beneficio.
    - Tipo de descuento: `PORCENTAJE` (%) o `MONTO_FIJO` ($).
    - Valor del descuento y Cantidad mínima requerida.
  - Tabla de Reglas Promocionales Activas:
    - Nombre de la promo, Tipo, Regla matemática, Estado (toggle activar/desactivar), Fecha de creación.
    - El motor evalúa estas reglas automáticamente en el carrito del POS en tiempo real.

---

## 4. Matriz Rápida de Componentes para Rediseño UI/UX

Esta tabla sirve como checklist consolidado para la creación de componentes en Figma o el nuevo diseño:

| Componente / Elemento | Tipo UI | Acciones / Interacciones | Dependencias Clave |
| :--- | :--- | :--- | :--- |
| **Píldora de Conectividad** | Badge / Status | Muestra latencia, estado offline y botón reintentar | `connectivityStore` |
| **Banners Offline** | Alert Banner | Notifica contingencia, antigüedad y sincronización manual | `connectivityStore`, `syncWorker` |
| **Centro de Notificaciones** | Popover / Drawer | Recibe eventos push WebSocket, marcar leídas, limpiar | `WebSocket`, `NotificationCenter` |
| **PerfilUsuarioModal** | Modal Dialog | Crop/compresión canvas, inputs de perfil, cambio de clave | `PUT /usuarios/me`, `authStore` |
| **AperturaCajaModal** | Modal Dialog | Input de fondo inicial, apertura de turno | `POST /caja/apertura` |
| **ArqueoCiegoModal** | Modal Completo | Conteo desglosado de billetes/monedas, override supervisor | `POST /caja/cierre/arqueo-ciego` |
| **TicketModal** | Modal / Print View | Vista térmica 80mm, impresión directa, descarga .txt | `window.print()`, ESC/POS |
| **VentaFlashGrid** | Touch Grid | Botones táctiles grandes, selección rápida, calculadora | `posStore` |
| **Carrito POS** | Tabla interactiva | Cantidad +/- , eliminar, resumen impuestos, descuentos promo | `posStore`, `promociones_engine` |
| **Drawer Historial Tickets** | Slide Drawer | Listado de tickets del turno, reimpresión y anulación | `GET /pos/ventas`, `PUT /anular` |
| **OrdenCompraModal** | Modal Form | Selección de proveedor, lista dinámica de productos y costos | `POST /inventario/ordenes-compra` |
| **Recepción Mercancía** | Modal / Stepper | Captura de fecha de caducidad y código de lote real | `POST /inventario/ordenes/{id}/recepcionar` |
| **Modal Corte Z** | Modal Imprimible | Resumen fiscal y de gaveta de fin de día | `GET /caja/corte-z` |
| **Supervisor Override** | Modal de Seguridad | Input de credenciales de supervisor en caliente | `POST /auth/supervisor-override` |
| **Gráfica de Ventas (BI)** | Area Chart | Tooltip, zoom, comparación ventas vs margen | `Recharts`, `DuckDB Gold` |
| **Tabla Inferencia Demanda** | Data Table | Intervalos de confianza 95%, visualización de campana | `/dashboard/estrategico` |
| **Pipeline ETL Runner** | Action Card | Estado del job DuckDB, botón de ejecución manual | `/operaciones/etl/ejecutar` |
| **Supervisión Conflictos Sync** | Data Table + Modal | KPIs de incidencias, filtro por estado, modal de resolución | `/sync/conflictos`, `/resolver` |
| **Editor de Promociones** | Modal Builder | Constructor de combos, 2x1, volumen y montos mínimos | `/promociones` |
| **Editor de Parámetros** | Form Grid | SMTP con test de envío, tolerancias de descuadre y FEFO | `/configuracion` |
