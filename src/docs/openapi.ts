import { env } from '../config/env.js';

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'PapaLeki API',
    version: '1.0.0',
    description: 'API du site pastoral, de son administration et de la diffusion audio.',
  },
  servers: [{ url: `${env.API_URL}/api/v1` }],
  tags: [
    { name: 'Public' },
    { name: 'Authentication' },
    { name: 'Administration' },
    { name: 'Media' },
    { name: 'Worker' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'pl_access' },
      bearerAuth: { type: 'http', scheme: 'bearer' },
      workerKey: { type: 'apiKey', in: 'header', name: 'x-worker-key' },
    },
    schemas: {
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', const: false },
          error: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
          requestId: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health/live': { get: { tags: ['Public'], summary: 'État du processus', responses: { 200: { description: 'OK' } } } },
    '/health/ready': { get: { tags: ['Public'], summary: 'État de PostgreSQL', responses: { 200: { description: 'Prêt' }, 503: { description: 'Indisponible' } } } },
    '/auth/login': { post: { tags: ['Authentication'], summary: 'Connexion administrateur', responses: { 200: { description: 'Connecté' }, 401: { description: 'Identifiants invalides' } } } },
    '/auth/refresh': { post: { tags: ['Authentication'], summary: 'Renouveler la session', responses: { 200: { description: 'Session renouvelée' } } } },
    '/auth/logout': { post: { tags: ['Authentication'], summary: 'Déconnexion', security: [{ cookieAuth: [] }], responses: { 204: { description: 'Déconnecté' } } } },
    '/auth/me': { get: { tags: ['Authentication'], summary: 'Utilisateur actuel', security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { 200: { description: 'Profil' } } } },
    '/sermons': { get: { tags: ['Public'], summary: 'Catalogue public des prédications', responses: { 200: { description: 'Liste paginée' } } } },
    '/sermons/{slug}': { get: { tags: ['Public'], summary: 'Détail d’une prédication', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Prédication' }, 404: { description: 'Introuvable' } } } },
    '/sermons/{id}/like': { get: { tags: ['Public'], summary: 'Lire le statut du like', responses: { 200: { description: 'Statut et compteur' } } }, post: { tags: ['Public'], summary: 'Ajouter ou retirer un like', responses: { 200: { description: 'Like mis à jour' } } } },
    '/testimonials': { get: { tags: ['Public'], summary: 'Témoignages publiés', responses: { 200: { description: 'Liste' } } }, post: { tags: ['Public'], summary: 'Proposer un témoignage', responses: { 201: { description: 'Témoignage reçu' } } } },
    '/contact': { post: { tags: ['Public'], summary: 'Envoyer un message', responses: { 201: { description: 'Message reçu' } } } },
    '/media/{id}/stream': { get: { tags: ['Media'], summary: 'Diffusion audio avec support Range', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Audio complet' }, 206: { description: 'Segment audio' } } } },
    '/admin/dashboard': { get: { tags: ['Administration'], summary: 'Tableau de bord', security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { 200: { description: 'Indicateurs' } } } },
    '/admin/sermons': { get: { tags: ['Administration'], summary: 'Liste des prédications', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Liste' } } }, post: { tags: ['Administration'], summary: 'Créer une prédication', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Créée' } } } },
    '/admin/media/audio': { post: { tags: ['Media'], summary: 'Téléverser un audio', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Audio en traitement' } } } },
    '/admin/media/image': { post: { tags: ['Media'], summary: 'Téléverser une image', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Image prête' } } } },
    '/worker/jobs/claim': { post: { tags: ['Worker'], summary: 'Réserver un traitement audio', security: [{ workerKey: [] }], responses: { 200: { description: 'Traitement réservé' }, 204: { description: 'File vide' } } } },
  },
} as const;
