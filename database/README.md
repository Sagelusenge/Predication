# Base de données PapaLeki

Cette base PostgreSQL 16 couvre le site public, l’administration, le traitement des audios, les statistiques et la sécurité.

## Contenu

- `001_schema.sql` : extensions, types, tables, contraintes et index.
- `002_functions_triggers.sql` : fonctions métier et automatismes.
- `003_procedures.sql` : procédures de publication, traitement audio, statistiques et maintenance.
- `004_views.sql` : vues publiques, administratives et analytiques.
- `005_seed.sql` : rôles, permissions, paramètres, catégories et pages initiales.
- `006_bible.sql` : traductions, livres, versets, index de recherche et réglage du passage d’accueil.
- `007_notifications_content.sql` : notifications push, contenu pastoral et réglages associés.
- `008_function_search_paths.sql` : résolution sécurisée du schéma pour les fonctions, procédures et triggers.
- `bible-sources/` : textes VPL compressés et importés automatiquement par le serveur.
- `install.sql` : installation complète dans le bon ordre avec `psql`.

Toutes les tables et routines sont placées dans le schéma `papaleki`.

## Installation

Prérequis : PostgreSQL 16 ou une version récente compatible, avec le droit de créer les extensions `pgcrypto`, `citext` et `unaccent`.

Depuis le dossier `database` :

```bash
psql -v ON_ERROR_STOP=1 -d nom_de_la_base -f install.sql
```

Les six scripts utilisent des transactions. Une erreur annule donc le script concerné au lieu de laisser une installation partielle.

## Premier super administrateur

Le mot de passe doit être hashé par le serveur avec Argon2id ou bcrypt. Il ne faut jamais envoyer un mot de passe en clair à cette procédure.

```sql
CALL papaleki.sp_bootstrap_super_admin(
    'admin@exemple.cd',
    '$argon2id$HASH_GENERE_PAR_LE_SERVEUR',
    'Prénom',
    'Nom',
    NULL
);
```

La procédure ne fonctionne qu’une seule fois, lorsque la table des utilisateurs est encore vide.

## Principales tables

### Sécurité

- `users`, `roles`, `permissions`
- `user_roles`, `role_permissions`
- `auth_sessions`, `password_reset_tokens`, `user_invitation_tokens`, `auth_events`
- `audit_logs`

### Prédications et médias

- `preachers`
- `sermons`, `sermon_categories`, `sermon_series`
- `sermon_tags`, `sermon_tag_links`
- `media_files`, `audio_processing_jobs`

### Audience

- `sermon_events`
- `sermon_daily_listeners`
- `sermon_daily_stats`

### Site public

- `pages`, `testimonials`
- `contact_messages`
- `site_settings`

### Bible multilingue

- `bible_translations` : langue, titre, licence, attribution et état d’import.
- `bible_books`, `bible_book_names` : canon de 66 livres et noms localisés.
- `bible_verses` : texte complet indexé par traduction, livre, chapitre et verset.

Les traductions livrées sont Louis Segond 1910 (domaine public), World English Bible
(domaine public) et Swahili Unlocked Literal Bible (CC BY-SA 4.0). Les notices et
liens vers les sources eBible.org sont conservés dans `bible_translations` et affichés
par le lecteur. La Bible complète kinande KB80 est proposée dans le même lecteur via
YouVersion, sous la licence de la Société biblique de la RDC et de la Société biblique
d’Ouganda. Son accès externe et son attribution sont enregistrés dans
`bible_translations`; son texte protégé n’est pas recopié dans PostgreSQL.

## Cycle d’une prédication

1. L’application crée l’image de couverture dans `media_files` avec le statut `ready`.
2. L’application crée le fichier audio dans `media_files` avec le statut `uploaded`.
3. Un trigger crée automatiquement un traitement dans `audio_processing_jobs` et place l’audio en file d’attente.
4. La prédication peut être enregistrée comme `draft` ou `processing`.
5. Un worker réclame un traitement avec `sp_claim_audio_job`.
6. Le worker envoie sa progression avec `sp_update_audio_progress`.
7. Il termine avec `sp_finish_audio_job`. L’audio et la prédication passent automatiquement à l’état prêt.
8. Un administrateur appelle `sp_publish_sermon` ou `sp_schedule_sermon`.
9. Une tâche planifiée appelle `sp_publish_due_content` chaque minute pour publier les contenus arrivés à échéance.

