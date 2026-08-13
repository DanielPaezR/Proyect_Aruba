import webpush from "web-push";
import { env } from "./env";

webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);

export { webpush };
