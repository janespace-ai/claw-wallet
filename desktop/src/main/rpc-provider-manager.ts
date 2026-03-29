import { ethers } from 'ethers';
import { NetworkConfigService, RPCProvider } from './network-config-service';

export interface HealthMetrics {
  healthy: boolean;
  latency: number;
  lastCheck: number;
  consecutiveFailures: number;
}

export class RPCProviderManager {
  private networkConfig: NetworkConfigService;
  private healthStatus: Map<string, HealthMetrics> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();

  constructor(networkConfig: NetworkConfigService) {
    this.networkConfig = networkConfig;
  }

  /**
   * Start health check monitoring for all RPC providers
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      console.log('[RPCProviderManager] Health checks already running');
      return;
    }

    const supportedChainIds = this.networkConfig.getSupportedChainIds();
    for (const chainId of supportedChainIds) {
      const rpcs = this.networkConfig.getRPCProviders(chainId);
      for (const rpc of rpcs) {
        this.healthStatus.set(rpc.url, {
          healthy: true,
          latency: 0,
          lastCheck: 0,
          consecutiveFailures: 0
        });
      }
    }

    this.runHealthChecks();

    this.healthCheckInterval = setInterval(() => {
      this.runHealthChecks();
    }, 10000);

    console.log('[RPCProviderManager] Health check monitoring started (10s interval)');
  }

  /**
   * Stop health check monitoring
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[RPCProviderManager] Health check monitoring stopped');
    }
  }

  /**
   * Run health checks on all RPC providers
   */
  private async runHealthChecks(): Promise<void> {
    const allRPCs: { url: string; chainId: number }[] = [];
    
    const supportedChainIds = this.networkConfig.getSupportedChainIds();
    for (const chainId of supportedChainIds) {
      const rpcs = this.networkConfig.getRPCProviders(chainId);
      for (const rpc of rpcs) {
        allRPCs.push({ url: rpc.url, chainId });
      }
    }

    await Promise.all(
      allRPCs.map(({ url, chainId }) => this.checkHealth(url, chainId))
    );
  }

  /**
   * Check health of a single RPC provider
   */
  private async checkHealth(url: string, chainId: number): Promise<void> {
    const start = Date.now();
    
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
      ]);
      
      const latency = Date.now() - start;
      
      this.healthStatus.set(url, {
        healthy: latency < 1000,
        latency,
        lastCheck: Date.now(),
        consecutiveFailures: 0
      });
    } catch (error) {
      const prev = this.healthStatus.get(url);
      const consecutiveFailures = (prev?.consecutiveFailures || 0) + 1;
      
      this.healthStatus.set(url, {
        healthy: false,
        latency: 0,
        lastCheck: Date.now(),
        consecutiveFailures
      });

      if (consecutiveFailures === 3) {
        const network = this.networkConfig.getNetwork(chainId);
        console.warn(`[RPCProviderManager] RPC unhealthy after 3 failures: ${network?.name} - ${url}`);
      }

      if (consecutiveFailures === 3 && this.allProvidersUnhealthy(chainId)) {
        this.notifyAllProvidersFailed(chainId);
      }
    }
  }

  /**
   * Get healthy provider for network (with automatic failover)
   */
  async getProvider(chainId: number): Promise<ethers.JsonRpcProvider> {
    const cacheKey = `provider-${chainId}`;
    
    const rpcs = this.networkConfig.getRPCProviders(chainId);
    
    const healthyRPCs = rpcs
      .filter(rpc => this.isHealthy(rpc.url))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        
        const latencyA = this.healthStatus.get(a.url)?.latency || Infinity;
        const latencyB = this.healthStatus.get(b.url)?.latency || Infinity;
        return latencyA - latencyB;
      });

    if (healthyRPCs.length === 0) {
      const network = this.networkConfig.getNetwork(chainId);
      throw new Error(`All RPC providers for ${network?.name || `chain ${chainId}`} are down`);
    }

    const selectedRPC = healthyRPCs[0];

    const cached = this.providers.get(cacheKey);
    const cachedUrl =
      cached != null
        ? (cached as unknown as { _getConnection: () => { url: string } })._getConnection().url
        : null;
    if (cachedUrl !== selectedRPC.url) {
      const provider = new ethers.JsonRpcProvider(selectedRPC.url);
      this.providers.set(cacheKey, provider);
    }

    return this.providers.get(cacheKey)!;
  }

  /**
   * Check if RPC provider is healthy
   */
  private isHealthy(url: string): boolean {
    const status = this.healthStatus.get(url);
    if (!status) return false;
    
    return status.healthy && status.consecutiveFailures < 3;
  }

  /**
   * Check if all RPC providers for a network are unhealthy
   */
  private allProvidersUnhealthy(chainId: number): boolean {
    const rpcs = this.networkConfig.getRPCProviders(chainId);
    return rpcs.every(rpc => !this.isHealthy(rpc.url));
  }

  /**
   * Notify user that all RPC providers failed
   */
  private notifyAllProvidersFailed(chainId: number): void {
    const network = this.networkConfig.getNetwork(chainId);
    const networkName = network?.name || `Chain ${chainId}`;
    
    console.error(`[RPCProviderManager] ⚠️  All RPC providers for ${networkName} are down`);
    
    if (typeof process !== 'undefined' && process.send) {
      process.send({
        type: 'rpc-providers-failed',
        chainId,
        networkName
      });
    }
  }

  /**
   * Get health status for all RPC providers of a network
   */
  getNetworkHealth(chainId: number): Array<{ url: string; metrics: HealthMetrics }> {
    const rpcs = this.networkConfig.getRPCProviders(chainId);
    return rpcs.map(rpc => ({
      url: rpc.url,
      metrics: this.healthStatus.get(rpc.url) || {
        healthy: false,
        latency: 0,
        lastCheck: 0,
        consecutiveFailures: 0
      }
    }));
  }

  /**
   * Get average latency for an RPC provider
   */
  getAverageLatency(url: string): number {
    const metrics = this.healthStatus.get(url);
    return metrics?.latency || 0;
  }

  /**
   * Manually trigger health check for specific RPC
   */
  async manualHealthCheck(url: string, chainId: number): Promise<HealthMetrics> {
    await this.checkHealth(url, chainId);
    return this.healthStatus.get(url) || {
      healthy: false,
      latency: 0,
      lastCheck: 0,
      consecutiveFailures: 0
    };
  }
}
