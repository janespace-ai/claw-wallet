# better-sqlite3 编译错误修复指南

## 问题诊断

错误信息：
```
error: "C++20 or later required."
```

**原因**：`better-sqlite3` v11+ 需要 C++20 支持，但你的 Xcode Command Line Tools 版本过旧。

## 解决方案

### 🔧 方案 1：更新 Xcode Command Line Tools（推荐，一次性解决）

```bash
# 1. 删除旧版本
sudo rm -rf /Library/Developer/CommandLineTools

# 2. 安装最新版本（会弹出安装窗口）
xcode-select --install

# 3. 等待安装完成（约 5-10 分钟）

# 4. 验证安装
clang++ --version
# 应该显示：Apple clang version 14.0 或更高

# 5. 重新安装项目依赖
cd /Users/jane/Documents/work/github/claw-wallet/desktop
rm -rf node_modules package-lock.json
npm install
```

**优点**：彻底解决问题，以后所有需要 C++20 的包都能正常编译

### 🔧 方案 2：使用预编译的 better-sqlite3

如果不想更新 Xcode，可以使用预编译版本：

```bash
cd /Users/jane/Documents/work/github/claw-wallet/desktop

# 先安装其他依赖（跳过 postinstall）
npm install --ignore-scripts

# 手动安装预编译的 better-sqlite3
npm install better-sqlite3 --build-from-source=false

# 如果还是失败，尝试指定旧版本（支持 C++17）
npm install better-sqlite3@9.6.0
```

### 🔧 方案 3：临时跳过编译（仅用于测试）

```bash
cd /Users/jane/Documents/work/github/claw-wallet/desktop

# 安装时跳过 postinstall
npm install --ignore-scripts

# 注意：这样 better-sqlite3 可能无法正常工作
# 只适合测试其他功能
```

## 推荐步骤（最简单）

```bash
# 在 Mac 上执行以下命令：

# 1. 更新 Command Line Tools
xcode-select --install

# 2. 等待安装完成后，拉取最新代码
cd /Users/jane/Documents/work/github/claw-wallet/desktop
git pull

# 3. 清理并重新安装
rm -rf node_modules package-lock.json
npm install

# 4. 构建项目
npm run build

# 5. 运行
npm run dev
```

## 验证修复

编译成功的标志：
```bash
npm install
# 应该看到：
✔ Building module: better-sqlite3, Completed: 1
```

## 常见问题

### Q: xcode-select --install 提示 "已安装"
```bash
# 强制重新安装
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

### Q: 安装后还是报错
```bash
# 清理所有缓存
rm -rf node_modules package-lock.json ~/.npm ~/.electron-gyp
npm cache clean --force
npm install
```

### Q: 我不想更新 Xcode
使用方案 2，降级到 better-sqlite3@9.6.0（支持 C++17）

## 技术说明

- **better-sqlite3 v11+**: 需要 C++20
- **Xcode Command Line Tools 14+**: 支持 C++20
- **macOS 13+ (Ventura)**: 推荐使用最新版本

## 需要帮助？

如果以上方案都不行，请提供以下信息：

```bash
# 1. macOS 版本
sw_vers

# 2. Xcode 版本
xcode-select --version
clang++ --version

# 3. 完整错误日志
npm install 2>&1 | tee npm-error.log
```
