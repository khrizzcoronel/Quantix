# Especificación de Requisitos de Software (SRS) - Sistema Quantix

**Proyecto:** Quantix - Ecosistema Integral de Punto de Venta, Inventario Inteligente y Analítica Comercial  
**Versión:** 1.0  
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
* Ejecutar procesos de venta de alta velocidad y cobro multimodal en caja.
* Controlar existencias bajo el principio **FEFO** (*First Expired, First Out*) para erradicar pérdidas por caducidad.
* Proteger los márgenes brutos mediante el cálculo en tiempo real del coste de reposición.
* Prevenir mermas y robos hormiga mediante arqueos ciegos y auditoría de eventos sospechosos.
* Fidelizar clientes mediante segmentación RFM (*Recency, Frequency, Monetary*) y automatizaciones personalizadas.
* Proporcionar cuadros de mando tácticos y estratégicos para la toma de decisiones directivas basada en datos.

### 1.3 Definiciones, Acrónimos y Abreviaturas
* **POS (*Point of Sale*):** Terminal de Punto de Venta donde se procesa la transacción con el cliente.
* **FEFO (*First Expired, First Out*):** Método de rotación de inventario en el que el lote con fecha de caducidad más próxima es el primero en venderse.
* **LTV (*Customer Lifetime Value*):** Valor del tiempo de vida del cliente; margen neto total aportado por un cliente a lo largo de su relación con el negocio.
* **RFM (*Recency, Frequency, Monetary*):** Metodología de segmentación basada en la última compra, la frecuencia de visitas y el gasto acumulado.
* **Loss Leader (Producto Gancho):** Producto vendido con margen mínimo o nulo para atraer afluencia de clientes al local.
* **Arqueo Ciego:** Procedimiento de cuadre de caja donde el cajero declara el dinero contado físicamente sin conocer el total registrado por el sistema.
* **OLTP (*Online Transaction Processing*):** Modelo de base de datos orientado a transacciones rápidas y consistentes.
* **OLAP (*Online Analytical Processing*):** Modelo de base de datos optimizado para consultas analíticas y agregaciones masivas.
* **RBAC (*Role-Based Access Control*):** Control de acceso basado en roles y privilegios de usuario.

---

## 2. Descripción General

### 2.1 Perspectiva del Producto en la Organización
Quantix cubre integralmente los tres niveles de la **Pirámide Organizacional de Anthony**:
1. **Nivel Operativo (TPS / POS):** Registro de ventas, escaneo de artículos, cobro electrónico y recepción de mercancía física.
2. **Nivel Táctico (MIS / DSS):** Conciliación de arqueos, gestión de caducidades, órdenes de reaprovisionamiento y campañas de fidelización.
3. **Nivel Estratégico (EIS / BI):** Matriz de rentabilidad por producto/categoría, valor de vida de clientes y proyecciones de demanda.

### 2.2 Perfiles de Usuario
| Rol | Nivel Anthony | Responsabilidades y Permisos |
| :--- | :--- | :--- |
| **Cajero / Operador** | Operativo | Registrar ventas, escanear códigos, ingresar pagos, abrir turnos y realizar arqueos ciegos. No puede anular ventas ni aplicar descuentos manuales libres. |
| **Encargado de Bodega** | Operativo | Registrar entradas de mercancía, asociar número de lote y fecha de vencimiento, realizar conteos físicos cíclicos. |
| **Supervisor / Administrador de Tienda** | Táctico | Autorizar anulaciones y devoluciones, auditar diferencias de arqueo, gestionar pedidos a proveedores y programar cupones de marketing. |
| **Director General / Gerente Financiero** | Estratégico | Configurar matrices de precios y márgenes mínimos, analizar tableros de BI, evaluar LTV y métricas financieras de merma. |

