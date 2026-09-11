# Especificación de Requisitos de Software (SRS) - Sistema Quantix

**Proyecto:** Quantix - Ecosistema Integral de Punto de Venta, Inventario Inteligente y Analítica Comercial  
**Versión:** 2.0 (Alineación Integral Multi-Sede, Logística y Gobernanza)  
**Fecha:** Septiembre 2026  
**Estándar de referencia:** Adaptado de IEEE 830 / ISO/IEC/IEEE 29148  
**Documentos base:** 
* [estrategia_negocios.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/negocio/estrategia_negocios.md)
* [analisis_organizacional.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/negocio/analisis_organizacional.md)
* [diseno_arquitectura_datos.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/diseno_arquitectura_datos.md)

---

## 1. Introducción

### 1.1 Propósito
El presente documento especifica los requisitos funcionales y no funcionales del sistema **Quantix**. Está dirigido al equipo de ingeniería de software, arquitectos de sistemas, analistas de negocio y tomadores de decisiones de la organización, sirviendo como contrato formal para el diseño, desarrollo, pruebas y despliegue del producto.

### 1.2 Alcance del Sistema
Quantix es una solución tecnológica integral orientada al comercio minorista (*retail*), diseñada para:
* Ejecutar procesos de venta de alta velocidad y cobro multimodal en caja con soporte de báscula pesable.
* Controlar existencias bajo el principio **FEFO** (*First Expired, First Out*) para erradicar pérdidas por caducidad en múltiples sedes físicas.
* Administrar la logística y transferencias de mercancía inter-sucursal preservando trazabilidad sanitaria.
* Proteger los márgenes brutos mediante el cálculo en tiempo real del coste de reposición y la salvaguarda de margen $\ge 0$ en checkout.
* Prevenir mermas y robos hormiga mediante arqueos ciegos, cortes fiscales X y Z, control de movimientos manuales de caja y auditoría inmutable de eventos.
* Fidelizar clientes mediante identificación ágil por Cédula o Teléfono, lealtad por puntos, cupones territoriales y segmentación RFM (*Recency, Frequency, Monetary*).
* Proporcionar cuadros de mando tácticos y estratégicos junto a un potente constructor ad-hoc de reportes OLAP sobre DuckDB Gold.

### 1.3 Definiciones, Acrónimos y Abreviaturas
* **POS (*Point of Sale*):** Terminal de Punto de Venta donde se procesa la transacción con el cliente.
* **FEFO (*First Expired, First Out*):** Método de rotación de inventario en el que el lote activo con fecha de caducidad más próxima es el primero en venderse.
* **Multi-Sede (Multi-Tenant Lógico):** Aislamiento estricto de inventario, cajas, clientes y reportes por sucursal física bajo un mismo backend centralizado.
* **Movimiento Manual de Caja (Ingreso/Egreso):** Entrada de dotación de cambio o salida justificada de efectivo de gaveta que altera el balance teórico de la sesión activa.
* **Transferencia Inter-Sucursal:** Movimiento custodiado de lotes entre una sucursal emisora y una receptora con estados de despacho y recepción.
* **Toast Notification:** Alerta flotante no invasiva con temporizador de autodestrucción montada en una capa superior global (`fixed top-20 right-6 z-50`).
* **LTV (*Customer Lifetime Value*):** Margen neto total aportado por un cliente a lo largo de su relación con el negocio.
* **RFM (*Recency, Frequency, Monetary*):** Metodología de segmentación basada en la última compra, la frecuencia de visitas y el gasto acumulado.
* **Arqueo Ciego:** Procedimiento de cuadre de caja donde el cajero declara el dinero contado físicamente sin conocer el total registrado por el sistema.
* **OLTP (*Online Transaction Processing*):** Modelo de base de datos relacional orientado a transacciones rápidas y consistentes (PostgreSQL).
* **OLAP (*Online Analytical Processing*):** Modelo de base de datos columnar optimizado para consultas analíticas y agregaciones masivas (DuckDB).
* **RBAC (*Role-Based Access Control*):** Control de acceso basado en roles y privilegios de usuario con aislamiento por sede física.

