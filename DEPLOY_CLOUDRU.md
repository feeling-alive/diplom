# Деплой FinTrack на cloud.ru (Ubuntu + Docker, доступ по IP)

Итог: сайт будет доступен по `http://<IP-сервера>/`. Вход по email/паролю работает,
Google-вход и HTTPS — только после привязки домена (см. конец файла).

Дальше `<IP>` — публичный IP вашего сервера cloud.ru.

---

## 0. Открыть порты в cloud.ru
В панели cloud.ru у сервера (Security Group / firewall) разрешить входящие:
- **TCP 22** (SSH) — обычно уже открыт;
- **TCP 80** (сайт).
Порты 8000/5432/6379 наружу НЕ открывать — они только внутри Docker-сети.

Минимум по ресурсам: **2 ГБ RAM** (лучше 4 ГБ) — бэкенд тянет PyTorch и ML-модель.

## 1. Подключиться и проверить Docker
```bash
ssh user@<IP>
docker --version && docker compose version
```

## 2. Получить код на сервер
```bash
git clone <URL-вашего-репозитория> fintrack
cd fintrack/dashboard-app          # тут лежит docker-compose.prod.yml
```
(или залить папку через scp, если репозиторий приватный)

## 3. Сгенерировать секреты
```bash
# SECRET_KEY (JWT)
openssl rand -hex 32
# ENCRYPTION_KEY (Fernet, для шифрования API-ключей в БД) — нужен ровно такой формат:
docker run --rm python:3.11-slim sh -c "pip -q install cryptography && python -c 'from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())'"
```
Скопируйте оба значения — пригодятся в .env.

## 4. Заполнить backend/.env
```bash
cp backend/.env.example backend/.env
nano backend/.env
```
Заполнить как минимум:
```dotenv
SECRET_KEY=<из шага 3>
ENCRYPTION_KEY=<из шага 3>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# URL-ы — ваш IP (без https, без слэша в конце)
BACKEND_URL=http://<IP>
FRONTEND_URL=http://<IP>
CORS_ORIGINS=http://<IP>

# API-ключи (как локально)
FINNHUB_API_KEY=...
NEWS_API_KEY=...
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
POLZA_API_KEY=...
POLZA_BASE_URL=https://api.polza.ai/api/v1
POLZA_MODEL=openai/gpt-4o-mini
ETHERSCAN_API_KEY=          # опц.

# Пароль БД (можно задать свой; должен совпасть с POSTGRES_PASSWORD ниже)
# DATABASE_URL/REDIS_URL НЕ трогаем — их задаёт docker-compose.prod.yml

# Google OAuth на голом IP не работает — оставить пустыми:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# SMTP — опц. (без него код сброса пароля пишется в лог):
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```
Проверьте, что во `frontend/.env` стоит `VITE_MOCK_MODE=false` (чтобы фронт ходил на реальный бэкенд).

(опц.) Сменить пароль БД: создайте файл `.env` рядом с compose со строкой
`POSTGRES_PASSWORD=ваш_пароль` — compose подставит его и в БД, и в DATABASE_URL.

## 5. Собрать и поднять стек
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # все сервисы healthy/running
```

## 6. Применить миграции и создать админа (один раз)
Сначала миграции (чистая схема через alembic), потом сидим админа:
```bash
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.prod.yml run --rm backend python scripts/seed_admin.py
```
> Если миграции ругнутся «relation already exists» (т.к. backend на старте сам создаёт
> таблицы) — выполните вместо upgrade: `... alembic stamp head`.

## 7. Проверить
- Браузер: `http://<IP>/` — открывается сайт.
- `http://<IP>/health` — отвечает 200 (через фронт-nginx проксируется на бэкенд).
- Зарегистрироваться по email, зайти, проверить дашборд, рынок, новости, ИИ-чат.

## Обновление после изменений в коде
```bash
cd fintrack/dashboard-app
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head   # если были миграции
```

## Полезное
```bash
docker compose -f docker-compose.prod.yml logs -f backend     # логи бэкенда
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml down                # остановить (данные в volume сохраняются)
```

---

## Когда появится домен (рекомендуется потом)
1. Направить A-запись домена на `<IP>`.
2. Поставить reverse-proxy с авто-HTTPS — проще всего Caddy:
   добавить сервис `caddy` перед `frontend`, Caddyfile:
   `ваш_домен { reverse_proxy frontend:3000 }` — сертификат Let's Encrypt поднимется сам.
3. В `backend/.env` поменять BACKEND_URL/FRONTEND_URL/CORS_ORIGINS на `https://ваш_домен`.
4. Включить secure-cookie (в коде cookie стоит `secure=False` для HTTP — для HTTPS поставить True).
5. В Google Cloud Console добавить redirect URI `https://ваш_домен/auth/google/callback`
   и заполнить GOOGLE_CLIENT_ID/SECRET — тогда заработает и вход через Google.