### 2.3 Restricciones de Diseño e Implementación
* **Arquitectura Offline-First en Caja:** El punto de venta debe continuar operando y emitiendo tickets aunque se interrumpa la conexión a internet.
* **Segregación de Entornos:** La reportería analítica pesada no debe ejecutarse directamente sobre la base de datos transaccional en producción para no degradar el cobro.
* **Cumplimiento y Privacidad:** El almacenamiento de datos de clientes debe cumplir con regulaciones de protección de datos (RGPD / regulaciones locales), permitiendo opt-in de marketing y derecho al olvido.
* **Estrategia Offline-First:** En modo sin conectividad, el POS solo aceptará pagos en efectivo. Los pagos electrónicos requieren conexión activa con la pasarela. Las ventas offline se almacenan localmente (SQLite/IndexedDB) y se sincronizan con resolución de conflictos de stock al reconectarse.

---


## 3. Requisitos Específicos

Los requisitos funcionales se priorizan mediante la metodología **MoSCoW**:
* **MUST:** Obligatorio para la versión inicial.
* **SHOULD:** Altamente deseable; su ausencia tiene alternativas operativas temporales.
* **COULD:** Opcional o para fases de madurez posteriores.

---

### 3.1 Módulo 1: Punto de Venta (POS) y Cobro Ágil

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :--- | :--- |
| **RF-POS-01** | Búsqueda y Cobro Rápido | **MUST** | El sistema debe permitir escanear productos por código de barras o buscarlos por SKU/nombre con un tiempo de respuesta de pantalla inferior a 200 ms por artículo. |
| **RF-POS-02** | Cobro Multimodal Integrado | **MUST** | El sistema debe procesar pagos en efectivo, tarjeta de débito/crédito (vía integración con pasarela/datáfono moderno) y billeteras digitales (código QR), permitiendo pagos divididos (*split payment*). |
| **RF-POS-03** | Identificación Ágil de Cliente | **MUST** | El POS debe permitir asociar un cliente a la venta digitando únicamente su número de teléfono o escaneando un código QR personal en menos de 3 segundos. La asignación de cliente debe ser opcional para ventas rápidas. |
| **RF-POS-04** | Operación Offline-First | **MUST** | El terminal POS debe permitir seguir registrando ventas localmente ante caídas de red, sincronizando automáticamente las transacciones con el servidor central al reanudarse la conexión. |
| **RF-POS-05** | Emisión de Comprobantes | **MUST** | El sistema debe imprimir tickets físicos o enviar tickets digitales por correo electrónico/SMS con un enlace para que el cliente complete su perfil de fidelización. |
| **RF-POS-06** | Gestión de Usuarios y Sesión | **MUST** | El sistema debe autenticar a cada operador con credenciales propias (usuario y PIN/contraseña) al abrir sesión de caja. El rol del usuario autenticado determina las acciones disponibles en el POS. |

---

### 3.2 Módulo 2: Inventario FEFO y Reaprovisionamiento

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :--- | :--- |
| **RF-INV-01** | Trazabilidad por Lote y Vencimiento | **MUST** | Al ingresar mercancía perecedera, el sistema debe exigir obligatoriamente el número de lote, costo unitario de compra y fecha de vencimiento. |
| **RF-INV-02** | Asignación Automática FEFO | **MUST** | Al vender un artículo, el sistema debe descargar automáticamente del stock el lote cuya fecha de vencimiento sea la más próxima (*First Expired, First Out*). |
| **RF-INV-03** | Alerta Preventiva de Caducidad | **MUST** | El sistema debe generar alertas visuales y reportes tácticos diarios con los lotes que vencen en los próximos 15, 30 y 45 días, calculando el valor monetario en riesgo. |
| **RF-INV-04** | Cálculo de Punto de Reorden | **SHOULD** | El sistema debe calcular el umbral de reorden para cada SKU con base en la velocidad de venta diaria y el tiempo de entrega del proveedor (*lead time*), emitiendo sugerencias de compra automáticas. |
| **RF-INV-05** | Detección de Sobre-Inventario | **SHOULD** | El sistema debe identificar productos con rotación inferior a 90 días cuyo capital inmovilizado supere el límite parametrizado por la gerencia. |

