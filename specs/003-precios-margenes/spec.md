# Especificación Funcional: 003 - Precios, Rentabilidad y Protección de Margen

**Módulo:** 003-precios-margenes  
**Nivel Organizacional:** Táctico / Estratégico (MIS / EIS)  
**Estado:** DRAFT  
**Dependencias:** 001-core-ventas-inventario  

---

## 1. Problema y Objetivos
Los comercios a menudo venden a ciegas sin conocer con certeza qué artículos generan rentabilidad y cuáles generan pérdidas al cambiar el coste de reposición del proveedor.

Este módulo implementa:
* Clasificación de catálogo en productos `GANCHO` (*loss leaders*), `NICHO` y `REGULAR`.
* Alerta temprana de erosión de margen cuando el nuevo coste de compra supera el margen mínimo parametrizado (`margen_minimo_pct`).
* Matriz de margen bruto vs. volumen de rotación para análisis directivo.
