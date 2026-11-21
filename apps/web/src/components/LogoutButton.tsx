"use client";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost text-paper-dim"
      onClick={async () => {
        await postJson("/api/auth/logout", {});
        router.push("/");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