---

### 3.3 Módulo 3: Precios, Rentabilidad y Margen

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :--- | :--- |
| **RF-PRC-01** | Clasificación Estratégica de Catálogo | **MUST** | El sistema debe clasificar cada producto según su función comercial: `GANCHO` (*Loss Leader*), `NICHO` (alto margen) o `REGULAR`. |
| **RF-PRC-02** | Cálculo del Margen en Tiempo Real | **MUST** | El sistema debe registrar en cada línea de venta el costo unitario del lote despachado y calcular el margen bruto monetario y porcentual exacto en el momento de la transacción. |
| **RF-PRC-03** | Protección contra Pérdidas por Reposición | **MUST** | Si el costo de una nueva compra a proveedor reduce el margen por debajo del `margen_minimo_pct` configurado, el sistema debe notificar al administrador para que ajuste el precio de venta. |
| **RF-PRC-04** | Reglas de Promociones Cruzadas | **SHOULD** | El sistema debe permitir crear reglas automatizadas de combos (ej. descuento en producto de nicho al adquirir un producto gancho) asegurando que el margen global del ticket sea positivo. |

---

### 3.4 Módulo 4: CRM, Hábitos de Consumo y Fidelización

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :--- | :--- |
| **RF-CRM-01** | Ficha de Perfil Unificada | **MUST** | El sistema debe mantener una ficha por cliente con historial consolidado de compras, ticket medio, margen aportado, fecha de cumpleaños y preferencias de contacto. |
| **RF-CRM-02** | Automatización de Cumpleaños | **MUST** | El sistema debe emitir y enviar cupones de descuento automáticos válidos durante el mes o semana de cumpleaños del cliente. |
| **RF-CRM-03** | Análisis de Ciclo Intercompra Individual | **MUST** | El sistema debe calcular el intervalo promedio de días entre compras para cada cliente habitual. |
| **RF-CRM-04** | Reactivación Antipánico de Clientes | **SHOULD** | El motor de fidelización solo debe disparar incentivos o descuentos de reactivación si el tiempo transcurrido desde la última compra del cliente supera en un 50% su ciclo habitual individual, evitando canibalizar márgenes en clientes que iban a regresar. |
| **RF-CRM-05** | Segmentación Dinámica RFM | **SHOULD** | El sistema debe clasificar automáticamente a los clientes en segmentos (*Campeones*, *Leales*, *En Riesgo*, *Dormidos*) calculando scores de 1 a 5 para Recencia, Frecuencia y Valor Monetario. |

---

### 3.5 Módulo 5: Control Interno, Arqueo Ciego y Auditoría

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :--- | :--- |
| **RF-SEG-01** | Arqueo Ciego de Caja | **MUST** | Al cerrar turno, el cajero debe declarar los montos físicos contados (efectivo y váuchers de tarjeta) sin que la pantalla revele el saldo teórico esperado por el sistema. |
| **RF-SEG-02** | Detección Automática de Discrepancias | **MUST** | Tras la confirmación del conteo ciego, el sistema debe calcular la diferencia (faltante/sobrante) y notificar al supervisor en caso de descuadres superiores a la tolerancia definida. |
| **RF-SEG-03** | Autorización Supervisada de Operaciones Críticas | **MUST** | Las anulaciones de tickets completos, devoluciones de mercancía y descuentos manuales deben requerir autenticación (PIN o credenciales) de un usuario con rol de Supervisor. |
| **RF-SEG-04** | Registro Inmutable de Eventos Sospechosos | **MUST** | Toda apertura del cajón portamonedas sin venta asociada, intento fallido de cobro o anulación debe registrarse en una tabla de auditoría `APPEND-ONLY` que no pueda ser editada ni eliminada por ningún usuario. |

