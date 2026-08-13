import type { NavigationGuard } from "vue-router";

import { useAuthStore, useLobbyStore } from "@/stores";

export const authGuard: NavigationGuard = async (_to, _from) => {
  const auth = useAuthStore();

  if (auth.user) {
    return;
  } else {
    return "/";
  }
};

export const lobbyGuard: NavigationGuard = async (_to, _from) => {
  const auth = useAuthStore();
  const lobby = useLobbyStore();
  if (lobby.status === "playing") return false;
  if (auth.profile?.username && !window.location.href.includes("tankSignIntype=upgrade")) {
    return;
  } else {
    return "/";
  }
};

export const gameGuard: NavigationGuard = async (to, _from) => {
  const auth = useAuthStore();
  const lobby = useLobbyStore();

  if (auth.profile?.username && (lobby.status === "playing" || to.hash === "#ai")) {
    return;
  } else {
    return auth.profile?.username ? "/lobby" : "/";
  }
};

export const noAuthGuard = async () => {
  const auth = useAuthStore();
  return (
    !auth.user || !auth.profile?.username || window.location.href.includes("tankSignIntype=upgrade")
  );
};
