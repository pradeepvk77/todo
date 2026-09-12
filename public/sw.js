self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Lets Do It", {
      body: data.body || "You have a new task update.",
      icon: "/image.png",
      badge: "/image.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existingWindow = windows.find((client) => client.url === targetUrl);
      if (existingWindow) return existingWindow.focus();
      return clients.openWindow(targetUrl);
    })
  );
});