---

### 3.6 Módulo 6: Analítica Táctica y Estratégica (BI)

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :--- | :--- |
| **RF-BI-01** | Tablero de Control de Mermas Táctico | **MUST** | Vista consolidada para administradores que muestre discrepancias de caja por turno/cajero, aperturas sin venta y productos dados de baja por caducidad. |
| **RF-BI-02** | Matriz Estratégica Margen vs. Rotación | **SHOULD** | Dashboard gráfico para gerencia que posicione los productos en una matriz de cuatro cuadrantes (volumen de venta vs. porcentaje de margen) para validar la efectividad de la estrategia *loss leader*. |
| **RF-BI-03** | Cuadro de Mando del Valor del Cliente (LTV) | **SHOULD** | Reporte del valor acumulado de vida de los clientes agrupados por canal de captación y segmento RFM. |
| **RF-BI-04** | Proyección de Demanda sin Distorsión | **COULD** | Algoritmo predictivo para sugerencias de compras que excluya automáticamente los periodos con rotura de stock para no subestimar la demanda real. |

---

### 3.7 Módulo 7: Análisis Estadístico & Reportes Avanzados (OLAP)

*Documento detallado de especificación:* [especificacion_modulo_analisis_reportes.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/requisitos/especificacion_modulo_analisis_reportes.md)

| Código | Nombre del Requisito | Prioridad | Descripción |
| :--- | :--- | :--- | :--- |
| **RF-REP-01** | KPIs Ejecutivos Multidimensionales | **MUST** | Visualización consolidada de Ingresos Netos, Margen Bruto %, Ticket Medio, Transacciones Totales, Clientes Únicos y Unidades con variación porcentual contra el período anterior. |
| **RF-REP-02** | Tendencias Temporales Interactivas | **MUST** | Gráficos de área y línea interactivos comparando Ingresos vs. Margen con selector de periodicidad (Día, Semana, Mes) y tooltips enriquecidos. |
| **RF-REP-03** | Matriz Pareto ABC de Catálogo | **MUST** | Clasificación algorítmica acumulada de artículos (80% A, 15% B, 5% C) con visualización de curva de concentración y porcentaje de contribución. |
| **RF-REP-04** | Segmentación Algorítmica RFM | **MUST** | Agrupación dinámica de compradores en 5 grupos de valor (Campeones, Leales, Potenciales, En Riesgo, Inactivos) con scores de Recencia, Frecuencia y Monetario. |
| **RF-REP-05** | Heatmap de Estacionalidad | **MUST** | Matriz cromática 7×24 de transacciones y afluencia por día de la semana y franja horaria para optimización de personal y apertura de cajas. |
| **RF-REP-06** | Inferencia Predictiva Z / Student-t | **MUST** | Proyección de demanda con intervalos al 95% calculados automáticamente según el Teorema del Límite Central (Z para $n \ge 30$, Student-t para $n < 30$). |
| **RF-REP-07** | Constructor Dinámico de Reportes | **MUST** | Motor OLAP interactivo con 15 columnas predeterminadas configurables, reordenables y con toggles de visibilidad. |
| **RF-REP-08** | Filtros Cruzados y Agrupación Dinámica | **MUST** | Agregación dinámica por Día, Producto, Categoría, Cajero, Sucursal o Método de Pago con filtros multidimensionales. |
| **RF-REP-09** | Fila Fija de Totales y Paginación | **MUST** | Tabla de reportes con ordenación por cabeceras, paginación configurable y cálculo de totales acumulados fijos al pie. |
| **RF-REP-10** | Motor de Plantillas de Reporte Persistente | **SHOULD** | Almacenamiento y recuperación en un clic de configuraciones de reporte en base de datos (`plantillas_reporte`) con aislamiento por usuario. |
| **RF-REP-11** | Exportación Multiformato Profesional | **MUST** | Exportación de datos a CSV (UTF-8 con BOM para Microsoft Excel) y generación de PDF formal / impresión con membrete corporativo de Quantix. |
| **RF-REP-12** | Aislamiento de Sucursales RBAC | **MUST** | Los supervisores solo pueden consultar y reportar datos de su sucursal asignada (`current_user.sucursal_id`); los directores tienen acceso irrestricto multi-sucursal. |

