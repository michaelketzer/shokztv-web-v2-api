import dotenv from "dotenv";

process.env.NODE_ENV = process.env.NODE_ENV || "development";
dotenv.config();

const envFound = dotenv.config();
if (!envFound) {
  console.info("No .env file specified, falling back to defaults");
}

export default {
  discordWebhook: process.env.DISCORD_WEBHOOK || "",
  env: process.env.NODE_ENV || "production",
  port: process.env.PORT || 80,
  secret: process.env.secret || "someawesomesecret",
  jwt_secret: process.env.JWT_SECRET || "anotherawesomesecret",
  vodFetcherApiKey: process.env.VOD_FETCHER_API_KEY || "",
  mysql: {
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "app",
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || "",
    clientSecret: process.env.TWITCH_CLIENT_SECRET || "",
    callbackURL: process.env.TWITCH_CALLBACK_URL || "",
  },
  staticDeployHooks: {
    triggerDeploy: process.env.TRIGGER_DEPLOY || false,
    triggerHookUrl: process.env.TRIGGER_HOOK_URL || "",
  },
};
