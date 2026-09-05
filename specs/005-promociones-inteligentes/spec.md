# Especificación Funcional: 005 - Promociones Inteligentes y Venta Cruzada

**Módulo:** 005-promociones-inteligentes  
**Nivel Organizacional:** Táctico (MIS / DSS)  
**Estado:** DRAFT  
**Dependencias:** 001-core-ventas-inventario, 003-precios-margenes  

---

## 1. Problema y Objetivos
Las promociones descontroladas pueden canibalizar los beneficios netos del negocio si no consideran el margen global del ticket.

Este módulo implementa:
* Reglas automatizadas de combos y venta cruzada (ej. producto gancho + producto nicho).
* Validación de margen mínimo por ticket antes de aplicar un descuento promocional.
* Liquidación acelerada de lotes próximos a caducar según alertas FEFO.
