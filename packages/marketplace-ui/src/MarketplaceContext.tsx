import React, { createContext, useContext } from "react";
import type { MarketplaceClient, MarketplaceEnv, MarketplaceHostAdapter } from "./types";

export type MarketplaceContextValue = {
  client: MarketplaceClient;
  host: MarketplaceHostAdapter;
  env?: MarketplaceEnv;
};

const Ctx = createContext<MarketplaceContextValue | null>(null);

export function MarketplaceProvider(props: {
  client: MarketplaceClient;
  host: MarketplaceHostAdapter;
  env?: MarketplaceEnv;
  children: React.ReactNode;
}) {
  return (
    <Ctx.Provider value={{ client: props.client, host: props.host, env: props.env }}>
      {props.children}
    </Ctx.Provider>
  );
}

export function useMarketplace(): MarketplaceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("MarketplaceProvider is missing");
  return v;
}
