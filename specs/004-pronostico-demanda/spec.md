# Especificación Funcional: 004 - Pronóstico de Demanda y Reaprovisionamiento

**Módulo:** 004-pronostico-demanda  
**Nivel Organizacional:** Táctico / Estratégico (DSS / EIS)  
**Estado:** DRAFT  
**Dependencias:** 001-core-ventas-inventario  

---

## 1. Problema y Objetivos
Las compras intuitivas generan sobrestock (capital inmovilizado) o roturas de stock. Además, un cálculo ingenuo de demanda subestima las ventas de artículos que estuvieron agotados.

Este módulo implementa:
* Cálculo automático de punto de reorden y stock de seguridad basado en tiempos de entrega del proveedor (*lead times*).
* Detección y filtrado de periodos con rotura de stock para corregir la demanda insatisfecha.
* Detección de capital inmovilizado en artículos de baja rotación (> 90 días).
