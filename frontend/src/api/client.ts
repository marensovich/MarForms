export const API = "http://localhost:8090";

export async function getMe(token: string) {
  const res = await fetch(`${API}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Unauthorized");
  }

  return res.json();
}