---

## 4. Requisitos No Funcionales (RNF)

Siguiendo el estándar de calidad de software **ISO/IEC 25010**:

### 4.1 Rendimiento y Eficiencia de Tiempo (Performance)
* **RNF-PERF-01:** El tiempo de respuesta al escanear un código de barras o agregar un producto al carrito de venta debe ser inferior a **200 milisegundos**.
* **RNF-PERF-02:** El proceso de confirmación y cierre de una venta (emisión de ticket y rebaja de stock) no debe superar **1.5 segundos**.
* **RNF-PERF-03:** Las consultas del tablero analítico directivo deben responder en menos de **3 segundos** para agregaciones históricas de hasta 1 millón de registros.

### 4.2 Fiabilidad y Disponibilidad
* **RNF-DISP-01:** Disponibilidad del servicio de caja del **99.9%** durante horarios comerciales.
* **RNF-DISP-02:** En caso de corte de energía o fallo de red, el sistema no debe perder datos transaccionales en curso (tolerancia a fallos con base de datos local y *wal recovery*).

### 4.3 Seguridad y Protección de Datos
* **RNF-SEG-01:** Las contraseñas y tokens de sesión deben cifrarse mediante algoritmos robustos (mínimo Argon2id o bcrypt con costo adaptativo).
* **RNF-SEG-02:** El sistema no debe almacenar datos sensibles de tarjetas de crédito (PAN, CVV) en texto plano, delegando la captura de tarjeta a terminales certificados PCI-PTS o pasarelas tokenizadas.
* **RNF-SEG-03:** Todo acceso a la API debe requerir autenticación JWT con expiración corta y control de permisos granular (RBAC).

### 4.4 Usabilidad y Ergonomía
* **RNF-USA-01:** La interfaz del POS debe ser operable al 100% mediante atajos de teclado o interfaz táctil sin necesidad obligatoria de ratón.
* **RNF-USA-02:** La curva de aprendizaje para un cajero nuevo debe ser inferior a **2 horas** de inducción para operar cobros regulares.

### 4.5 Mantenibilidad y Escalabilidad
* **RNF-ESC-01:** La arquitectura debe mantener desacoplada la base de datos transaccional (OLTP) de la analítica (OLAP) mediante un pipeline de sincronización de eventos asíncrono.
* **RNF-ESC-02:** El sistema debe admitir escalamiento vertical y horizontal para soportar múltiples sucursales centralizadas en una única infraestructura analítica.

---

## 4.6 Casos de Error y Excepciones de Negocio

Los agentes de implementación deben manejar los siguientes escenarios de excepción con el comportamiento especificado:

