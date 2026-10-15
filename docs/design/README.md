# Макет интерфейса MarForms

Утверждённый дизайн: «MarForms — UI mockups» (https://claude.ai/artifact/UwAts2R4kWboVFy5Bxdrpg).
`mockups/` — исходники его артбордов на 2026-10-15. Интерфейс реализуется **точь-в-точь** по ним:
цвета, отступы, радиусы, размеры шрифтов и тексты берутся из `.dc.html`, а не подбираются заново.
Требования к поведению — в [`../spec/business-requirements.md`](../spec/business-requirements.md).

## Как читать артборд

- `mockups/canvas.json` — индекс: страницы канваса, размер и название каждого артборда.
- Каждый `*.dc.html` — разметка с inline-стилями. Данные примера и варианты состояний лежат
  в `renderVals()` внизу файла; переключатели состояний — в `data-props` (`state`, `modal`, `dark`…).
- Короткие файлы (`AccessClosed`, `AdminFormsDelete`, `DarkAdmin`, `R1024*`…) переиспользуют
  основной артборд через `<dc-import name="…" state="…">` — смотрите основной файл с этим состоянием.

## Токены

Палитра задаётся функцией `th(dark)` в каждом артборде:

| Токен | Светлая | Тёмная | Назначение |
|---|---|---|---|
| `--bg` | `#FAFAFB` | `#111115` | фон страницы |
| `--sf` | `#FFFFFF` | `#1A1A20` | поверхность (карточки, панели) |
| `--s2` | `#F4F4F6` | `#22222A` | вторичная поверхность |
| `--tx` | `#1E1E24` | `#ECECEF` | текст |
| `--mu` | `#6B6B76` | `#A3A3AD` | вторичный текст |
| `--bd` | `#E4E4E7` | `#2E2E37` | границы |
| `--pr` | `#3730A3` | `#5B54E0` | основной (индиго) |
| `--prs` / `--prt` | `#EEEEFB` / `#3730A3` | `#25234B` / `#B4B0FF` | индиго: фон / текст бейджа |
| `--amb` / `--amt` | `#FEF3C7` / `#92400E` | `#3B2A0A` / `#FCD34D` | ожидание, предупреждение |
| `--rdb` / `--rdt` | `#FEE2E2` / `#B91C1C` | `#3D1517` / `#FCA5A5` | отказ, запрет, опасность |
| `--gnb` / `--gnt` | `#DCFCE7` / `#166534` | `#0E2F1D` / `#86EFAC` | принято, исправно |
| `--ov` | `rgba(20,20,30,.45)` | `rgba(0,0,0,.62)` | подложка модалок |

Discord `#5865F2` — только кнопка «Войти через Discord». Шрифты: Onest (400/500/600/700),
JetBrains Mono (400/500) для ID, кодов и slug.

## Карта артбордов

| Раздел | Артборды |
|---|---|
| Публичные · mobile 390 | `Main` (лендинг), `FormPublic`, `Login`, `MySubmissions`, `AccessStates`, `SuccessMobile` |
| Публичные · desktop 1440 | `LandingDesktop`, `FormDesktop`, `FormAnon`, `FormSuccess`, `AccessDesktop` (+ `AccessLogin`, `AccessClosed`, `AccessRestricted`), `MySubsDesktop`, `MySubsEmpty` |
| Кабинет сервера | `Servers`, `WsForms`, `WsSubmissions`, `WsAudit`, `WsModerators`, `WsBans`, `WsBilling`, `MobileShell` |
| Конструктор | `Wizard1`–`Wizard4`, `AnonDialog`, `FormEdit`, `Preview` |
| Администрирование | `AdminForms` (+ `Delete`, `Loading`, `Error`), `AdminResponses`, `AdminRespByUser`, `AdminUsers` (+ `Roles`, `Timeout`, `Ban`, `Unban`), `AdminRoles` (+ `Create`, `Delete`), `AdminLogs`, `AdminSystem` (+ `Error`), `AdminSettings` |
| Тёмная тема | `DarkLanding`, `DarkLandingDesktop`, `DarkForm`, `DarkServers`, `DarkModeration`, `DarkAdmin` |
| Адаптив | `R1024Moderation`, `R1024Builder`, `R1024Users`, `R1280Forms` |
| Компоненты | `Components`, `Sidebar`, `Topbar`, `WsHeader`, `WizStepper` |
