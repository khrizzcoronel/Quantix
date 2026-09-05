# Especificación Funcional: 006 - Control de Caja, Mermas y Prevención de Fraude

**Módulo:** 006-caja-mermas-fraude  
**Nivel Organizacional:** Operativo / Táctico (TPS / MIS)  
**Estado:** DRAFT  
**Dependencias:** 001-core-ventas-inventario  

---

## 1. Problema y Objetivos
Las pérdidas no controladas (robo hormiga, descuadres de caja y aperturas injustificadas) erosionan hasta un 20% de las ganancias anuales del comercio.

Este módulo implementa:
* **Arqueo Ciego Obligatorio:** El cajero declara lo que cuenta en efectivo y váuchers de tarjeta sin conocer el saldo teórico.
* **Control de Discrepancias:** Cálculo inmediato de faltantes y sobrantes tras el cierre de turno con notificación automática a supervisores.
* **Log Inmutable de Auditoría:** Registro `APPEND-ONLY` de anulaciones, descuentos libres y aperturas de cajón sin ticket asociado.
