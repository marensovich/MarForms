import { useEffect, useState } from "react";
import { getMe } from "../api/client";
import {useNavigate} from "react-router-dom";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("jwt");

    if (!token) return;
    getMe(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("jwt");
        navigate("/login", { replace: true });
      });
  }, []);

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 text-white p-10">
      <div className="max-w-xl mx-auto bg-gray-900 p-6 rounded-2xl">
        <h1 className="text-2xl font-bold mb-4">
          Dashboard
        </h1>

        <div className="space-y-2">
          <p>Username: {user.username}</p>
          <p>Discord ID: {user.discordId}</p>
        </div>
      </div>
    </div>
  );
}