---

## 2. Descripción General

### 2.1 Perspectiva del Producto en la Organización
Quantix cubre integralmente los tres niveles de la **Pirámide Organizacional de Anthony**:
1. **Nivel Operativo (TPS / POS):** Registro de ventas, escaneo de artículos, balanza de pesaje, cobro electrónico, movimientos de caja y recepción física de mercancía.
2. **Nivel Táctico (MIS / DSS):** Conciliación de arqueos ciegos, cortes X y Z, traspasos inter-sucursales, gestión de caducidades FEFO, órdenes de reaprovisionamiento y campañas de fidelización.
3. **Nivel Estratégico (EIS / BI):** Cuadro de mando ejecutivo, matriz de Pareto ABC, constructor dinámico de reportes OLAP, valor de vida de clientes y proyecciones de demanda Z/t.

### 2.2 Perfiles de Usuario
| Rol | Nivel Anthony | Responsabilidades y Permisos | Ámbito Territorial |
| :--- | :--- | :--- | :--- |
| **Cajero / Operador** | Operativo | Registrar ventas, escanear códigos, balanza, ingresar pagos, abrir turnos, registrar movimientos de caja y realizar arqueos ciegos. | Confinado a su sucursal asignada (`current_user.sucursal_id`). |
| **Encargado de Bodega** | Operativo | Registrar recepciones de mercancía (totales o parciales), gestionar lotes sanitarios, despachar y recibir transferencias inter-sucursales. | Confinado a su sucursal asignada. |
| **Supervisor / Administrador de Tienda** | Táctico | Autorizar anulaciones y overrides en caliente, auditar arqueos ciegos, emitir cortes X y Z, autorizar transferencias de stock, gestionar pedidos a proveedores y emitir cupones locales. | Confinado estrictamente a su sucursal asignada con HTTP 403 ante accesos cruzados. |
| **Director General / Gerente Financiero** | Estratégico | Configurar parámetros globales, analizar tableros de BI DuckDB Gold, conmutar dinámicamente de sucursal o analizar el consolidado multi-sede, orquestar jobs ETL y administrar usuarios. | Global (acceso irrestricto a todas las sucursales). |

### 2.3 Restricciones de Diseño e Implementación
* **Aislamiento Estricto por Sede (RBAC):** El backend aplica obligatoriamente filtros por `sucursal_id` para todo usuario con rol distinto de `DIRECTOR` (`enforce_sucursal_scope`), devolviendo HTTP 403 si intenta solicitar recursos foráneos.
* **Arquitectura Offline-First en Caja:** El punto de venta continúa operando localmente ante caídas de internet utilizando IndexedDB nativo (`quantix_offline_db` v1). En modo offline solo se aceptan pagos en efectivo; al restaurarse la red, una cola FIFO con Web Locks API sincroniza las ventas con asignación FEFO en servidor sin permitir stock negativo.
* **Segregación de Entornos (Medallion):** La reportería analítica pesada se ejecuta exclusivamente sobre DuckDB Gold, sin saturar la base transaccional PostgreSQL.
* **Notificaciones Unificadas y No Invasivas:** Todo feedback visual se canaliza mediante el componente flotante `ToastContainer.tsx` en la esquina superior derecha, prohibiendo banners locales fijos en formularios o cabeceras.

---

## 3. Requisitos Específicos (Metodología MoSCoW)

