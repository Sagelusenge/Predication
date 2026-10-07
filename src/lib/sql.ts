import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../db/pool.js';
import { AppError } from './errors.js';

type Queryable = Pick<PoolClient, 'query'>;

export const updateRow = async <T extends QueryResultRow>(
  table: string,
  id: string,
  input: Record<string, unknown>,
  columnMap: Record<string, string>,
  client: Queryable = pool,
): Promise<T> => {
  const entries = Object.entries(input).filter(
    ([key, value]) => value !== undefined && columnMap[key] !== undefined,
  );
  if (entries.length === 0) throw new AppError(422, 'NO_CHANGES', 'Aucune modification fournie.');

  const assignments = entries.map(([key], index) => `${columnMap[key]} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  values.push(id);
  const result = await client.query<T>(
    `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  const row = result.rows[0];
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Ressource introuvable.');
  return row;
};
