BEGIN;

SET search_path TO papaleki, public;

INSERT INTO roles (code, name, description, is_system)
VALUES
    ('super_admin', 'Super administrateur', 'Accès complet, y compris la sécurité et les utilisateurs.', true),
    ('administrator', 'Administrateur', 'Gestion opérationnelle complète du site.', true),
    ('editor', 'Éditeur', 'Gestion des prédications, médias et contenus.', true),
    ('analyst', 'Analyste', 'Consultation du tableau de bord et des statistiques.', true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system;

INSERT INTO permissions (code, name, description)
VALUES
    ('dashboard.view', 'Voir le tableau de bord', 'Consulter les indicateurs principaux.'),
    ('sermons.view', 'Voir les prédications', 'Consulter les prédications dans l’administration.'),
    ('sermons.create', 'Créer des prédications', 'Créer une nouvelle prédication.'),
    ('sermons.update', 'Modifier les prédications', 'Modifier le contenu et les métadonnées.'),
    ('sermons.publish', 'Publier les prédications', 'Publier ou programmer une prédication.'),
    ('sermons.archive', 'Archiver les prédications', 'Retirer une prédication du catalogue public.'),
    ('sermons.delete', 'Supprimer les prédications', 'Supprimer définitivement une prédication.'),
    ('media.view', 'Voir la médiathèque', 'Consulter les médias disponibles.'),
    ('media.upload', 'Téléverser des médias', 'Ajouter des fichiers audio et des images.'),
    ('media.manage', 'Gérer la médiathèque', 'Traiter, remplacer, relancer ou supprimer des médias.'),
    ('messages.view', 'Voir les messages', 'Consulter les messages de contact.'),
    ('messages.manage', 'Gérer les messages', 'Assigner, répondre, archiver ou classer les messages.'),
    ('pages.view', 'Voir les pages', 'Consulter les pages et témoignages.'),
    ('pages.manage', 'Modifier les pages', 'Créer et modifier les pages et témoignages.'),
    ('pages.publish', 'Publier les pages', 'Publier ou programmer une page.'),
    ('statistics.view', 'Voir les statistiques', 'Consulter les données d’audience.'),
    ('users.view', 'Voir les utilisateurs', 'Consulter les comptes administratifs.'),
    ('users.manage', 'Gérer les utilisateurs', 'Inviter, modifier ou désactiver les administrateurs.'),
    ('settings.view', 'Voir les paramètres', 'Consulter la configuration du site.'),
    ('settings.manage', 'Modifier les paramètres', 'Modifier la configuration générale du site.'),
    ('audit.view', 'Voir le journal d’audit', 'Consulter l’historique des actions administratives.')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('super_admin', 'administrator')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'editor'
  AND p.code IN (
      'dashboard.view',
      'sermons.view', 'sermons.create', 'sermons.update',
      'sermons.publish', 'sermons.archive',
      'media.view', 'media.upload', 'media.manage',
      'messages.view', 'messages.manage',
      'pages.view', 'pages.manage', 'pages.publish',
      'statistics.view', 'settings.view'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'analyst'
  AND p.code IN (
      'dashboard.view', 'sermons.view', 'media.view',
      'statistics.view', 'settings.view'
  )
ON CONFLICT DO NOTHING;

INSERT INTO site_settings (
    setting_key, setting_group, value, description, is_public
)
VALUES
    ('site.name', 'identity', to_jsonb('Pasteur [Nom du pasteur]'::text), 'Nom public du site.', true),
    ('site.tagline', 'identity', to_jsonb('Une parole d’espérance pour fortifier votre foi'::text), 'Message principal du site.', true),
    ('site.language', 'localization', to_jsonb('fr'::text), 'Langue principale.', true),
    ('site.timezone', 'localization', to_jsonb('Africa/Lubumbashi'::text), 'Fuseau horaire des publications et statistiques.', false),
    ('church.name', 'church', to_jsonb('CBCA – [Nom de la paroisse]'::text), 'Nom de l’église locale.', true),
    ('contact.email', 'contact', to_jsonb('contact@exemple.cd'::text), 'Adresse électronique publique.', true),
    ('contact.phone', 'contact', to_jsonb('+243 000 000 000'::text), 'Numéro de téléphone public.', true),
    ('contact.address', 'contact', to_jsonb('[Adresse de l’église]'::text), 'Adresse physique.', true),
    ('contact.worship_schedule', 'contact', '[{"day":"Dimanche","time":"09:00","label":"Culte dominical"}]'::jsonb, 'Horaires des cultes.', true),
    ('social.links', 'social', '{"facebook":null,"youtube":null,"instagram":null,"whatsapp":null}'::jsonb, 'Réseaux sociaux officiels.', true),
    ('features.audio_downloads', 'features', 'true'::jsonb, 'Autorise le téléchargement lorsque la prédication le permet.', true),
    ('analytics.retention_days', 'analytics', '730'::jsonb, 'Durée de conservation conseillée des événements détaillés.', false),
    ('storage.max_audio_megabytes', 'storage', '500'::jsonb, 'Taille maximale d’un audio.', false),
    ('storage.allowed_audio_mime_types', 'storage', '["audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm"]'::jsonb, 'Formats audio autorisés.', false)
ON CONFLICT (setting_key) DO NOTHING;

-- Remplace uniquement les valeurs de démonstration livrées avec le projet.
-- Les valeurs personnalisées depuis l'administration ne sont jamais écrasées.
UPDATE site_settings
SET value = to_jsonb('Pasteur Leki'::text), updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'site.name'
  AND value = to_jsonb('Pasteur [Nom du pasteur]'::text);

UPDATE site_settings
SET value = to_jsonb('Communauté Baptiste au Centre de l’Afrique (CBCA)'::text), updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'church.name'
  AND value = to_jsonb('CBCA – [Nom de la paroisse]'::text);

UPDATE site_settings
SET value = to_jsonb('contact@parole-esperance.cd'::text), updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'contact.email'
  AND value = to_jsonb('contact@exemple.cd'::text);

-- Un prédicateur réel est indispensable : sermons.preacher_id est une clé étrangère.
-- L'ancienne interface utilisait un UUID de démonstration qui provoquait l'erreur SQL.
INSERT INTO preachers (display_name, title, biography, church_name, is_primary, is_active)
SELECT
    'Pasteur Leki',
    'Pasteur de la CBCA',
    'Serviteur de Dieu engagé dans l’annonce de l’Évangile et l’accompagnement pastoral.',
    'Communauté Baptiste au Centre de l’Afrique (CBCA)',
    NOT EXISTS (SELECT 1 FROM preachers WHERE is_primary = true),
    true
WHERE NOT EXISTS (
    SELECT 1 FROM preachers WHERE lower(display_name) = lower('Pasteur Leki')
);

UPDATE preachers
SET is_primary = true, updated_at = CURRENT_TIMESTAMP
WHERE lower(display_name) = lower('Pasteur Leki')
  AND NOT EXISTS (SELECT 1 FROM preachers WHERE is_primary = true);

INSERT INTO sermon_categories (name, slug, description, display_order)
VALUES
    ('Foi', 'foi', 'Enseignements pour grandir dans la foi.', 10),
    ('Prière', 'priere', 'Prédications consacrées à la prière.', 20),
    ('Espérance', 'esperance', 'Messages d’encouragement et d’espérance.', 30),
    ('Vie chrétienne', 'vie-chretienne', 'Applications pratiques de la Parole de Dieu.', 40),
    ('Service', 'service', 'Enseignements sur le service de Dieu et du prochain.', 50)
ON CONFLICT (name) DO NOTHING;

INSERT INTO pages (
    slug, title, navigation_label, content,
    meta_title, meta_description, status,
    display_order, show_in_navigation, published_at
)
VALUES
    (
        'accueil',
        'Accueil',
        'Accueil',
        '{"hero":{"title":"Une parole d’espérance pour fortifier votre foi","subtitle":"Bienvenue sur la plateforme officielle du ministère.","primaryAction":"Écouter les prédications"},"sections":["latest_sermons","about_preview","daily_verse","values","testimonials"]}'::jsonb,
        'Accueil – Ministère pastoral',
        'Découvrez le ministère et écoutez les dernières prédications.',
        'published',
        10,
        true,
        CURRENT_TIMESTAMP
    ),
    (
        'a-propos',
        'À propos',
        'À propos',
        '{"biography":"Biographie du pasteur à compléter.","vision":"Vision du ministère à compléter.","mission":"Mission du ministère à compléter.","values":["Foi","Enseignement","Espérance","Service"]}'::jsonb,
        'À propos du pasteur',
        'Découvrez le parcours, la vision et la mission du pasteur.',
        'published',
        20,
        true,
        CURRENT_TIMESTAMP
    ),
    (
        'contact',
        'Contact',
        'Contact',
        '{"introduction":"Vous pouvez nous écrire à l’aide du formulaire ou utiliser les coordonnées affichées sur cette page."}'::jsonb,
        'Contacter le ministère',
        'Coordonnées, horaires des cultes et formulaire de contact.',
        'published',
        40,
        true,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (slug) DO NOTHING;

-- Enrichit une seule fois l'accueil historique. La clé contentVersion empêche les
-- déploiements suivants d'écraser les modifications faites par l'administrateur.
UPDATE pages
SET content = '{
  "contentVersion":"cbca-2026-01",
  "hero":{
    "eyebrow":"Méditer · Grandir · Servir",
    "title":"Une parole qui éclaire",
    "highlight":"chaque pas.",
    "subtitle":"Retrouvez les prédications du Pasteur Leki et des serviteurs de la CBCA. Des messages bibliques à écouter partout, pour nourrir la foi et accompagner la vie.",
    "primaryAction":"Écouter les prédications",
    "secondaryAction":"Découvrir le ministère",
    "noteTitle":"Nouveau chaque semaine",
    "note":"Retrouvez le message du dimanche dès sa publication.",
    "quote":"La foi grandit lorsque la Parole trouve une place dans notre quotidien."
  },
  "values":{
    "eyebrow":"Notre engagement",
    "title":"La Parole au cœur de la vie",
    "introduction":"Une plateforme simple, pensée pour transmettre l’Évangile et rester proche de la communauté.",
    "items":[
      {"title":"Un enseignement biblique","description":"Des messages enracinés dans les Écritures, accessibles et applicables au quotidien."},
      {"title":"Une présence pastorale","description":"Des paroles de consolation, de discernement et d’encouragement pour chaque saison."},
      {"title":"Une foi partagée","description":"Une ressource ouverte aux familles, aux cellules et à tous ceux qui cherchent Dieu."},
      {"title":"Une écoute sans distraction","description":"Un lecteur sobre et continu, également installable sur téléphone grâce à la PWA."}
    ]
  },
  "latest":{"eyebrow":"À écouter maintenant","title":"Dernières prédications"},
  "scripture":{"quote":"Ainsi la foi vient de ce qu’on entend, et ce qu’on entend vient de la parole de Christ.","reference":"Romains 10:17"},
  "testimonials":{"eyebrow":"La communauté témoigne","title":"Des vies encouragées"},
  "featured":{"eyebrow":"Message à la une","title":"Emportez la Parole avec vous.","description":"Commencez par le message le plus récent, puis poursuivez votre écoute même lorsque vous changez de page."},
  "contact":{"title":"Besoin de prière ou d’un accompagnement ?","subtitle":"Le ministère pastoral reste à votre écoute.","action":"Nous écrire"}
}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'accueil'
  AND NOT (content ? 'contentVersion');

COMMIT;
