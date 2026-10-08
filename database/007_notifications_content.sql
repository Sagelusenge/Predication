BEGIN;

SET search_path TO papaleki, public;

ALTER TABLE preachers
    ADD COLUMN IF NOT EXISTS public_photo_url text;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint            text NOT NULL UNIQUE,
    p256dh              text NOT NULL,
    auth_secret         text NOT NULL,
    user_id             uuid REFERENCES users(id) ON DELETE SET NULL,
    locale              varchar(20) NOT NULL DEFAULT 'fr',
    timezone            varchar(80) NOT NULL DEFAULT 'Africa/Lubumbashi',
    user_agent          text,
    is_active           boolean NOT NULL DEFAULT true,
    failure_count       integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    last_success_at     timestamptz,
    last_failure_at     timestamptz,
    created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
    ON push_subscriptions (created_at) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS push_notifications (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind                varchar(30) NOT NULL
                            CHECK (kind IN ('daily_verse', 'sermon_published')),
    dedupe_key          varchar(180) NOT NULL UNIQUE,
    sermon_id           uuid REFERENCES sermons(id) ON DELETE SET NULL,
    title               varchar(180) NOT NULL,
    body                text NOT NULL,
    target_url          text NOT NULL,
    payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
    recipient_count     integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
    failure_count       integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    sent_at             timestamptz,
    created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_notifications_sermon
    ON push_notifications (sermon_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_push_subscriptions_touch_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_touch_updated_at
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

INSERT INTO permissions (code, name, description)
VALUES
    ('notifications.view', 'Voir les notifications', 'Consulter l’état des notifications push.'),
    ('notifications.manage', 'Gérer les notifications', 'Configurer et envoyer les notifications push.')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('super_admin', 'administrator')
  AND p.code IN ('notifications.view', 'notifications.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('editor', 'analyst')
  AND p.code = 'notifications.view'
ON CONFLICT DO NOTHING;

INSERT INTO site_settings (setting_key, setting_group, value, description, is_public)
VALUES
    ('notifications.enabled', 'notifications', 'true'::jsonb, 'Active les notifications push.', true),
    ('notifications.daily_hour', 'notifications', '7'::jsonb, 'Heure locale du message biblique quotidien.', true),
    ('notifications.sermon_push_started_at', 'notifications', to_jsonb(CURRENT_TIMESTAMP), 'Date de début des notifications de nouvelles prédications.', false)
ON CONFLICT (setting_key) DO NOTHING;

UPDATE site_settings
SET value = to_jsonb('Pasteur Innocent Kombi Maliro'::text), updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'site.name'
  AND value IN (to_jsonb('Pasteur Leki'::text), to_jsonb('Pasteur [Nom du pasteur]'::text));

UPDATE site_settings
SET value = to_jsonb('ECC/3e CBCA — Prédication et enseignement biblique'::text), updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'church.name'
  AND value IN (
    to_jsonb('Communauté Baptiste au Centre de l’Afrique (CBCA)'::text),
    to_jsonb('CBCA – [Nom de la paroisse]'::text)
  );

UPDATE preachers
SET display_name = 'Pasteur Innocent Kombi Maliro',
    title = 'Pasteur de l’ECC/3e CBCA',
    biography = 'Né le 30 juin 1981 à Kisombiro, en République démocratique du Congo, le Pasteur Innocent Kombi Maliro sert au sein de l’ECC/3e CBCA. Formé notamment à l’ULPGL Butembo de 2007 à 2010 puis en théologie, il exerce des responsabilités pastorales depuis 2014. Il a été ordonné en novembre 2018 à Katwa et affecté au poste de Mweso en 2020. Son ministère est consacré à la prédication, à l’enseignement biblique et à l’accompagnement spirituel.',
    church_name = 'ECC/3e Communauté Baptiste au Centre de l’Afrique (CBCA)',
    public_photo_url = '/pasteur-innocent.jpg',
    is_active = true,
    updated_at = CURRENT_TIMESTAMP
WHERE id = (
    SELECT id FROM preachers
    ORDER BY is_primary DESC, created_at
    LIMIT 1
);

INSERT INTO preachers (display_name, title, biography, church_name, public_photo_url, is_primary, is_active)
SELECT
    'Pasteur Innocent Kombi Maliro',
    'Pasteur de l’ECC/3e CBCA',
    'Né le 30 juin 1981 à Kisombiro, en République démocratique du Congo, le Pasteur Innocent Kombi Maliro sert au sein de l’ECC/3e CBCA. Son ministère est consacré à la prédication, à l’enseignement biblique et à l’accompagnement spirituel.',
    'ECC/3e Communauté Baptiste au Centre de l’Afrique (CBCA)',
    '/pasteur-innocent.jpg',
    true,
    true
WHERE NOT EXISTS (SELECT 1 FROM preachers);

UPDATE pages
SET content = '{
  "contentVersion":"innocent-2026-02",
  "hero":{
    "eyebrow":"",
    "title":"Une parole pour affermir votre foi",
    "highlight":"et éclairer votre marche.",
    "subtitle":"Bienvenue sur la plateforme du Pasteur Innocent Kombi Maliro. Écoutez des prédications et des enseignements bibliques au service de l’Église et de la communauté.",
    "primaryAction":"Écouter les prédications",
    "secondaryAction":"Découvrir le pasteur",
    "noteTitle":"Nouveaux messages",
    "note":"Chaque prédication publiée est disponible ici et peut vous être annoncée par notification.",
    "quote":"Prêcher fidèlement la Parole, accompagner les croyants et servir la mission de l’Église."
  },
  "values":{
    "eyebrow":"Notre engagement",
    "title":"La Bible au cœur de la vie",
    "introduction":"Une plateforme simple pour transmettre l’Évangile, fortifier la foi et rester proche de la communauté.",
    "items":[
      {"title":"Prédication biblique","description":"Des messages enracinés dans les Écritures et accessibles au quotidien."},
      {"title":"Enseignement","description":"Des ressources pour comprendre la Bible et grandir dans la foi."},
      {"title":"Accompagnement spirituel","description":"Une parole de consolation, de discernement et d’encouragement."},
      {"title":"Service de l’Église","description":"Un ministère exercé au sein de l’ECC/3e CBCA et au service de la mission."}
    ]
  },
  "latest":{"eyebrow":"","title":"Dernières prédications"},
  "scripture":{"quote":"Ainsi la foi vient de ce qu’on entend, et ce qu’on entend vient de la parole de Christ.","reference":"Romains 10:17"},
  "testimonials":{"eyebrow":"La communauté témoigne","title":"Des vies encouragées"},
  "featured":{"eyebrow":"Message à la une","title":"Emportez la Parole avec vous.","description":"Écoutez le message le plus récent et poursuivez votre écoute où que vous soyez."},
  "contact":{"title":"Besoin de prière ou d’un accompagnement ?","subtitle":"Nous restons à votre écoute.","action":"Nous écrire"}
}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'accueil'
  AND coalesce(content ->> 'contentVersion', '') IN ('', 'cbca-2026-01');

UPDATE pages
SET content = '{
  "contentVersion":"innocent-2026-02",
  "heroTitle":"Pasteur Innocent Kombi Maliro",
  "heroSubtitle":"Un ministère de prédication, d’enseignement biblique et d’accompagnement spirituel au service de l’ECC/3e CBCA.",
  "biography":"Né le 30 juin 1981 à Kisombiro, en République démocratique du Congo, le Pasteur Innocent Kombi Maliro a étudié à l’ULPGL Butembo de 2007 à 2010 avant de poursuivre sa formation théologique. Il assume des responsabilités pastorales depuis 2014, a été ordonné en novembre 2018 à Katwa et a été affecté au poste de Mweso en 2020.",
  "vision":"Faire connaître la Parole de Dieu avec fidélité, simplicité et espérance afin d’aider chacun à grandir dans la foi.",
  "mission":"Prêcher l’Évangile, enseigner les Écritures et accompagner spirituellement les croyants et les familles.",
  "portrait":"/pasteur-innocent.jpg",
  "familyPhoto":"/pasteur-innocent-famille.jpg",
  "timeline":[
    {"year":"2007–2010","title":"Études à l’ULPGL Butembo"},
    {"year":"Depuis 2014","title":"Responsabilités pastorales"},
    {"year":"Novembre 2018","title":"Ordination pastorale à Katwa"},
    {"year":"Depuis 2020","title":"Service au poste de Mweso"}
  ],
  "values":["Foi","Enseignement biblique","Accompagnement","Service"]
}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'a-propos'
  AND coalesce(content ->> 'contentVersion', '') IN ('', 'cbca-2026-01');

COMMENT ON TABLE push_subscriptions IS 'Abonnements Web Push des navigateurs et PWA.';
COMMENT ON TABLE push_notifications IS 'Historique et déduplication des notifications envoyées.';

COMMIT;
