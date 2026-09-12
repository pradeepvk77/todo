"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from "@/app/actions";
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
          await subscribeToPushNotifications(toSubscriptionData(existingSubscription));
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
        const result = await subscribeToPushNotifications(toSubscriptionData(nextSubscription));
        if (result?.error) throw new Error(result.error);

        setSubscription(nextSubscription);
        setMessage("Phone notifications are on.");
      } catch (error) {
        console.error("Failed to enable push notifications:", error);
        setMessage("Could not enable notifications. Please try again.");
      }
    });
  };

  const disableNotifications = () => {
    if (!subscription) return;
    startTransition(async () => {
      try {
        await unsubscribeFromPushNotifications(subscription.endpoint);
        await subscription.unsubscribe();
        setSubscription(null);
        setMessage("Phone notifications are off.");
      } catch (error) {
        console.error("Failed to disable push notifications:", error);
        setMessage("Could not turn off notifications. Please try again.");
      }
    });
  };

  if (!supported) return null;

  if (permission === "denied") {
    return (
      <span className="text-xs text-muted-foreground" title="Enable notifications from your browser settings">
        <BellOff className="mr-1 inline size-3.5" /> Notifications blocked
      </span>
    );
  }

  const enabled = Boolean(subscription);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={enabled ? disableNotifications : enableNotifications}
        disabled={isPending}
        className="gap-1.5 text-xs font-medium cursor-pointer"
        title={enabled ? "Turn off phone notifications" : "Enable phone notifications"}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : enabled ? <BellRing className="size-3.5" /> : <Bell className="size-3.5" />}
        <span>{enabled ? "Alerts on" : "Enable alerts"}</span>
      </Button>
      {message && <span className="max-w-48 text-right text-[10px] text-muted-foreground">{message}</span>}
    </div>
  );
}
