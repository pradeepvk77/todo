"use server";

import { createSession, deleteSession } from "@/lib/session";
import { redirect } from "next/navigation";

export interface AuthFormState {
  error?: string;
}

export async function loginAction(
  prevState: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const accessKey = formData.get("accessKey")?.toString().trim();

  if (!accessKey) {
    return { error: "Please enter your personal access string." };
  }

  const user1Key = process.env.USER_1_ACCESS_KEY;
  const user2Key = process.env.USER_2_ACCESS_KEY;

  let identifiedUser: "user1" | "user2" | null = null;

  if (user1Key && accessKey === user1Key) {
    identifiedUser = "user1";
  } else if (user2Key && accessKey === user2Key) {
    identifiedUser = "user2";
  }

  if (!identifiedUser) {
    return {
      error: "Access denied. The access string you entered is invalid.",
    };
  }

  await createSession(identifiedUser);
  redirect("/");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
