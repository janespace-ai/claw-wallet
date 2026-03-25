/**
 * 直接使用 Claw Wallet SDK (不需要 MCP Server)
 * 
 * 使用方法:
 * 1. npm install claw-wallet
 * 2. import { ClawWallet } from 'claw-wallet'
 * 3. 直接调用 tools
 */

import { ClawWallet } from '../dist/index.js';

async function main() {
  console.log('🔐 Claw Wallet SDK 直接使用示例\n');

  // 1. 初始化钱包 SDK
  const wallet = new ClawWallet({
    relayUrl: process.env.RELAY_URL || 'http://localhost:8080',
    dataDir: process.env.DATA_DIR || '~/.claw-wallet',
    defaultChain: 'base',
  });

  await wallet.initialize();
  console.log('✅ SDK 初始化完成\n');

  // 2. 获取所有可用的工具
  const tools = wallet.getTools();
  console.log(`📦 可用工具数量: ${tools.length}`);
  console.log('工具列表:', tools.map(t => t.name).join(', '));
  console.log('');

  // 3. 示例: 检查是否已配对
  const addressTool = tools.find(t => t.name === 'wallet_address');
  if (addressTool) {
    console.log('🔍 检查配对状态...');
    const result = await addressTool.execute({});
    console.log('结果:', result);
    console.log('');
  }

  // 4. 示例: 配对 (如果未配对)
  if ((result as any).error?.includes('No wallet paired')) {
    console.log('⚠️  未配对,需要先配对');
    console.log('使用方法:');
    console.log('  1. 在 Desktop Wallet 中生成配对码');
    console.log('  2. 调用 wallet_pair 工具:');
    console.log('');
    console.log('     const pairTool = tools.find(t => t.name === "wallet_pair");');
    console.log('     await pairTool.execute({ shortCode: "YOUR_CODE" });');
    console.log('');
  }

  // 5. 示例: 查询余额 (如果已配对)
  const balanceTool = tools.find(t => t.name === 'wallet_balance');
  if (balanceTool && !(result as any).error) {
    console.log('💰 查询 ETH 余额...');
    const balance = await balanceTool.execute({ 
      token: 'ETH',
      chain: 'base' 
    });
    console.log('余额:', balance);
    console.log('');
  }

  // 6. 示例: 查看安全策略
  const policyTool = tools.find(t => t.name === 'wallet_policy_get');
  if (policyTool && !(result as any).error) {
    console.log('🔒 查看安全策略...');
    const policy = await policyTool.execute({});
    console.log('策略:', policy);
    console.log('');
  }

  // 7. 清理
  await wallet.shutdown();
  console.log('👋 完成');
}

// 运行示例
main().catch(console.error);
