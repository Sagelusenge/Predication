import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { hashToken } from '../src/lib/crypto.js';
import { camelize } from '../src/lib/serialize.js';
import { storagePath, storageRoot } from '../src/modules/media/storage.service.js';

describe('API core', () => {
  it('répond au contrôle de vie sans PostgreSQL', async () => {
    const response = await request(app).get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('alive');
  });

  it('retourne une erreur JSON pour une route inconnue', async () => {
    const response = await request(app).get('/route-inconnue');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Utilitaires', () => {
  it('convertit les clés SQL en camelCase', () => {
    expect(camelize({ first_name: 'Jean', nested_value: [{ play_count: 4 }] })).toEqual({
      firstName: 'Jean',
      nestedValue: [{ playCount: 4 }],
    });
  });

  it('produit un hash stable sans exposer le jeton', () => {
    const hash = hashToken('secret');
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashToken('secret'));
    expect(hash).not.toContain('secret');
  });

  it('empêche une clé de stockage de sortir du répertoire prévu', () => {
    expect(storagePath('images/test.webp')).toBe(path.join(storageRoot, 'images', 'test.webp'));
    expect(() => storagePath('../secret.txt')).toThrow();
  });
});
