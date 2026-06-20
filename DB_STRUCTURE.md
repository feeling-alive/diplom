# Структура базы данных PostgreSQL (FinTrack)

## **users**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK, `default uuid4` |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE, INDEX |
| `username` | `VARCHAR(64)` | NOT NULL, UNIQUE, INDEX |
| `password_hash` | `VARCHAR(255)` | NULLABLE |
| `google_id` | `VARCHAR(255)` | NULLABLE, UNIQUE |
| `role` | `ENUM('user','admin')` | NOT NULL, DEFAULT 'user' |
| `avatar_url` | `VARCHAR(512)` | NULLABLE |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT true |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()` |

**Relations:** → subscription (1:1), dashboard_config (1:1), chat_sessions (1:N), comments (1:N), favorites (1:N), notifications (1:N)

---

## **subscriptions**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK, `default uuid4` |
| `user_id` | `UUID` | NOT NULL, UNIQUE, FK → `users.id` ON DELETE CASCADE |
| `plan` | `ENUM('free','premium')` | NOT NULL, DEFAULT 'free' |
| `expires_at` | `TIMESTAMPTZ` | NULLABLE |
| `ai_requests_used` | `INTEGER` | NOT NULL, DEFAULT 0 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()` |

**UC:** `user_id` (1:1 с User)

---

## **dashboard_configs**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK, `default uuid4` |
| `user_id` | `UUID` | NOT NULL, UNIQUE, FK → `users.id` ON DELETE CASCADE |
| `layout` | `JSONB` | NULLABLE |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()`, ON UPDATE now() |

**UC:** `user_id` (1:1 с User)

---

## **chat_sessions**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK, `default uuid4` |
| `user_id` | `UUID` | NOT NULL, INDEX, FK → `users.id` ON DELETE CASCADE |
| `symbol` | `VARCHAR(32)` | NULLABLE |
| `messages` | `JSONB` | NULLABLE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()` |

---

## **comments**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK, `default uuid4` |
| `user_id` | `UUID` | NOT NULL, INDEX, FK → `users.id` ON DELETE CASCADE |
| `article_url` | `VARCHAR(2048)` | NOT NULL, INDEX |
| `text` | `VARCHAR(1000)` | NOT NULL |
| `likes` | `INTEGER` | NOT NULL, DEFAULT 0 |
| `parent_id` | `UUID` | NULLABLE, INDEX, FK → `comments.id` ON DELETE SET NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()` |

---

## **favorites**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK, `default uuid4` |
| `user_id` | `UUID` | NOT NULL, INDEX, FK → `users.id` ON DELETE CASCADE |
| `symbol` | `VARCHAR(32)` | NOT NULL |
| `added_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()` |

**UC:** `(user_id, symbol)` — `uq_favorite_user_symbol`

---

## **news_articles**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK, `default uuid4` |
| `title` | `VARCHAR(1024)` | NOT NULL |
| `title_ru` | `VARCHAR(1024)` | NULLABLE |
| `description` | `VARCHAR(4096)` | NULLABLE |
| `description_ru` | `VARCHAR(4096)` | NULLABLE |
| `content` | `VARCHAR(8192)` | NULLABLE |
| `content_ru` | `VARCHAR(8192)` | NULLABLE |
| `url` | `VARCHAR(2048)` | NOT NULL, UNIQUE |
| `url_to_image` | `VARCHAR(2048)` | NULLABLE |
| `source_name` | `VARCHAR(256)` | NOT NULL |
| `published_at` | `TIMESTAMPTZ` | NOT NULL, INDEX |
| `category` | `VARCHAR(32)` | NOT NULL, DEFAULT 'general', INDEX |
| `symbols` | `JSONB` | NULLABLE |
| `keywords` | `JSONB` | NULLABLE |
| `market_impact` | `VARCHAR(16)` | NULLABLE |
| `language` | `VARCHAR(8)` | NOT NULL, DEFAULT 'en' |
| `ai_processed` | `BOOLEAN` | NOT NULL, DEFAULT false |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()` |

**Relations:** → news_reactions (1:N), news_favorites (1:N)

---

## **news_reactions**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK, `default uuid4` |
| `user_id` | `UUID` | NOT NULL, INDEX, FK → `users.id` ON DELETE CASCADE |
| `article_id` | `UUID` | NOT NULL, INDEX, FK → `news_articles.id` ON DELETE CASCADE |
| `reaction_type` | `VARCHAR(16)` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()` |

**UC:** `(user_id, article_id)` — `uq_news_reaction`

---

## **news_favorites**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK, `default uuid4` |
| `user_id` | `UUID` | NOT NULL, INDEX, FK → `users.id` ON DELETE CASCADE |
| `article_id` | `UUID` | NOT NULL, INDEX, FK → `news_articles.id` ON DELETE CASCADE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()` |

**UC:** `(user_id, article_id)` — `uq_news_favorite`

---

## **notifications**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | NOT NULL, INDEX, FK → `users.id` ON DELETE CASCADE |
| `sender_id` | `UUID` | NULLABLE, FK → `users.id` ON DELETE SET NULL |
| `type` | `VARCHAR(32)` | NOT NULL |
| `message` | `VARCHAR(512)` | NOT NULL |
| `link` | `VARCHAR(2048)` | NOT NULL |
| `is_read` | `BOOLEAN` | NOT NULL, DEFAULT false, INDEX |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()` |

---

## **api_keys**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK |
| `service` | `VARCHAR(64)` | NOT NULL, UNIQUE, INDEX |
| `encrypted_value` | `TEXT` | NOT NULL |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()`, ON UPDATE now() |

---

## **admin_logs**
| Поле | Тип | Ограничения |
|------|-----|-------------|
| `id` | `UUID` | PK |
| `admin_id` | `UUID` | NULLABLE, INDEX, FK → `users.id` ON DELETE SET NULL |
| `admin_username` | `VARCHAR(64)` | NOT NULL |
| `action` | `VARCHAR(128)` | NOT NULL |
| `target_type` | `VARCHAR(64)` | NOT NULL |
| `target_id` | `VARCHAR(255)` | NOT NULL |
| `details` | `TEXT` | NULLABLE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `DEFAULT now()`, INDEX |

---

## Сводка

| Таблица | PK | FK | UC | Индексов |
|---------|----|----|----|----------|
| users | `id` | — | email, username, google_id | 2 |
| subscriptions | `id` | 1 → users | user_id | — |
| dashboard_configs | `id` | 1 → users | user_id | — |
| chat_sessions | `id` | 1 → users | — | 1 |
| comments | `id` | 2 (users, self) | — | 3 |
| favorites | `id` | 1 → users | (user_id, symbol) | 1 |
| news_articles | `id` | — | url | 2 |
| news_reactions | `id` | 2 (users, articles) | (user_id, article_id) | 2 |
| news_favorites | `id` | 2 (users, articles) | (user_id, article_id) | 2 |
| notifications | `id` | 2 → users | — | 2 |
| api_keys | `id` | — | service | 1 |
| admin_logs | `id` | 1 → users | — | 2 |
