"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson, ApiError } from "@/lib/client";

export function FriendsPanel({ links }: { me: string; links: { other: string; incoming: boolean; status: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (username: string, action: "invite" | "accept" | "remove") => {
    try {
      await postJson("/api/friends", { username, action });
      setMsg(action === "invite" ? `Invite sent to @${username}.` : null);
      setName("");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Failed");
    }
  };
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-extrabold">Friends</h2>
      <form method="post" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name) void act(name.toLowerCase(), "invite"); }}>
        <input className="input" placeholder="username" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
        <button className="btn">Invite</button>
      </form>
      {msg && <p className="text-xs text-fg-dim">{msg}</p>}
      <ul className="divide-y divide-line text-sm">
        {links.map((l) => (
          <li key={l.other + l.incoming} className="flex items-center justify-between py-2">
            <span>@{l.other} <span className="text-xs text-fg-faint">{l.status === "accepted" ? "friend" : l.incoming ? "invited you" : "invite pending"}</span></span>
            <span className="flex gap-2">
              {l.status === "pending" && l.incoming && <button className="btn py-1" onClick={() => act(l.other, "accept")}>Accept</button>}
              <button className="btn btn-ghost py-1 text-fg-faint" onClick={() => act(l.other, "remove")}>Remove</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
