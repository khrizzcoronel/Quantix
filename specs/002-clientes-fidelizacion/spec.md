# Especificación Funcional: 002 - Clientes, Segmentación RFM y Fidelización

**Módulo:** 002-clientes-fidelizacion  
**Nivel Organizacional:** Táctico / Estratégico (MIS / EIS)  
**Estado:** DRAFT  
**Dependencias:** 001-core-ventas-inventario  

---

## 1. Problema y Objetivos
Los negocios suelen perder clientes valiosos sin notarlo o malgastan presupuesto ofreciendo descuentos apresurados a clientes que habrían regresado por cuenta propia. 

Este módulo implementa:
* Captura de cliente en caja en menos de 3 segundos (por teléfono).
* Cálculo del intervalo de compra habitual por cliente.
* Automatización de cupones de cumpleaños.
* Segmentación RFM (*Recency, Frequency, Monetary*) y cálculo de Customer Lifetime Value (LTV).

---

## 2. Historias de Usuario
* **Como** cajero, quiero registrar a un cliente nuevo usando únicamente su número de teléfono y nombre para no retrasar la cola de cobro.
* **Como** encargado de marketing, quiero que el sistema calcule el ciclo promedio de compra individual y solo envíe un recordatorio si el cliente se retrasa más del 50% de su ciclo natural.
* **Como** director general, quiero visualizar la distribución de clientes en la matriz RFM (*Campeones*, *Leales*, *En Riesgo*, *Dormidos*).
