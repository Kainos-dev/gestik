// src/features/cargos/queries.ts
import { pool } from '@/lib/db';
import { Cargo, mapCargo } from './types';

// Cuánto se cubrió de cada cargo, aplicando los pagos del servicio en orden
// (el cargo más viejo se cubre primero — "waterfall"). El sobrante no
// consumido queda disponible para el próximo cargo que se genere: así es
// como un sobrepago se convierte en crédito para el período siguiente, sin
// necesidad de una entidad de "crédito" aparte.
export async function getCargos(): Promise<Cargo[]> {
    const { rows } = await pool.query(
        `WITH pagos_por_servicio AS (
       SELECT servicio_id, SUM(monto) AS total_pagado
       FROM pagos
       WHERE servicio_id IS NOT NULL
       GROUP BY servicio_id
     ),
     acumulado AS (
       SELECT
         c.*,
         SUM(c.monto) OVER (
           PARTITION BY c.servicio_id
           ORDER BY c.periodo, c.created_at, c.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS acumulado_hasta_este,
         COALESCE(pps.total_pagado, 0) AS total_pagado_servicio
       FROM cargos c
       LEFT JOIN pagos_por_servicio pps ON pps.servicio_id = c.servicio_id
     )
     SELECT
       a.id, a.cliente_id, a.servicio_id, a.periodo, a.monto, a.notas, a.created_at, a.updated_at,
       cl.nombre AS cliente_nombre,
       s.tipo AS servicio_tipo,
       s.nombre_personalizado AS servicio_nombre_personalizado,
       LEAST(a.monto, GREATEST(0, a.total_pagado_servicio - (a.acumulado_hasta_este - a.monto))) AS monto_cubierto
     FROM acumulado a
     JOIN clientes cl ON cl.id = a.cliente_id
     JOIN servicios s ON s.id = a.servicio_id
     ORDER BY a.periodo DESC`
    );
    return rows.map(mapCargo);
}

export interface SaldoCliente {
    clienteId: string;
    clienteNombre: string;
    saldo: number;
    cantidadCargos: number;
}

// Saldo pendiente por cliente (cargos - pagos, sin bajar de 0), sumando TODOS
// los pagos del cliente incluidos los que no están asociados a un servicio
// puntual. A diferencia de getCargos(), acá el clampeo es por cliente antes
// de cualquier suma agregada — el crédito de un cliente nunca debe
// compensar la deuda de otro.
export async function getSaldoPorCliente(): Promise<SaldoCliente[]> {
    const { rows } = await pool.query(
        `WITH cargos_cliente AS (
       SELECT cliente_id, SUM(monto) AS total_cargos, COUNT(*) AS cantidad_cargos
       FROM cargos
       GROUP BY cliente_id
     ),
     pagos_cliente AS (
       SELECT cliente_id, SUM(monto) AS total_pagado
       FROM pagos
       GROUP BY cliente_id
     )
     SELECT
       c.id AS cliente_id,
       c.nombre AS cliente_nombre,
       GREATEST(0, COALESCE(cc.total_cargos, 0) - COALESCE(pc.total_pagado, 0)) AS saldo,
       COALESCE(cc.cantidad_cargos, 0) AS cantidad_cargos
     FROM clientes c
     JOIN cargos_cliente cc ON cc.cliente_id = c.id
     LEFT JOIN pagos_cliente pc ON pc.cliente_id = c.id`
    );
    return rows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        saldo: Number(r.saldo),
        cantidadCargos: Number(r.cantidad_cargos),
    }));
}
