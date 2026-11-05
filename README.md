# dsh-client-ui-session-panels

DSH（DeepSeek Harness）右侧栏的「右侧面板卡片插件」。一个标签页里放四张卡：**上下文**（窗口占用、四段构成条、缓存命中率与 token 明细）、**轮次统计**、**正在调用**（技能与 MCP 调用在途）、**MCP 服务器**（连接状态 + 重连开关）。

它是 `dsh-client-ui-session-cards`（会话卡片）的姊妹插件：卡片聚焦聚合读数，本插件聚焦**面板式布局与缓存分析**，二者可共存，注册的标签页类型不同（`session-panels` vs `session-cards`）。

代码从 openchamber 的 ContextPanel / ContextSidebarTab / WorkStatusPanel 重写而来，但**不含任何 openchamber 源码依赖**：数据全部来自 DSH 原生面（projection、会话事件流、同源宿主路由），openchamber 专有概念（zones、PR/Tracker 视图、Workflows、Guests、Git、逐消息估算）被有意砍掉。

## 它装了什么

| 半边 | 入口 | 作用 |
| --- | --- | --- |
| Host | `lib/index.js` | 注册 `GET /session-panels/mcp`（各 MCP 服务器的连接状态与工具数）与 `POST /session-panels/mcp/reconnect?id=`（重连） |
| Client | `lib/client.js` | 在 `sidebar.right.pane.tab` 注册 `session-panels` 标签页，标题「右侧面板卡片插件」 |
| 组合包补丁 | `cordis.patch.yml` | 往 profile 插入一行：`ui-session-panels` |

卡片的顺序与显隐存浏览器 `localStorage`（`dsh.sessionPanels.layout.v1`）。每张卡带**标题栏**（图标 + 标题 + 摘要 + 折叠箭头），**直接拖标题栏就能调顺序**——按下并移动超过 6px 进入拖拽，卡片本体虚化留守、一份 ghost 副本实时跟随鼠标，目标卡上下半区分别显示"插入到上方/下方"指示线，松手落位；轻点仍是折叠（折叠键修复：按下瞬间不再抢占指针捕获，箭头点击直达）。右上「管理卡片」进入整理模式：拖拽排序、开关显隐（两套排序写入同一份布局）。

## 数据从哪来

- **上下文 / 轮次**：宿主 projection（`contextPressure`、`tokenUsage`、`sessionStats`、`contextBreakdown`）。缓存命中率 = 缓存读取 ÷（未缓存输入 + 缓存读取 + 缓存写入），公式沿自 openchamber 的 `computeCacheHitRate`。
- **正在调用**：会话事件流（`remote.session.follow`）——技能经 `/name` 或 `skill` 工具进入、轮次边界清除；MCP 调用由 `tool/call` / `tool/result` 括起，按调用生命周期显示。
- **MCP 服务器**：本插件宿主半边的同源路由，重连开关是插件里唯一改宿主状态的控件（只重启条目，不改任何配置文件）。

## 环境要求

- DSH Desktop **≥ 0.2.1-rc.3**（`package.json` 的 `dsh.engines.dsh`）。
- 构建用 Node 18 以上。

## 先构建

```bash
npm install     # 首次
npm run build   # 生成 lib/client.js、lib/index.js
npm run unit    # 15 组纯函数断言
npm run drag    # 9 组 jsdom 交互断言（捕获时机/ghost 跟手/插入侧向/点击守卫/阈值/卸载清理/会话切换）
npm run smoke   # 13 组渲染断言（不需要启动应用）
npm run typecheck
```

`lib/` 是产物，不构建就没有可加载的入口。

## 安装（只支持 GitHub）

插件以 GitHub 仓库 + tag 的形式分发：构建产物 `lib/` 已入库，安装端不需要构建；git 依赖由 lockfile 钉死到具体 commit，应用启动时的依赖对账直接命中 pnpm store，**不会每次启动重解包**。

### 1. 装进 profile

```bash
node scripts/switch-to-git.mjs            # 默认 ~/.dsh/profiles/desktop，可 --profile 指定
```

或用应用内：侧栏**插件** → **添加插件** → 填
`https://github.com/alonewolfsy-web/dsh-client-ui-session-panels#v0.2.1`。

脚本做四件事：`git ls-remote` 确认 tag 存在（不存在绝不碰 profile）→ `pnpm add github:alonewolfsy-web/dsh-client-ui-session-panels#v0.2.1` → 校验「清单 / 落盘副本 / 版本号」三层一致 → 删掉遗留的 `vendor` tgz。

### 2. 升级

改 `package.json` 的 `version` → `npm run build` → 提交 → `git tag vX.Y.Z` → `git push origin main --tags` → 再跑一次 `switch:git`。

### 3. 发布产物（可选）

`npm pack` 的 tgz 可附到 GitHub Release，便于离线转发；安装仍以 tag 为准。

## 开发迭代（不是安装方式）

`pnpm run deploy` 把当前构建直推进 profile 里已安装的插件副本，免发布、免 pnpm 往返：

```powershell
pnpm run deploy          # = node scripts/build.mjs && node scripts/deploy.mjs
node scripts/deploy.mjs --profile <profile目录>
```

两条铁律（脚本已内置）：

1. **先 unlink 再拷贝，绝不原地覆写**——profile 里的文件是 pnpm store 的硬链接（nlink=2），原地写内容会顺着链接污染 store 的内容寻址块；先删后拷只断开这一条链接，store 安然无恙。
2. **部署后校验标记**——`client.js` 必须含 `window.__ModuleLoader__` 与 `osp-ghost`，`index.js` 必须含 `/session-panels/mcp`，版本号必须与源一致；任一不符即报错退出。

注意：git 模式下，应用启动对账会从 store 还原 **tag 对应的已发布版本**，直更只用于临时验证，重启即失效。要长期生效必须打新 tag 并切换。若 profile 仍停留在旧的 `file:` 依赖，`deploy` 会同步刷新 vendor tarball 以免被启动对账回滚（过渡行为，切到 git 后自动跳过）。

## 安装后验证

- 右侧栏出现「右侧面板卡片插件」标签页（来自向导胶囊或面板的添加控件）。
- 拖任一卡的标题栏可实时调序；轻点标题栏折叠/展开。
- 右上「管理卡片」可进入整理模式（拖拽 + 显隐开关）。
- MCP 卡有数据（若 profile 配了 MCP 服务器）。

## 卸载

侧栏**插件** → 找到 `ui-session-panels` → 停用/移除。`cordis.patch.yml` 插入的行随移除消失，不残留。

## 与会话卡片插件的关系

| | session-cards（会话卡片） | 本插件（右侧面板卡片插件） |
| --- | --- | --- |
| 标签页类型 | `session-cards` | `session-panels` |
| 定位 | 聚合读数卡 | 面板式分区 + 缓存分析 |
| MCP 路由 | `/session-cards/mcp` | `/session-panels/mcp` |

两者同装互不冲突；只想要一套的话选其一即可。

## 砍掉什么（openchamber 有、这里没有）

zones 工作区与拖拽、PR/Tracker 视图、Workflows、Guests、Git/源代码管理、原始消息预览与逐消息 token 估算（DSH 未暴露已验证的消息文本通道，面板改渲染宿主 projection 给出的窗口构成——那是实测值，不是估算值）。
