# Безопасность · Security

## Как сообщить об уязвимости

Не создавайте публичную задачу. Откройте
[приватный отчёт](https://github.com/marensovich/MarForms/security/advisories/new)
(Security → Report a vulnerability) или напишите владельцу напрямую
([@marensovich](https://github.com/marensovich)). Опишите:

- что уязвимо и где (страница, эндпоинт, файл);
- как воспроизвести;
- чем это грозит: утечка токенов, обход проверки ролей, чужие заявки и т.п.

Мы подтвердим получение и сообщим, когда выйдет исправление.

## Что особенно важно

- токены Discord пользователей и бота, адреса вебхуков;
- обход проверки ролей и доступа к формам;
- доступ к заявкам и файлам чужого сервера;
- SSRF через вебхуки и ссылки в embed.

---

**English.** Please don't open a public issue: use a
[private report](https://github.com/marensovich/MarForms/security/advisories/new) or write to
[@marensovich](https://github.com/marensovich) directly, with what is affected, how to reproduce it
and the impact. We will confirm we got it and tell you when it is fixed.
