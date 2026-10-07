# PapaLeki API

Backend Express.js complet pour une plateforme pastorale de diffusion de prédications audio. Le projet utilise TypeScript, PostgreSQL 16 et un worker FFmpeg séparé.

## Fonctionnalités

- Authentification administrateur par sessions opaques et cookies `httpOnly`.
- Rotation des sessions, verrouillage après échecs, mot de passe oublié et invitations.
- Rôles : super administrateur, administrateur, éditeur et analyste.
- CRUD des prédications, prédicateurs, catégories, séries et mots-clés.
- CRUD des pages, témoignages, paramètres et messages de contact.
- Gestion des utilisateurs, rôles et journal d’audit.
- Upload sécurisé des audios et images.
- Traitement audio asynchrone avec FFmpeg : validation, normalisation, conversion MP3 et waveform.
- Programmation des publications.
- Statistiques d’écoute, téléchargements, partages et complétions.
- Likes anonymes par prédication, dédupliqués par visiteur.
- Streaming audio avec requêtes HTTP `Range` et reprise de lecture.
- Réponses publiques cacheables pour une utilisation PWA.
- Documentation OpenAPI accessible à `/docs`.
- API worker protégée par une clé dédiée.
- Arrêt gracieux, logs structurés, limitation de débit et en-têtes de sécurité.

## Démarrage avec Docker

1. Remplacer tous les secrets de démonstration dans `compose.yaml`.
2. Lancer les services :

```bash
docker compose up --build
```

Cette commande lance PostgreSQL, installe le schéma, démarre l’API sur `http://localhost:4000` et démarre le worker audio.

## Démarrage local

Prérequis : Node.js 22+, PostgreSQL 16+, FFmpeg et FFprobe.

```bash
npm install
copy .env.example .env
psql -v ON_ERROR_STOP=1 -d papaleki -f database/install.sql
npm run dev
```

Dans un deuxième terminal :

```bash
npm run dev:worker
```

## Premier administrateur

Après l’installation de la base, définir temporairement les quatre variables suivantes puis lancer la commande. Le script génère lui-même le hash Argon2id :

```powershell
$env:INITIAL_ADMIN_EMAIL="admin@exemple.cd"
$env:INITIAL_ADMIN_PASSWORD="UnMotDePasseTresSolide123"
$env:INITIAL_ADMIN_FIRST_NAME="Prénom"
$env:INITIAL_ADMIN_LAST_NAME="Nom"
npm run admin:bootstrap
```

La procédure refuse automatiquement de créer un second compte initial.

## Principales routes

### Publiques

- `GET /api/v1/app-config`
- `GET /api/v1/sermons`
- `GET /api/v1/sermons/:slug`
- `POST /api/v1/sermons/:id/events`
- `GET /api/v1/sermons/:id/like`
- `POST /api/v1/sermons/:id/like`
- `GET /api/v1/categories`
- `GET /api/v1/series`
- `GET /api/v1/preachers`
- `GET /api/v1/pages/:slug`
- `GET /api/v1/testimonials`
- `GET /api/v1/settings`
- `POST /api/v1/contact`
- `GET /api/v1/media/:id`
- `GET /api/v1/media/:id/stream`

### Authentification

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/accept-invitation`
- `POST /api/v1/auth/change-password`

### Administration

Toutes les ressources suivantes possèdent les routes de lecture, création, modification ou suppression adaptées :

- `/api/v1/admin/sermons`
- `/api/v1/admin/preachers`
- `/api/v1/admin/categories`
- `/api/v1/admin/series`
- `/api/v1/admin/tags`
- `/api/v1/admin/media`
- `/api/v1/admin/pages`
- `/api/v1/admin/testimonials`
- `/api/v1/admin/messages`
- `/api/v1/admin/settings`
- `/api/v1/admin/users`
- `/api/v1/admin/roles`
- `/api/v1/admin/audio-jobs`
- `/api/v1/admin/audit-logs`
- `/api/v1/admin/dashboard`
- `/api/v1/admin/statistics/sermons`

Les actions de publication, programmation, archivage, relance de traitement et maintenance disposent de routes dédiées.

## Frontend React et PWA

Le frontend se trouve dans `frontend/`. Il contient le site public responsive, le lecteur audio persistant, l’authentification et les vues d’administration opérationnelles. Vite génère le manifeste et le service worker de la PWA pendant la compilation.

```bash
cd frontend
npm install
npm run dev
npm run typecheck
npm run build
```

En développement, Vite sert l’interface sur `http://localhost:3000` et redirige `/api` vers le backend sur `http://localhost:4000`. Ces valeurs peuvent être adaptées dans `frontend/.env` à partir de `frontend/.env.example`.

Le backend fournit les éléments nécessaires au fonctionnement hors ligne et à l’écoute continue :

- `app-config` regroupe les données essentielles au démarrage.
- Les contenus publics utilisent `Cache-Control`, `ETag` et `stale-while-revalidate`.
- Les audios acceptent `Range` pour reprendre la lecture.
- Les cookies de session sont invisibles au JavaScript.
- Le renouvellement de session se fait par `/auth/refresh`.
- Les URLs de média sont stables et peuvent être mises en cache selon la stratégie du frontend.

Pour les requêtes authentifiées du frontend, utiliser `credentials: "include"`.

## Déploiement Render

Le fichier `render.yaml` déploie l’ensemble en une seule Blueprint :

- une connexion à une base PostgreSQL Render existante via `DATABASE_URL` ;
- un service web Docker qui sert le frontend PWA, l’API Express et le traitement audio ;
- l’installation idempotente du schéma et la création facultative du premier administrateur au démarrage.

Dans le formulaire Blueprint, renseigner `DATABASE_URL`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_ADMIN_FIRST_NAME` et `INITIAL_ADMIN_LAST_NAME`. Le service doit être placé dans la même région que la base lorsque l’URL PostgreSQL interne est utilisée. Les deux secrets techniques sont générés automatiquement.

Le plan de test gratuit utilise le système de fichiers éphémère du service web : les audios téléversés peuvent disparaître après un redémarrage ou un redéploiement. Pour la production, brancher un stockage objet compatible S3 ou passer le service à un plan avec disque persistant.

## Traitement audio

Après l’upload, PostgreSQL crée automatiquement un job. Le worker :

1. réserve le prochain job disponible ;
2. vérifie la durée avec FFprobe ;
3. normalise le volume à environ −16 LUFS ;
4. convertit en MP3 128 kb/s ;
5. génère 600 points de waveform ;
6. met à jour la progression ;
7. rend automatiquement la prédication prête à publier.

## Commandes

```bash
npm run dev
npm run dev:worker
npm run typecheck
npm test
npm run build
npm run admin:bootstrap
npm start
npm run worker
```

## Vérifications effectuées

- Compilation TypeScript stricte.
- Tests Vitest et Supertest.
- Validation syntaxique de tous les scripts PostgreSQL.

Les tests d’intégration PostgreSQL et FFmpeg nécessitent les services Docker ou une installation locale de ces outils.
