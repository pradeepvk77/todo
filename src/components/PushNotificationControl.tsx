"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, BellRing, Loader2, RotateCcw } from "lucide-react";
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  clearUserPushSubscriptions,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

function toSubscriptionData(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Browser returned an incomplete push subscription.");
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export function PushNotificationControl() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

    void Promise.resolve().then(() => {
      setSupported(true);
      setPermission(Notification.permission);
    });
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (existingSubscription) => {
        setSubscription(existingSubscription);
        if (existingSubscription) {
          try {
            await subscribeToPushNotifications(toSubscriptionData(existingSubscription));
          } catch {
            // silent retry
          }
        }
      })
      .catch(() => setMessage("Push notifications could not be set up in this browser."));
  }, []);

  const enableNotifications = () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setMessage("Push notifications are not configured yet.");
      return;
    }

    startTransition(async () => {
      try {
        const nextPermission = await Notification.requestPermission();
        setPermission(nextPermission);
        if (nextPermission !== "granted") {
          setMessage("Allow notifications in your browser settings to receive task updates.");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const nextSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const subData = toSubscriptionData(nextSubscription);
        const result = await subscribeToPushNotifications(subData);
        if (result?.error) {
          setMessage(result.error);
          return;
        }

        setSubscription(nextSubscription);
        setMessage("Phone notifications are on.");
      } catch (error: any) {
        console.error("Failed to enable push notifications:", error);
        setMessage(error.message || "Could not enable notifications. Click reset below.");
      }
    });
  };

  const disableNotifications = () => {
    startTransition(async () => {
      try {
        if (subscription) {
          await unsubscribeFromPushNotifications(subscription.endpoint);
          await subscription.unsubscribe();
        } else {
          await clearUserPushSubscriptions();
        }
        setSubscription(null);
        setMessage("Phone notifications cleared.");
      } catch (error) {
        console.error("Failed to disable push notifications:", error);
        await clearUserPushSubscriptions();
        setSubscription(null);
        setMessage("Notifications reset.");
      }
    });
  };

  const handleResetPushDb = () => {
    startTransition(async () => {
      try {
        await clearUserPushSubscriptions();
        if (subscription) {
          await subscription.unsubscribe().catch(() => {});
        }
        setSubscription(null);
        setMessage("Notification subscriptions reset on DB.");
      } catch (err: any) {
        setMessage(err.message || "Failed to reset.");
      }
    });
  };

  if (!supported) return null;

  if (permission === "denied") {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground" title="Enable notifications from your browser settings">
          <BellOff className="mr-1 inline size-3.5" /> Notifications blocked
        </span>
        <button
          type="button"
          onClick={handleResetPushDb}
          className="text-[10px] text-rose-500 hover:underline cursor-pointer flex items-center gap-1"
        >
          <RotateCcw className="size-3" /> Clear DB alerts
        </button>
      </div>
    );
  }

  const enabled = Boolean(subscription);
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant={enabled ? "default" : "outline"}
          size="sm"
          onClick={enabled ? disableNotifications : enableNotifications}
          disabled={isPending}
          className={`gap-1.5 text-xs font-bold cursor-pointer ${
            enabled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
          }`}
          title={enabled ? "Turn off phone notifications" : "Enable phone notifications"}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : enabled ? (
            <BellRing className="size-3.5 text-white" />
          ) : (
            <Bell className="size-3.5" />
          )}
          <span>{enabled ? "Alerts on" : "Enable alerts"}</span>
        </Button>

        {/* PROMINENT RESET / CLEAR PUSH DB BUTTON */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetPushDb}
          disabled={isPending}
          className="text-xs text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer gap-1 px-2.5 font-semibold"
          title="Clear push notification string on DB to re-add cleanly"
        >
          <RotateCcw className="size-3.5" />
          <span>Clear DB alerts</span>
        </Button>
      </div>

      {message && <span className="max-w-60 text-right text-[11px] font-medium text-muted-foreground">{message}</span>}
    </div>
  );
}
