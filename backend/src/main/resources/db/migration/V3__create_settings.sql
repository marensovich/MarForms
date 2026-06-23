CREATE TABLE settings
(
    key   VARCHAR(255) NOT NULL,
    value TEXT,
    CONSTRAINT pk_settings PRIMARY KEY (key)
);

INSERT INTO settings (key, value)
VALUES ('ban.message', 'You are banned. Please contact the administrator.'),
       ('ban.admin.contact', 'Administrator'),
       ('system.name', 'MarForms'),
       ('system.contact', '')
ON CONFLICT (key) DO NOTHING;