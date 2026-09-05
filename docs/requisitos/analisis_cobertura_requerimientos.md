# Análisis de Cobertura de Requisitos (Gap Analysis)

Este documento mapea los requisitos definidos en el SRS (`docs/requisitos/especificacion_requisitos.md`) contra los módulos de especificación (`specs/`) actuales. El objetivo es confirmar qué está cubierto y revelar qué falta para llegar al 100% de la arquitectura.

## 🟢 1. Requisitos Totalmente Cubiertos

### Módulo 1: Punto de Venta (POS) y Cobro Ágil
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-POS-01** | Búsqueda y Cobro Rápido (< 200ms) | `001-core-ventas-inventario` |
| **RF-POS-02** | Cobro Multimodal Integrado (Pasarelas) | `007-pagos-seguridad` |
| **RF-POS-03** | Identificación Ágil de Cliente | `002-clientes-fidelizacion` |
| **RF-POS-04** | Operación Offline-First | `008-offline-sync` |
| **RNF-DISP-02**| Base de datos local (SQLite) tolerante a fallos | `008-offline-sync` |

### Módulo 2: Inventario FEFO y Reaprovisionamiento
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-INV-01** | Trazabilidad por Lote y Vencimiento | `001-core-ventas-inventario` |
| **RF-INV-02** | Asignación Automática FEFO | `001-core-ventas-inventario` |
| **RF-INV-03** | Alerta Preventiva de Caducidad | `004-pronostico-demanda` |
| **RF-INV-04** | Cálculo de Punto de Reorden | `004-pronostico-demanda` |
| **RF-INV-05** | Detección de Sobre-Inventario | `004-pronostico-demanda` |

### Módulo 3: Precios, Rentabilidad y Margen
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-PRC-01** | Clasificación Estratégica (Loss Leader/Nicho) | `003-precios-margenes` |
| **RF-PRC-02** | Cálculo del Margen en Tiempo Real | `001-core-ventas-inventario` y `003` |
| **RF-PRC-03** | Protección contra Pérdidas por Reposición | `003-precios-margenes` |
| **RF-PRC-04** | Reglas de Promociones Cruzadas | `005-promociones-inteligentes` |

### Módulo 4: CRM, Hábitos y Fidelización
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-CRM-01** | Ficha de Perfil Unificada | `002-clientes-fidelizacion` |
| **RF-CRM-02** | Automatización de Cumpleaños (Cupones) | `002-clientes-fidelizacion` |
| **RF-CRM-03** | Análisis de Ciclo Intercompra Individual | `002-clientes-fidelizacion` |
| **RF-CRM-04** | Reactivación Antipánico de Clientes | `002-clientes-fidelizacion` |
| **RF-CRM-05** | Segmentación Dinámica RFM y LTV | `002-clientes-fidelizacion` (Operativo) y `009-etl-medallion` (Cálculo Analítico) |

### Módulo 5: Control Interno y Auditoría
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-SEG-01** | Arqueo Ciego de Caja | `006-caja-mermas-fraude` |
| **RF-SEG-02** | Detección Automática de Discrepancias | `006-caja-mermas-fraude` |
| **RF-SEG-04** | Registro Inmutable de Eventos Sospechosos | `006-caja-mermas-fraude` |
| **ERR-CAJ-01**| Cierre sin arqueo ciego bloqueado | `006-caja-mermas-fraude` |

---

## 🔴 2. Huecos Detectados (Lo que falta para el 100%)

Tras comparar el SRS con los 9 módulos actuales, el sistema tiene la lógica core, pero **le faltan 3 componentes esenciales** descritos en los requisitos:

### 🚨 Hueco 1: Autenticación, JWT y Aprobaciones (Falta `010-auth-usuarios`)
* **RF-POS-06:** "El sistema debe autenticar a cada operador con credenciales (usuario/PIN) al abrir caja".
* **RF-SEG-03:** "Las anulaciones y devoluciones deben requerir autenticación de un Supervisor".
* **RNF-SEG-03:** "Todo acceso a la API requiere autenticación JWT y control de permisos (RBAC)".
* **Diagnóstico:** Tenemos la tabla `USUARIO` en BD, pero no hemos especificado el endpoint de login, el hash de contraseñas (Argon2id), el middleware de validación de JWT, ni el endpoint para que el supervisor ingrese su PIN y autorice una anulación en vivo.

### 🚨 Hueco 2: Capa de Presentación Analítica / BI (Falta `011-tableros-bi`)
* **RF-BI-01:** "Tablero de Control de Mermas Táctico".
* **RF-BI-02:** "Matriz Estratégica Margen vs. Rotación".
* **RF-BI-03:** "Cuadro de Mando del Valor del Cliente (LTV)".
* **Diagnóstico:** El módulo `009-etl-medallion` construye maravillosamente las tablas Gold (hechos y dimensiones) en DuckDB, **pero no expone los datos**. Nos falta el módulo que defina los endpoints del Backend que hacen las consultas SQL sobre DuckDB y cómo el Frontend (React/Recharts) dibuja estos tableros para los directivos.

### 🚨 Hueco 3: Mensajería y Tickets Digitales (Falta `012-notificaciones`)
* **RF-POS-05:** "El sistema debe imprimir tickets físicos o enviar tickets digitales por correo electrónico/SMS con un enlace de fidelización".
* **RF-INV-03:** "Alertas preventivas de caducidad" (Requiere notificar a alguien).
* **Diagnóstico:** El módulo `001` genera el folio del ticket y lo guarda, pero falta la infraestructura (workers asíncronos o integración con SendGrid/Twilio/Impresoras ESC/POS) encargada de transformar ese folio en un PDF, enviarlo por correo o inyectarlo a la impresora térmica sin bloquear la velocidad del POS (<200ms).

---

## 3. Conclusión y Siguientes Pasos

El diseño actual (Módulos 001 a 009) cubre aproximadamente el **80% de los requisitos del SRS**, concentrándose en el core operativo y transaccional.

Para lograr el **100% de cobertura y cerrar el diseño arquitectónico**, es obligatorio crear los siguientes tres módulos de especificación:

1. `specs/010-auth-usuarios/` (Cierra la brecha de seguridad y sesiones).
2. `specs/011-tableros-bi/` (Cierra la brecha de nivel estratégico / EIS).
3. `specs/012-notificaciones/` (Cierra la brecha de comprobantes y alertas).
