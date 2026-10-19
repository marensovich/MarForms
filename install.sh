#!/usr/bin/env bash
# MarForms installer: asks for what only you know (the Discord application,
# the bot token, the first administrator), generates the rest, writes .env and
# starts MarForms with Postgres in Docker.
#
#   ./install.sh                 # from a checkout of the repository: builds the image here
#   ./install.sh --image         # uses the published image ghcr.io/marensovich/marforms
#
# Any answer can be given in advance through the environment, e.g.
#   MARFORMS_URL=https://forms.example.com DISCORD_CLIENT_ID=… ./install.sh
# Re-running keeps an existing .env (its keys encrypt stored data) and only starts MarForms.

set -euo pipefail
# A secret's prompt turns echo off; Ctrl-C there must not leave the terminal blind.
trap 'stty echo 2>/dev/null || true' EXIT

IMAGE="ghcr.io/marensovich/marforms"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/.env"

bold=$'\e[1m'; dim=$'\e[2m'; red=$'\e[31m'; green=$'\e[32m'; yellow=$'\e[33m'; reset=$'\e[0m'
[ -t 1 ] || { bold=; dim=; red=; green=; yellow=; reset=; }

say()  { printf '%s\n' "$*"; }
step() { printf '\n%s==> %s%s\n' "$bold" "$*" "$reset"; }
ok()   { printf '%s✓%s %s\n' "$green" "$reset" "$*"; }
warn() { printf '%s!%s %s\n' "$yellow" "$reset" "$*"; }
die()  { printf '%s✗ %s%s\n' "$red" "$*" "$reset" >&2; exit 1; }

# ask VAR "Question" [default] [secret] [validator]
ask() {
    local var=$1 question=$2 default=${3:-} secret=${4:-} check=${5:-} value
    if [ -n "${!var:-}" ]; then
        value=${!var}
        if [ -n "$check" ] && ! "$check" "$value"; then die "$var: недопустимое значение"; fi
        printf -v "$var" '%s' "$value"
        return
    fi
    while true; do
        if [ -n "$default" ]; then printf '%s %s[%s]%s: ' "$question" "$dim" "$default" "$reset"
        else printf '%s: ' "$question"; fi
        if [ "$secret" = secret ]; then IFS= read -rs value; printf '\n'; else IFS= read -r value; fi
        value=${value:-$default}
        if [ -z "$value" ]; then warn "Нужно ответить."; continue; fi
        if [ -n "$check" ] && ! "$check" "$value"; then continue; fi
        printf -v "$var" '%s' "$value"
        return
    done
}