### 3.1 Módulo 1: Punto de Venta (POS) y Cobro Ágil

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :---: | :--- |
| **RF-POS-01** | Búsqueda y Cobro Rápido | **MUST** | El sistema debe permitir escanear productos por código de barras o buscarlos por SKU/nombre con un tiempo de respuesta inferior a 200 ms por artículo, soportando artículos con pesaje en báscula (`requiere_pesaje`). |
| **RF-POS-02** | Cobro Multimodal e Idempotencia | **MUST** | El sistema debe procesar pagos en efectivo, tarjeta bancaria y billeteras digitales (QR DeUna), permitiendo pagos divididos (*split payment*) y garantizando idempotencia mediante `idempotency_key`. |
| **RF-POS-03** | Identificación Ágil de Cliente | **MUST** | El POS debe permitir asociar un cliente digitando indistintamente su **Cédula / DNI** o número de teléfono en menos de 2 segundos. |
| **RF-POS-04** | Operación Offline-First | **MUST** | El terminal debe permitir cobros en efectivo con catálogo local en IndexedDB ante caídas de red, sincronizando automáticamente con el servidor al reconectar sin generar stock negativo. |
| **RF-POS-05** | Emisión de Comprobantes | **MUST** | El sistema debe emitir tickets físicos térmicos y permitir el envío digital por correo electrónico en background (`EmailSender`). |
| **RF-POS-06** | Sesión de Caja Obligatoria | **MUST** | Toda venta requiere una sesión de caja activa vinculada al cajero (`sesion_caja_id`) y a la sucursal activa (`sucursal_id`). |
| **RF-POS-07** | Movimientos Manuales de Efectivo | **MUST** | El sistema debe permitir registrar ingresos extraordinarios (cambio) y egresos (gastos menores) de gaveta justificados, actualizando el saldo teórico en tiempo real. |

---

### 3.2 Módulo 2: Inventario FEFO, Reaprovisionamiento y Transferencias

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :---: | :--- |
| **RF-INV-01** | Trazabilidad por Lote y Vencimiento | **MUST** | Al ingresar mercancía, el sistema debe registrar obligatoriamente código de lote, costo unitario, fecha de vencimiento y sucursal física. |
| **RF-INV-02** | Asignación Automática FEFO Estricta | **MUST** | Al vender, el sistema debe descargar del stock el lote activo no caducado con vencimiento más próximo, aplicando bloqueo pesimista `SELECT ... FOR UPDATE`. |
| **RF-INV-03** | Alerta Preventiva de Caducidad | **MUST** | Alertas visuales y WebSocket con los lotes próximos a vencer en los umbrales configurados (15, 30, 45 días). |
| **RF-INV-04** | Sugerencias de Reorden Operativo | **MUST** | Cálculo automático de punto de reorden basado en la velocidad diaria a 30 días, lead time del proveedor y stocks de seguridad calibrados por clasificación ABC (A=15, B=10, C=5). |
| **RF-INV-05** | Recepción Parcial de Órdenes | **MUST** | Soporte para entregas parciales de proveedores (`RECIBIDA_PARCIAL` y `cantidad_recibida` acumulativa), generando lotes sanitarios trazables (`SAN-...`). |
| **RF-INV-06** | Transferencias Inter-Sucursales | **MUST** | Solicitud, despacho en tránsito (`EN_TRANSITO`) con descuento en origen, recepción física en destino (`RECIBIDA`) con nuevos lotes sanitarios (`TR-...`), o cancelación atómica con reversión. |

---

### 3.3 Módulo 3: Precios, Rentabilidad y Protección de Margen

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :---: | :--- |
| **RF-PRC-01** | Matriz Pareto ABC de Catálogo | **MUST** | Clasificación algorítmica continua de productos en clases A (80%), B (15%) y C (5%) según su facturación histórica acumulada en DuckDB Gold. |
| **RF-PRC-02** | Congelamiento de Margen en Renglón | **MUST** | Registro congelado del costo unitario del lote despachado y del margen monetario en cada fila de venta (`detalles_venta.margen_ganancia`). |
| **RF-PRC-03** | Salvaguarda Antiloss en Checkout | **MUST** | El motor de promociones limita cualquier descuento para que el ticket nunca se cobre por debajo del costo acumulado de los lotes despachados ($\text{Margen Bruto} \ge 0$). |
| **RF-PRC-04** | Reglas de Promociones Flexibles | **MUST** | Constructor de promociones con soporte para combos, descuentos por volumen y montos mínimos, aplicables a nivel de SKU o de categoría de producto. |

---

