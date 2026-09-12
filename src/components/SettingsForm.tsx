"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, UserRound } from "lucide-react";
import { saveFriendNickname } from "@/app/actions";
import { PushNotificationControl } from "@/components/PushNotificationControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingsFormProps {
  defaultFriendNickname: string;
}

export function SettingsForm({ defaultFriendNickname }: SettingsFormProps) {
  const [friendNickname, setFriendNickname] = useState(defaultFriendNickname);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const saveNickname = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveFriendNickname(friendNickname);
      setStatus(result?.error || "Saved. Future notifications will use this name.");
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Phone notifications</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose whether this phone receives your friend&apos;s task updates.</p>
          </div>
          <PushNotificationControl />
        </div>
        <p className="text-xs leading-5 text-muted-foreground">On iPhone, install the app first: Safari → Share → Add to Home Screen. Then open the installed app and enable alerts.</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
        <div className="mb-4 flex items-start gap-2.5">
          <UserRound className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold">Friend name</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose the name shown for your friend across the app and in notifications.</p>
          </div>
        </div>
        <form onSubmit={saveNickname} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="friend-nickname">Name</Label>
            <Input
              id="friend-nickname"
              value={friendNickname}
              onChange={(event) => setFriendNickname(event.target.value)}
              maxLength={40}
              placeholder="Your friend&apos;s name"
            />
          </div>
          <p className="text-xs text-muted-foreground">For example, setting it to “Tony” gives: “Tony completed ‘Morning exercise’.”</p>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending} className="cursor-pointer gap-1.5">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save name
            </Button>
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
          </div>
        </form>
      </section>
    </div>
  );
}
