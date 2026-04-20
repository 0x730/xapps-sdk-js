import { mountHostedStarterLauncher } from "./starter-launcher.js";
import {
  DEFAULT_LOCALE,
  DEFAULT_MODE,
  DEFAULT_SINGLE_XAPP_ID,
  DEFAULT_THEME_KEY,
  HOST_BOOTSTRAP_URL,
  IDENTITY_STORAGE_KEY,
  STARTER_NAME,
} from "./starter-config.js";

mountHostedStarterLauncher({
  starterName: STARTER_NAME,
  hostBootstrapUrl: HOST_BOOTSTRAP_URL,
  identityStorageKey: IDENTITY_STORAGE_KEY,
  defaultLocale: DEFAULT_LOCALE,
  defaultMode: DEFAULT_MODE,
  defaultSingleXappId: DEFAULT_SINGLE_XAPP_ID,
  defaultThemeKey: DEFAULT_THEME_KEY,
  marketplaceHref: "./marketplace.html",
  singleXappHref: "./single-xapp.html",
});
