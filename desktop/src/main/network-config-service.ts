import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

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
      this.config = defaultConfig;

      if (fs.existsSync(this.userConfigPath)) {
        const userConfig = JSON.parse(fs.readFileSync(this.userConfigPath, 'utf-8')) as Partial<NetworkConfigData>;
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
      this.config.tokens = { ...this.config.tokens, ...userConfig.tokens };
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
   * Save user configuration to disk
   */
  private saveUserConfig(): void {
    if (!this.config) return;

    const userConfig: Partial<NetworkConfigData> = {
      networks: {}
    };

    for (const [chainIdStr, network] of Object.entries(this.config.networks)) {
      const customRPCs = network.rpcs.filter(rpc => rpc.custom);
      if (customRPCs.length > 0) {
        userConfig.networks![chainIdStr] = {
          ...network,
          rpcs: customRPCs
        };
      }
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