is_url() {
    [[ $1 =~ ^https?://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] && return 0
    warn "Адрес вида https://forms.example.com или http://203.0.113.5:8090, без / в конце."; return 1
}
is_port() {
    [[ $1 =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ] && return 0
    warn "Порт — число от 1 до 65535."; return 1
}
is_snowflake() {
    [[ $1 =~ ^[0-9]{17,20}$ ]] && return 0
    warn "Discord ID — 17–20 цифр. Discord → Настройки → Расширенные → Режим разработчика, затем ПКМ по себе → «Копировать ID»."; return 1
}
is_snowflakes() {
    local id
    for id in ${1//,/ }; do is_snowflake "$id" || return 1; done
}
is_secret() {
    [[ ${#1} -ge 20 && $1 != *" "* ]] && return 0
    warn "Похоже на неполное значение: скопируйте его целиком."; return 1
}

random() { # random BYTES → base64 without newlines
    if command -v openssl >/dev/null 2>&1; then openssl rand -base64 "$1" | tr -d '\n'
    else head -c "$1" /dev/urandom | base64 | tr -d '\n'; fi
}

# ── 1. What is needed ────────────────────────────────────────────────────────
step "Проверяю Docker"
command -v docker >/dev/null 2>&1 || die "Docker не найден. Установите: https://docs.docker.com/engine/install/"
docker info >/dev/null 2>&1 || die "Docker не запущен или нет прав (добавьте пользователя в группу docker или запустите через sudo)."
docker compose version >/dev/null 2>&1 || die "Нужен Docker Compose v2 (команда «docker compose»)."
ok "$(docker --version)"

MODE=build
[ "${1:-}" = "--image" ] && MODE=image
if [ "$MODE" = build ] && [ ! -f "$DIR/Dockerfile" ]; then
    MODE=image
    warn "Исходников рядом нет — будет использован готовый образ $IMAGE."
fi

COMPOSE_FILE="$DIR/docker-compose.prod.yml"
if [ "$MODE" = image ] && [ ! -f "$COMPOSE_FILE" ]; then
    COMPOSE_FILE="$DIR/docker-compose.yml"
    cat > "$COMPOSE_FILE" <<'YAML'
# Written by install.sh: MarForms (site + API) and Postgres.
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: ${DB_NAME:-marforms}
      POSTGRES_USER: ${DB_USERNAME:-marforms}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?set DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      retries: 5
    restart: unless-stopped

  marforms:
    image: ghcr.io/marensovich/marforms:${MARFORMS_VERSION:-latest}
    env_file: .env
    environment:
      DB_URL: jdbc:postgresql://postgres:5432/${DB_NAME:-marforms}
      HOST_APP_PORT: "8090"
    ports:
      - "${HTTP_PORT:-8090}:8090"
    volumes:
      - uploads:/data/uploads
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
  uploads:
YAML
    ok "Записан $COMPOSE_FILE"
fi
compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# ── 2. Answers ───────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    step "Найден $ENV_FILE"
    say "Оставляю его как есть: ключи в нём шифруют сохранённые данные, новые сделали бы их нечитаемыми."
    say "Чтобы поменять ответ, отредактируйте файл и запустите установщик снова."
    # shellcheck disable=SC1090
    set -a; . "$ENV_FILE"; set +a
    MARFORMS_URL=${FRONTEND_URL:-http://localhost:${HTTP_PORT:-8090}}
else
    step "Сайт"
    ask HTTP_PORT "Порт на этом сервере" "8090" "" is_port
    ask MARFORMS_URL "Публичный адрес MarForms (с https, если стоит TLS-прокси)" "http://localhost:$HTTP_PORT" "" is_url

    step "Приложение Discord"
    say "Откройте https://discord.com/developers/applications → ваше приложение (или New Application)."
    say "В OAuth2 → Redirects добавьте оба адреса:"
    say "  ${bold}$MARFORMS_URL/login/oauth2/code/discord${reset}"
    say "  ${bold}$MARFORMS_URL/api/v1/guilds/connect/callback${reset}"
    ask DISCORD_CLIENT_ID "Client ID (OAuth2 → Client ID)" "" "" is_snowflake
    ask DISCORD_CLIENT_SECRET "Client Secret (OAuth2 → Reset Secret)" "" secret is_secret
    say "Bot → Reset Token. Привилегированные Intents боту не нужны."
    ask DISCORD_BOT_TOKEN "Токен бота" "" secret is_secret

    # MARFORMS_SKIP_DISCORD_CHECK=1 skips the online check (no internet on the server yet).
    if [ "${MARFORMS_SKIP_DISCORD_CHECK:-}" != 1 ] && command -v curl >/dev/null 2>&1; then
        bot=$(curl -fsS -m 10 -H "Authorization: Bot $DISCORD_BOT_TOKEN" https://discord.com/api/v10/users/@me 2>/dev/null || true)
        if [[ $bot == *'"id"'* ]]; then
            bot_id=$(sed -n 's/.*"id": *"\([0-9]*\)".*/\1/p' <<<"$bot")
            bot_name=$(sed -n 's/.*"username": *"\([^"]*\)".*/\1/p' <<<"$bot")
            ok "Бот: ${bot_name:-?}"
            [ -n "$bot_id" ] && [ "$bot_id" != "$DISCORD_CLIENT_ID" ] &&
                warn "ID бота ($bot_id) не совпадает с Client ID: токен от другого приложения?"
        else
            die "Discord не принял токен бота. Проверьте, что скопирован актуальный токен."
        fi
    fi

    step "Главный администратор"
    say "Его Discord ID получит все права платформы при первом входе."
    ask ADMIN_DISCORD_IDS "Discord ID (несколько — через запятую)" "" "" is_snowflakes

    step "Генерирую пароль базы данных и ключи"
    umask 077
    cat > "$ENV_FILE" <<ENV
# MarForms — written by install.sh on $(date -u +%Y-%m-%dT%H:%MZ). Keep it secret, back it up:
# TOKEN_ENCRYPTION_KEY and JWT_SECRET can't be recovered, and without the first one
# stored Discord tokens and webhook addresses become unreadable.

HTTP_PORT=$HTTP_PORT
FRONTEND_URL=$MARFORMS_URL

DB_NAME=marforms
DB_USERNAME=marforms
DB_PASSWORD=$(random 24 | tr -dc 'A-Za-z0-9')

JWT_SECRET=$(random 48)
TOKEN_ENCRYPTION_KEY=$(random 32)

DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=$DISCORD_CLIENT_SECRET
DISCORD_REDIRECT_URI=$MARFORMS_URL/login/oauth2/code/discord
DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN
DISCORD_BOT_INSTALL_REDIRECT_URI=$MARFORMS_URL/api/v1/guilds/connect/callback

ADMIN_DISCORD_IDS=$ADMIN_DISCORD_IDS
ENV
    chmod 600 "$ENV_FILE"
    ok "Записан $ENV_FILE (доступен только вам)"
fi

# ── 3. Start ─────────────────────────────────────────────────────────────────
if [ "$MODE" = build ]; then
    step "Собираю образ (первый раз — несколько минут)"
    GIT_COMMIT=$(git -C "$DIR" rev-parse --short HEAD 2>/dev/null || true) compose build
else
    step "Скачиваю образ $IMAGE"
    compose pull || die "Не удалось скачать образ. Для приватного репозитория: docker login ghcr.io -u <GitHub-логин> (токен с правом read:packages)."
fi

step "Запускаю"
compose up -d

container=$(compose ps -q marforms)
[ -n "$container" ] || { compose logs --tail 40 || true; die "Контейнер MarForms не создан."; }
state=unknown
printf 'Жду, пока MarForms поднимется'
for _ in $(seq 1 60); do
    state=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo unknown)
    [ "$state" = healthy ] && break
    [ "$state" = exited ] && break
    printf '.'; sleep 5
done
printf '\n'

if [ "$state" != healthy ]; then
    warn "MarForms не ответил за 5 минут (состояние: $state). Последние строки журнала:"
    compose logs --tail 40 marforms || true
    die "Исправьте причину и запустите ./install.sh снова."
fi

step "Готово"
ok "MarForms работает: $MARFORMS_URL"
say ""
say "Дальше:"
say "  1. Откройте $MARFORMS_URL и войдите через Discord под главным администратором."
say "  2. «Мои серверы» → «Добавить бота на сервер»."
case $MARFORMS_URL in
    http://localhost*|http://127.*) ;;
    http://*) warn "Адрес без https: Discord и браузеры работают, но сессии лучше защищать TLS-прокси (Caddy, nginx, Traefik) перед портом ${HTTP_PORT:-8090}." ;;
esac
say ""
say "${dim}Журнал:      docker compose -f $(basename "$COMPOSE_FILE") logs -f marforms${reset}"
say "${dim}Обновление:  ./install.sh  (или docker compose -f $(basename "$COMPOSE_FILE") pull && … up -d)${reset}"
say "${dim}Резервная копия: .env и тома postgres_data, uploads${reset}"
