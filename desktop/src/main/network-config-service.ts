import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ethers } from 'ethers';

export interface RPCProvider {
  url: string;
  priority: number;
  custom: boolean;
}

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  nativeCurrency: NativeCurrency;
  rpcs: RPCProvider[];
  explorers: string[];
  icon: string;
}

export interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  contracts: Record<string, string>;
}

export interface NetworkConfigData {
  networks: Record<string, NetworkConfig>;
  tokens: Record<string, TokenConfig>;
}

export class NetworkConfigService {
  private config: NetworkConfigData | null = null;
  /** Bundled `network-config.json` token entries (for restoring defaults when removing user overrides). */
  private bundledTokenDefaults: Record<string, TokenConfig> = {};
  /** User-added or user-overridden token contracts persisted in `network-config-user.json`. */
  private userTokenOverlay: Record<string, TokenConfig> = {};
  private configPath: string;
  private userConfigPath: string;

  constructor() {
    const isDev = !app.isPackaged;
    this.configPath = isDev
      ? path.join(__dirname, '../../network-config.json')
      : path.join(process.resourcesPath, 'network-config.json');
    
    this.userConfigPath = path.join(app.getPath('userData'), 'network-config-user.json');
  }

  /**
   * Load network configuration from disk
   */
  load(): void {
    try {
      const defaultConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) as NetworkConfigData;
      this.bundledTokenDefaults = structuredClone(defaultConfig.tokens);
      this.config = defaultConfig;
      this.userTokenOverlay = {};

      if (fs.existsSync(this.userConfigPath)) {
        const userConfig = JSON.parse(fs.readFileSync(this.userConfigPath, 'utf-8')) as Partial<NetworkConfigData>;
        if (userConfig.tokens && typeof userConfig.tokens === 'object') {
          this.userTokenOverlay = structuredClone(userConfig.tokens) as Record<string, TokenConfig>;
        }
        this.mergeUserConfig(userConfig);
      }

      console.log(`[NetworkConfigService] Loaded ${Object.keys(this.config.networks).length} networks`);
    } catch (error) {
      console.error('[NetworkConfigService] Failed to load config:', error);
      throw new Error('Failed to load network configuration');
    }
  }

  /**
   * Merge user-provided custom configuration
   */
  private mergeUserConfig(userConfig: Partial<NetworkConfigData>): void {
    if (!this.config) return;

    if (userConfig.networks) {
      for (const [chainIdStr, networkOverride] of Object.entries(userConfig.networks)) {
        const existingNetwork = this.config.networks[chainIdStr];
        if (existingNetwork && networkOverride.rpcs) {
          existingNetwork.rpcs = [...networkOverride.rpcs, ...existingNetwork.rpcs];
        } else if (networkOverride) {
          this.config.networks[chainIdStr] = networkOverride;
        }
      }
    }

    if (userConfig.tokens) {
      for (const [sym, userTok] of Object.entries(userConfig.tokens)) {
        if (!userTok || typeof userTok !== 'object') continue;
        const key = sym.toUpperCase();
        const u = userTok as TokenConfig;
        const existing = this.config.tokens[key];
        const merged: TokenConfig = existing
          ? {
              name: u.name ?? existing.name,
              symbol: (u.symbol ?? existing.symbol).toUpperCase(),
              decimals: u.decimals ?? existing.decimals,
              contracts: { ...existing.contracts, ...(u.contracts || {}) },
            }
          : {
              name: u.name ?? key,
              symbol: (u.symbol ?? key).toUpperCase(),
              decimals: u.decimals ?? 18,
              contracts: { ...(u.contracts || {}) },
            };
        this.config.tokens[key] = merged;
      }
    }
  }

  /**
   * Get configuration for specific network by chainId
   */
  getNetwork(chainId: number): NetworkConfig | null {
    if (!this.config) {
      throw new Error('NetworkConfigService not initialized. Call load() first.');
    }
    return this.config.networks[chainId.toString()] || null;
  }

  /**
   * Get all supported networks
   */
  getAllNetworks(): NetworkConfig[] {
    if (!this.config) {
      throw new Error('NetworkConfigService not initialized. Call load() first.');
    }
    return Object.values(this.config.networks);
  }

  /**
   * Get RPC providers for specific network
   */
  getRPCProviders(chainId: number): RPCProvider[] {
    const network = this.getNetwork(chainId);
    if (!network) {
      throw new Error(`Network with chainId ${chainId} not found`);
    }
    return [...network.rpcs].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add custom RPC provider for network
   */
  addCustomRPC(chainId: number, rpcUrl: string): void {
    const network = this.getNetwork(chainId);
    if (!network) {
      throw new Error(`Network with chainId ${chainId} not found`);
    }

    const customRPC: RPCProvider = {
      url: rpcUrl,
      priority: 1,
      custom: true
    };

    network.rpcs.forEach(rpc => {
      if (!rpc.custom) {
        rpc.priority += 1;
      }
    });

    network.rpcs.unshift(customRPC);

    this.saveUserConfig();
  }

  /**
   * Remove custom RPC provider
   */
  removeCustomRPC(chainId: number, rpcUrl: string): void {
    const network = this.getNetwork(chainId);
    if (!network) {
      throw new Error(`Network with chainId ${chainId} not found`);
    }

    const index = network.rpcs.findIndex(rpc => rpc.url === rpcUrl && rpc.custom);
    if (index !== -1) {
      network.rpcs.splice(index, 1);
      this.saveUserConfig();
    }
  }

  /**
   * Get token configuration by symbol
   */
  getToken(symbol: string): TokenConfig | null {
    if (!this.config) {
      throw new Error('NetworkConfigService not initialized. Call load() first.');
    }
    return this.config.tokens[symbol] || null;
  }

  /**
   * Get all supported tokens
   */
  getAllTokens(): TokenConfig[] {
    if (!this.config) {
      throw new Error('NetworkConfigService not initialized. Call load() first.');
    }
    return Object.values(this.config.tokens);
  }

  /**
   * Get token contract address for specific network
   */
  getTokenContract(symbol: string, chainId: number): string | null {
    const token = this.getToken(symbol);
    if (!token) return null;
    return token.contracts[chainId.toString()] || null;
  }

  /**
   * Get block explorer URL for network
   */
  getExplorerUrl(chainId: number): string | null {
    const network = this.getNetwork(chainId);
    if (!network || network.explorers.length === 0) return null;
    return network.explorers[0];
  }

  /**
   * Add or update a user-defined ERC-20 on a supported chain (persisted to user config).
   */
  addCustomToken(input: {
    chainId: number;
    contractAddress: string;
    symbol: string;
    name?: string;
    decimals?: number;
  }): TokenConfig {
    if (!this.config) {
      throw new Error('NetworkConfigService not initialized. Call load() first.');
    }
    if (!this.getNetwork(input.chainId)) {
      throw new Error(`Unsupported chain ${input.chainId}`);
    }
    let address: string;
    try {
      address = ethers.getAddress(input.contractAddress.trim());
    } catch {
      throw new Error('Invalid contract address');
    }
    const rawSymbol = input.symbol.trim();
    if (!/^[A-Za-z0-9]{1,32}$/.test(rawSymbol)) {
      throw new Error('Invalid token symbol');
    }
    const key = rawSymbol.toUpperCase();
    const chainStr = String(input.chainId);
    const prevOverlay = this.userTokenOverlay[key];
    const decimals = input.decimals ?? prevOverlay?.decimals ?? 18;
    const name = (input.name?.trim() || prevOverlay?.name || key).trim();

    const nextOverlay: TokenConfig = {
      name,
      symbol: key,
      decimals,
      contracts: {
        ...(prevOverlay?.contracts || {}),
        [chainStr]: address,
      },
    };
    this.userTokenOverlay[key] = nextOverlay;
    this.applyUserTokenEntry(key, nextOverlay);
    this.saveUserConfig();
    console.log(`[NetworkConfigService] Custom token ${key} on chain ${input.chainId}: ${address}`);
    return this.config.tokens[key];
  }

  /**
   * Remove a user-added contract for a symbol on a chain. Built-in addresses from the bundle are restored when applicable.
   */
  removeCustomToken(symbol: string, chainId: number): void {
    if (!this.config) {
      throw new Error('NetworkConfigService not initialized. Call load() first.');
    }
    const key = symbol.trim().toUpperCase();
    const chainStr = String(chainId);
    const overlay = this.userTokenOverlay[key];
    if (!overlay?.contracts[chainStr]) {
      throw new Error('No user-added token contract on this chain');
    }

    const nextContracts = { ...overlay.contracts };
    delete nextContracts[chainStr];
    if (Object.keys(nextContracts).length === 0) {
      delete this.userTokenOverlay[key];
    } else {
      this.userTokenOverlay[key] = { ...overlay, contracts: nextContracts };
    }

    const live = this.config.tokens[key];
    if (live?.contracts[chainStr]) {
      delete live.contracts[chainStr];
      const def = this.bundledTokenDefaults[key]?.contracts[chainStr];
      if (def) {
        live.contracts[chainStr] = def;
      }
      if (Object.keys(live.contracts).length === 0 && !this.bundledTokenDefaults[key]) {
        delete this.config.tokens[key];
      }
    }

    this.saveUserConfig();
    console.log(`[NetworkConfigService] Removed custom token ${key} on chain ${chainId}`);
  }

  /**
   * Tokens the user added or extended (subset persisted in user config).
   */
  listCustomTokens(): TokenConfig[] {
    return Object.values(this.userTokenOverlay);
  }

  private applyUserTokenEntry(key: string, userTok: TokenConfig): void {
    if (!this.config) return;
    const existing = this.config.tokens[key];
    const merged: TokenConfig = existing
      ? {
          name: userTok.name ?? existing.name,
          symbol: key,
          decimals: userTok.decimals ?? existing.decimals,
          contracts: { ...existing.contracts, ...userTok.contracts },
        }
      : {
          name: userTok.name,
          symbol: key,
          decimals: userTok.decimals,
          contracts: { ...userTok.contracts },
        };
    this.config.tokens[key] = merged;
  }

  /**
   * Save user configuration to disk
   */
  private saveUserConfig(): void {
    if (!this.config) return;

    const userConfig: Partial<NetworkConfigData> = {};
    const networks: Record<string, NetworkConfig> = {};

    for (const [chainIdStr, network] of Object.entries(this.config.networks)) {
      const customRPCs = network.rpcs.filter(rpc => rpc.custom);
      if (customRPCs.length > 0) {
        networks[chainIdStr] = {
          ...network,
          rpcs: customRPCs
        };
      }
    }
    if (Object.keys(networks).length > 0) {
      userConfig.networks = networks;
    }

    if (Object.keys(this.userTokenOverlay).length > 0) {
      userConfig.tokens = structuredClone(this.userTokenOverlay);
    }

    const hasNetworks = userConfig.networks && Object.keys(userConfig.networks).length > 0;
    const hasTokens = userConfig.tokens && Object.keys(userConfig.tokens).length > 0;
    if (!hasNetworks && !hasTokens) {
      if (fs.existsSync(this.userConfigPath)) {
        fs.unlinkSync(this.userConfigPath);
      }
      console.log('[NetworkConfigService] User config cleared');
      return;
    }

    fs.writeFileSync(this.userConfigPath, JSON.stringify(userConfig, null, 2));
    console.log('[NetworkConfigService] User config saved');
  }

  /**
   * Check if network is supported
   */
  isNetworkSupported(chainId: number): boolean {
    return this.getNetwork(chainId) !== null;
  }

  /**
   * Get supported chain IDs
   */
  getSupportedChainIds(): number[] {
    if (!this.config) {
      throw new Error('NetworkConfigService not initialized. Call load() first.');
    }
    return Object.keys(this.config.networks).map(Number);
  }
}
