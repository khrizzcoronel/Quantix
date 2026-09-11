# Directorio de Documentación de Quantix Retail OS

Este directorio contiene la documentación formal de arquitectura, requisitos, diseño de interfaces, planes operativos y activos del sistema **Quantix Retail OS**.

---

## Estructura de Documentación

`
docs/
├── arquitectura/                        # Arquitectura técnica, datos y testing
│   ├── diseno_arquitectura_datos.md    # Modelos OLTP (PostgreSQL) y OLAP (DuckDB Gold)
│   ├── etl_medallion_architecture.md   # Pipeline Medallion (Bronze -> Silver -> Gold)
│   ├── estandar_testing.md             # Directrices y criterios de calidad para pruebas
│   └── stack_tecnologico_plan_implementacion.md # Stack tecnológico y roadmap
│
├── requisitos/                          # Especificaciones de Requisitos de Software (SRS)
│   ├── especificacion_requisitos.md    # SRS General (Módulos 1 al 7 y RNFs)
│   ├── especificacion_modulo_analisis_reportes.md # SRS Detallado Módulo 7 (Analítica & Reportes)
│   ├── analisis_cobertura_requerimientos.md       # Matriz de Cobertura y Gap Analysis (v6)
│   └── inventario_funcional_rediseno.md           # Inventario exhaustivo por rol para UI/UX
│
├── negocio/                             # Análisis estratégico y de negocio
│   ├── estrategia_negocios.md          # 6 Pilares de rentabilidad y modelo comercial
│   └── analisis_organizacional.md      # Pirámide de Anthony y perfiles organizacionales
│
├── planes/                              # Planes de implementación y continuidad
│   └── plan_continuacion_antigravity.md # Bitácora y decisiones de arquitectura offline
│
├── diseño/                              # 28 módulos de diseño de interfaz (Neo-Retail)
│   ├── pos_modo_estandar/
│   ├── inventario_trazabilidad_fefo/
│   ├── supervision_auditoria_override/
│   ├── dashboard_inferencia_predictiva/
│   ├── quantix_neo_retail/
│   └── ... (28 submódulos en código HTML)
│
└── assets/                              # Recursos gráficos y branding
    └── quantix_logo.png                # Logotipo oficial de Quantix
`

---

## Enlaces Rápidos a Documentos Clave

1. [Especificación de Requisitos de Software (SRS General)](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/requisitos/especificacion_requisitos.md)
2. [SRS Módulo 7: Análisis Estadístico & Reportes Avanzados](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/requisitos/especificacion_modulo_analisis_reportes.md)
3. [Análisis de Cobertura y Gap Analysis v6](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/requisitos/analisis_cobertura_requerimientos.md)
4. [Diseño de Arquitectura de Datos (OLTP & OLAP)](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/diseno_arquitectura_datos.md)
5. [Arquitectura del Pipeline Medallion ETL](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/etl_medallion_architecture.md)
6. [Inventario Funcional para Rediseño UI/UX](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/requisitos/inventario_funcional_rediseno.md)