## Procédures principales

- `sp_bootstrap_super_admin` : crée le tout premier compte.
- `sp_invite_user` et `sp_accept_user_invitation` : gèrent l’invitation sécurisée d’un administrateur.
- `sp_deactivate_user` : désactive un compte et révoque ses sessions.
- `sp_publish_sermon` : publie immédiatement ou programme une prédication.
- `sp_schedule_sermon` : programme explicitement une publication future.
- `sp_archive_sermon` : archive une prédication.
- `sp_publish_due_content` : publie les prédications et pages programmées.
- `sp_publish_page` : publie ou programme une page.
- `sp_upsert_site_setting` : modifie un paramètre du site avec contrôle de permission.
- `sp_claim_audio_job` : réserve le prochain audio pour un worker.
- `sp_update_audio_progress` : met à jour sa progression.
- `sp_finish_audio_job` : termine ou échoue proprement un traitement.
- `sp_requeue_audio_job` : relance un traitement échoué.
- `sp_record_sermon_event` : enregistre une écoute, une progression, une fin, un téléchargement ou un partage.
- `sp_mark_contact_message` : gère l’état d’un message.
- `sp_soft_delete_media` : supprime logiquement un média non utilisé.
- `sp_rebuild_sermon_statistics` : recalcule les agrégats à partir des événements bruts.
- `sp_cleanup_expired_security_data` : nettoie les sessions et jetons expirés.

## Vues principales

- `v_public_sermons` et `v_latest_sermons` : catalogue public.
- `v_public_pages`, `v_public_testimonials`, `v_public_site_settings` : contenu public.
- `v_sermon_admin_overview` : gestion complète des prédications.
- `v_dashboard_summary` : indicateurs du tableau de bord.
- `v_sermon_performance_30d` et `v_daily_platform_performance_90d` : statistiques.
- `v_audio_processing_queue` : suivi des traitements.
- `v_media_library` : médiathèque avec état d’utilisation.
- `v_contact_inbox` : boîte de réception.
- `v_content_calendar` : calendrier éditorial.
- `v_user_permissions` : rôles et permissions effectives.

## Règles automatiques importantes

- Les slugs sont normalisés et rendus uniques.
- Les dates `updated_at` sont automatiques.
- Un audio non traité ne peut pas être publié.
- Une couverture doit être une image prête.
- Les compteurs sont mis à jour à chaque événement d’écoute.
- Les auditeurs uniques sont dédupliqués par jour et par empreinte pseudonyme.
- Le dernier super administrateur actif ne peut pas être désactivé ou rétrogradé.
- Un média public ne peut pas être remis en traitement ou supprimé.
- Les actions administratives importantes sont journalisées sans hash de mot de passe ni jeton.

## Conventions d’intégration

- Stocker tous les instants en UTC; PostgreSQL utilise `timestamptz`.
- Afficher les dates dans le fuseau `Africa/Lubumbashi`.
- Générer `visitor_hash` dans l’application avec une empreinte salée; ne jamais y placer directement une adresse IP, un e-mail ou un numéro de téléphone.
- Pour les événements `progress` et `complete`, envoyer dans `seconds_listened` uniquement le temps supplémentaire depuis le dernier événement, pas une durée cumulée.
- Définir `app.current_user_id`, `app.request_id` et `app.ip_address` au début des transactions administratives afin d’enrichir le journal d’audit.
- Générer des URLs temporaires côté serveur à partir de `storage_key`; ne pas enregistrer de liens temporaires dans la base.
- Limiter l’accès direct aux tables et exposer les vues ou procédures appropriées selon le rôle de l’application.

## Tâches planifiées recommandées

- Chaque minute : `CALL papaleki.sp_publish_due_content();`
- Chaque nuit : `CALL papaleki.sp_cleanup_expired_security_data();`
- À la demande après une correction d’événements : `CALL papaleki.sp_rebuild_sermon_statistics();`

## À personnaliser avant les données réelles

- Remplacer les valeurs de démonstration dans `site_settings`.
- Ajouter le pasteur principal dans `preachers` avec `is_primary = true`.
- Choisir le fournisseur de stockage des audios et images.
- Configurer le worker qui normalise, compresse, convertit et génère la forme d’onde des audios.
