"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE_NAME, SESSION_TOKEN } from "@/lib/session";

export async function unlock(password: string): Promise<{ ok: boolean }> {
  if (!verifyPassword(password)) {
    return { ok: false };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, SESSION_TOKEN, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Deliberately no maxAge/expires: a true session cookie, so quitting and relaunching the
    // Electron app (a fresh session) re-locks it. It only stays unlocked while the app runs.
  });

  redirect("/");
}

export async function lockApp() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/unlock");
}