### 3.4 Módulo 4: CRM, Fidelización y Segmentación RFM

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :---: | :--- |
| **RF-CRM-01** | Perfil Unificado por Sucursal | **MUST** | Ficha de cliente con Cédula única, teléfono, email, saldo de puntos de lealtad, historial de tickets y sucursal de registro. |
| **RF-CRM-02** | Programa de Puntos de Lealtad | **MUST** | Acumulación de 1 punto por cada $10.00 en compras y redención directa en caja (10 puntos = $1.00 de descuento). |
| **RF-CRM-03** | Validación Territorial de Cupones | **MUST** | Emisión de cupones acotados a sucursal y verificación de compatibilidad territorial en caja para impedir fraudes inter-tienda. |
| **RF-CRM-04** | Segmentación Algorítmica RFM | **MUST** | Clasificación dinámica de clientes en 9 segmentos estratégicos sobre DuckDB Gold utilizando `NTILE(5)` en Recencia, Frecuencia y Valor Monetario. |

---

### 3.5 Módulo 5: Control de Caja, Arqueo Ciego y Auditoría

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :---: | :--- |
| **RF-SEG-01** | Arqueo Ciego de Fin de Turno | **MUST** | Declaración física de billetes y monedas sin revelar el saldo teórico del sistema en pantalla. |
| **RF-SEG-02** | Fórmula de Balance y Descuadres | **MUST** | Cálculo del saldo teórico: $\text{Fondo} + \text{Ventas Efectivo} + \text{Ingresos} - \text{Egresos}$. Tolerancia de $5.00 y alertas automáticas (WebSocket + Correo) para diferencias $> $50.00. |
| **RF-SEG-03** | Cortes Fiscales X y Z | **MUST** | Emisión de Corte X (balance provisional durante el turno) y Corte Z (cierre fiscal definitivo con folios inicial/final y arqueo). |
| **RF-SEG-04** | Autorización Supervisada (Override) | **MUST** | Modal en caliente para que el supervisor autorice anulaciones, descuentos o arqueos descuadrados mediante credenciales. |
| **RF-SEG-05** | Registro Inmutable de Auditoría | **MUST** | Bitácora `APPEND-ONLY` en `auditoria_evento` que almacena todas las excepciones operativas sin posibilidad de edición ni borrado. |

---

### 3.6 Módulo 6: Analítica Táctica, Estratégica y Reportes OLAP

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :---: | :--- |
| **RF-REP-01** | KPIs Ejecutivos Multidimensionales | **MUST** | Tarjetas comparativas de Ingresos, Margen Bruto %, Ticket Promedio, Transacciones y Clientes con variación porcentual (+/- %). |
| **RF-REP-02** | Tendencias Temporales Recharts | **MUST** | Gráficos interactivos comparando ingresos vs. márgenes con selector de periodicidad (Diario, Semanal, Mensual). |
| **RF-REP-03** | Inferencia Predictiva Z / Student-t | **MUST** | Proyecciones de demanda al 95% de confianza según tamaño muestral ($n \ge 30$ Normal Z, $n < 30$ Student-t) sobre DuckDB Gold. |
| **RF-REP-04** | Constructor Dinámico de Reportes OLAP | **MUST** | Motor ad-hoc con 15 columnas configurables, agregaciones dinámicas, filtros multidimensionales y fila fija de totales. |
| **RF-REP-05** | Plantillas Persistentes de Reporte | **MUST** | Guardado y recuperación de configuraciones de reporte en PostgreSQL (`plantillas_reporte`) con aislamiento por usuario y sede. |
| **RF-REP-06** | Exportación Multiformato Profesional | **MUST** | Exportación a CSV con BOM UTF-8 (compatible con Microsoft Excel) e impresión/guardado en PDF formal con membrete. |

---

## 4. Requisitos No Funcionales (RNF)

