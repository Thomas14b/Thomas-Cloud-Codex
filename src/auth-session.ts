import { getUser, handleAuthCallback } from "@netlify/identity";
let initialization: ReturnType<typeof initialize> | undefined;
async function initialize() {
  const callback = await handleAuthCallback();
  return {
    user: callback?.user ?? (await getUser()),
    recovery: callback?.type === "recovery",
    inviteToken: callback?.type === "invite" ? callback.token : undefined,
  };
}
// StrictMode mounts twice; confirmation/recovery tokens must be redeemed only once.
export function initializeAuth() {
  return (initialization ??= initialize());
}