| Código | Escenario de Excepción | Comportamiento Esperado del Sistema |
| :--- | :--- | :--- |
| **ERR-INV-01** | Stock del lote se agota a mitad de un checkout en curso | El sistema debe completar la venta con el stock disponible del siguiente lote FEFO. Si no hay más lotes, rechaza la línea con error `OUT_OF_STOCK` (HTTP 409) y mantiene el resto del carrito intacto. |
| **ERR-INV-02** | Dos cajas venden simultáneamente el último artículo de un lote | El bloqueo pesimista (`SELECT FOR UPDATE`) garantiza que solo una transacción prospera. La segunda recibe `STOCK_LOCK_CONFLICT` (HTTP 409) y debe reintentar con la siguiente unidad disponible. |
| **ERR-INV-03** | Devolución de producto cuyo lote ya caducó y fue dado de baja | Se registra la devolución pero el lote no se reactiva. El valor devuelto se registra como merma recuperada. Requiere autorización de Supervisor. |
| **ERR-CRM-01** | Cliente presenta cupón ya canjeado o expirado | El POS rechaza el cupón con mensaje claro al cajero. El intento de uso se registra en `AUDITORIA_EVENTO`. |
| **ERR-CRM-02** | Venta con cupón canjeado es posteriormente anulada | El cupón vuelve al estado `EMITIDO` solo si la anulación ocurre en el mismo turno de caja. Anulaciones en turnos posteriores requieren revisión manual de supervisor. |
| **ERR-PAG-01** | La pasarela de pago devuelve timeout o error de conexión | El sistema guarda la venta en estado `PENDIENTE_CONFIRMACION` y reintenta automáticamente hasta 3 veces con backoff exponencial. Si persiste el fallo, el cajero debe optar por otro método o cancelar. |
| **ERR-PAG-02** | Cobro duplicado detectado (mismo monto y referencia en < 60 segundos) | El segundo pago se rechaza por idempotencia. Se registra en `AUDITORIA_EVENTO` con tipo `REINTENTO_PAGO_DUPLICADO`. |
| **ERR-CAJ-01** | Cierre de sesión de caja sin haber realizado el arqueo ciego | El sistema bloquea el cierre y exige completar el arqueo. Si el supervisor fuerza el cierre, se registra en auditoría como `CIERRE_FORZADO`. |
| **ERR-SYNC-01** | Conflicto de stock al sincronizar ventas offline | El sistema aplica las ventas offline en orden cronológico. Si el stock ya fue agotado por ventas online durante la desconexión, la venta offline conflictiva se marca como `PENDIENTE_REVISION` y notifica al supervisor para resolución manual. |

---

## 5. Matriz de Trazabilidad: Negocio vs. Requisitos Funcionales

| Pilar de Negocio ([estrategia_negocios.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/negocio/estrategia_negocios.md)) | Requisitos Funcionales Asociados | Requisitos No Funcionales |
| :--- | :--- | :--- |
| **1. Agilidad y Pagos Electrónicos** | `RF-POS-01`, `RF-POS-02`, `RF-POS-04`, `RF-POS-05` | `RNF-PERF-01`, `RNF-PERF-02`, `RNF-DISP-01`, `RNF-USA-01` |
| **2. Precios y Rentabilidad** | `RF-PRC-01`, `RF-PRC-02`, `RF-PRC-03`, `RF-PRC-04`, `RF-BI-02` | `RNF-PERF-03`, `RNF-ESC-01` |
| **3. Fidelización y Base de Datos** | `RF-POS-03`, `RF-CRM-01`, `RF-CRM-02` | `RNF-SEG-03` |
| **4. Hábitos del Cliente y LTV** | `RF-CRM-03`, `RF-CRM-04`, `RF-CRM-05`, `RF-BI-03` | `RNF-ESC-01` |
| **5. Inventario y Demanda** | `RF-INV-01`, `RF-INV-02`, `RF-INV-03`, `RF-INV-04`, `RF-INV-05`, `RF-BI-04` | `RNF-PERF-02`, `RNF-DISP-02` |
| **6. Control de Merma y Seguridad** | `RF-SEG-01`, `RF-SEG-02`, `RF-SEG-03`, `RF-SEG-04`, `RF-BI-01` | `RNF-SEG-01`, `RNF-SEG-02` |
| **7. Analítica Avanzada y Reportes** | `RF-REP-01`, `RF-REP-02`, `RF-REP-03`, `RF-REP-04`, `RF-REP-05`, `RF-REP-06`, `RF-REP-07`, `RF-REP-08`, `RF-REP-09`, `RF-REP-10`, `RF-REP-11`, `RF-REP-12` | `RNF-PERF-03`, `RNF-ESC-01`, `RNF-ESC-02` |
