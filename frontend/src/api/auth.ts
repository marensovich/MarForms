import { API } from "./client";

export function loginWithDiscord() {
  window.location.href =
    `${API}/oauth2/authorization/discord`;
}