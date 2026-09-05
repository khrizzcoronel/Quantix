# Análisis de Cobertura de Requisitos (Gap Analysis) v3

Este documento mapea los requisitos definidos en el SRS (`docs/requisitos/especificacion_requisitos.md`) contra los módulos de especificación (`specs/`) actuales. Tras la última auditoría, se crearon los módulos faltantes y se llegó al 100% de la arquitectura.

## 🟢 1. Requisitos Funcionales Totalmente Cubiertos (100%)

### Módulo 1: Punto de Venta (POS) y Cobro Ágil
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-POS-01** | Búsqueda y Cobro Rápido (< 200ms) | `001-core-ventas-inventario` |
| **RF-POS-02** | Cobro Multimodal Integrado (Pasarelas) | `007-pagos-seguridad` |
| **RF-POS-03** | Identificación Ágil de Cliente | `002-clientes-fidelizacion` |
| **RF-POS-04** | Operación Offline-First | `008-offline-sync` |
| **RF-POS-05** | Emisión de Comprobantes (Email/SMS) | `012-notificaciones` |
| **RF-POS-06** | Gestión de Usuarios y Sesión (Login) | `010-auth-usuarios` |

### Módulo 2: Inventario FEFO y Reaprovisionamiento
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-INV-01** | Trazabilidad por Lote y Vencimiento | `001-core-ventas-inventario` |
| **RF-INV-02** | Asignación Automática FEFO | `001-core-ventas-inventario` |
| **RF-INV-03** | Alerta Preventiva de Caducidad | `004` (Lógica) + `012` (Alertas) |
| **RF-INV-04** | Cálculo de Punto de Reorden | `004-pronostico-demanda` |
| **RF-INV-05** | Detección de Sobre-Inventario | `004-pronostico-demanda` |

### Módulo 3: Precios, Rentabilidad y Margen
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-PRC-01** | Clasificación Estratégica | `003-precios-margenes` |
| **RF-PRC-02** | Cálculo del Margen en Tiempo Real | `001-core-ventas-inventario` y `003` |
| **RF-PRC-03** | Protección contra Pérdidas | `003-precios-margenes` |
| **RF-PRC-04** | Reglas de Promociones Cruzadas | `005-promociones-inteligentes` |

### Módulo 4: CRM, Hábitos y Fidelización
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-CRM-01** | Ficha de Perfil Unificada | `002-clientes-fidelizacion` |
| **RF-CRM-02** | Automatización de Cumpleaños | `002` + `012` (Envío) |
| **RF-CRM-03** | Análisis de Ciclo Intercompra Individual | `002-clientes-fidelizacion` |
| **RF-CRM-04** | Reactivación Antipánico de Clientes | `002-clientes-fidelizacion` |
| **RF-CRM-05** | Segmentación Dinámica RFM y LTV | `002` + `009-etl` |

### Módulo 5: Control Interno y Auditoría
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-SEG-01** | Arqueo Ciego de Caja | `006-caja-mermas-fraude` |
| **RF-SEG-02** | Detección Automática de Discrepancias | `006-caja-mermas-fraude` |
| **RF-SEG-03** | Autorización Supervisada | `010-auth-usuarios` (Override) |
| **RF-SEG-04** | Registro Inmutable de Eventos | `006-caja-mermas-fraude` |

### Módulo 6: Analítica Táctica y Estratégica (BI)
| Requisito | Descripción | Spec que lo implementa |
| :--- | :--- | :--- |
| **RF-BI-01** | Tablero Táctico (Mermas) | `011-tableros-bi` |
| **RF-BI-02** | Matriz Estratégica (Margen vs Rotación) | `011-tableros-bi` |
| **RF-BI-03** | Cuadro de Mando del LTV | `011-tableros-bi` |
| **RF-BI-04** | Proyección de Demanda (Z/T Stats) | `011-tableros-bi` |

---

## 🟢 2. Requisitos No Funcionales (RNFs) Destacados

* **RNF-DISP-02:** Base de datos local (SQLite) → `008-offline-sync`
* **RNF-SEG-01:** Contraseñas encriptadas → `010-auth-usuarios`
* **RNF-SEG-03:** Tokens JWT en endpoints → `010-auth-usuarios`
* **RNF-ESC-01:** Desacoplamiento OLTP y OLAP → `009-etl-medallion`
* **RNF-ESC-02:** Escalabilidad multi-sucursal → `013-multi-sucursal`

---

## 3. Conclusión

Con la adición de los módulos `010-auth-usuarios`, `011-tableros-bi`, `012-notificaciones`, y el módulo estructural de expansión `013-multi-sucursal`, se declara una **cobertura teórica del 100% de los requisitos del SRS (Software Requirements Specification)**. El sistema está ahora listo para iniciar la fase de codificación, asegurando que todos los casos límite y de negocio tienen una arquitectura sólida asignada.