* **RNF-PERF-01:** Tiempo de respuesta en escaneo o búsqueda de productos en POS $\le 200$ ms.
* **RNF-PERF-02:** Latencia de checkout completa (FEFO, inserción de pagos y generación de ticket) $\le 1,500$ ms.
* **RNF-PERF-03:** Consultas analíticas y reportes dinámicos sobre DuckDB Gold responden en $\le 500$ ms.
* **RNF-DISP-01:** Continuidad operativa de cobro en efectivo ante caídas totales de red mediante arquitectura Offline-First en IndexedDB.
* **RNF-SEG-01:** Aislamiento estricto de sucursales con rechazo HTTP 403 Forbidden para usuarios sin rol directivo.
* **RNF-SEG-02:** No captura ni almacenamiento de datos sensibles de tarjetas bancarias (PAN, CVV).
* **RNF-USA-01:** Interfaz de notificaciones unificada: toasts flotantes de auto-descarte sin banners locales que rompan la disposición de pantalla.

---

## 5. Casos de Error y Excepciones de Negocio

| Código | Escenario de Excepción | Comportamiento Esperado del Sistema |
| :--- | :--- | :--- |
| **ERR-SUC-01** | Usuario no director intenta consultar o mutar datos de otra sucursal | Denegación inmediata con **HTTP 403 Forbidden** declarando restricción a sucursal asignada. |
| **ERR-TRF-01** | Intento de transferir cantidad superior al stock disponible en origen | Rechazo con **HTTP 400 Bad Request**; las existencias de origen permanecen intactas. |
| **ERR-CAJ-02** | Intento de egreso manual por monto mayor al efectivo en gaveta | Rechazo con **HTTP 400 Bad Request** por fondos insuficientes en caja. |
| **ERR-INV-01** | Lote FEFO caducado en la fecha actual | El sistema omite automáticamente el lote vencido y pasa al siguiente lote activo no caducado. |
| **ERR-INV-02** | Conflicto de stock al sincronizar ventas offline | El servidor marca la venta como `PENDIENTE_REVISION`, no crea venta en producción y genera una `IncidenciaSync` (`STOCK_INSUFICIENTE`). |
| **ERR-CRM-01** | Intento de uso de cupón en sucursal ajena | Rechazo con **HTTP 400 Bad Request** informando incompatibilidad territorial del cupón. |
| **ERR-PAG-01** | Timeout en pasarela de pago simulada (`SIM-TIMEOUT`) | Retención de intento con estado `INCIERTO` y requerimiento de conciliación supervisada con registro en auditoría. |

---

## 6. Matriz de Trazabilidad: Pilares de Negocio vs. Requisitos

| Pilar Estratégico | Requisitos Funcionales | Requisitos No Funcionales |
| :--- | :--- | :--- |
| **1. Agilidad de Cobro y Contingencia** | `RF-POS-01`, `RF-POS-02`, `RF-POS-04`, `RF-POS-05`, `RF-POS-06` | `RNF-PERF-01`, `RNF-PERF-02`, `RNF-DISP-01` |
| **2. Control FEFO y Logística Multi-Sede**| `RF-INV-01`, `RF-INV-02`, `RF-INV-03`, `RF-INV-05`, `RF-INV-06` | `RNF-SEG-01` |
| **3. Precios, Rentabilidad y Reabastecimiento**| `RF-PRC-01`, `RF-PRC-02`, `RF-PRC-03`, `RF-PRC-04`, `RF-INV-04` | `RNF-PERF-03` |
| **4. CRM, Lealtad y Hábitos** | `RF-POS-03`, `RF-CRM-01`, `RF-CRM-02`, `RF-CRM-03`, `RF-CRM-04` | `RNF-SEG-01` |
| **5. Prevención de Mermas y Fraude** | `RF-POS-07`, `RF-SEG-01`, `RF-SEG-02`, `RF-SEG-03`, `RF-SEG-04`, `RF-SEG-05` | `RNF-USA-01` |
| **6. Business Intelligence y Reportes OLAP**| `RF-REP-01`, `RF-REP-02`, `RF-REP-03`, `RF-REP-04`, `RF-REP-05`, `RF-REP-06` | `RNF-PERF-03` |
