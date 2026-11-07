# Plan: oc-ref 三面板 → 独立 DSH 插件 `dsh-client-ui-session-panels`

## 目标（一句话）
把 ContextPanel / ContextSidebarTab / WorkStatusPanel 的可移植内核重写为独立 DSH 插件
`dsh-client-ui-session-panels`（工程目录 `/i/tmp/dsh-oc-panels`），**全程零 oc-ref 引用**，
数据全部走 DSH 原生（projection / session 事件流 / host 路由），产出可安装 tgz。

## 已验证的依据（全部读码实证，非猜测）
- DSH 客户端契约：`apply(ctx)` + `inject=['slots','locale','remote','remote.session','sidebarRightTabs']`、
  `ctx.sidebarRightTabs.register`、`ctx.slots.inject('sidebar.right.pane.tab')`、`ctx.locale.bind/register`、
  `ctx.effect(fn,label)`（session-cards src/client/index.tsx 实证）。
- projection 键与形状（session-cards panel.tsx:543-546 + smoke fixtures 实证）：
  `contextPressure{pressureTokens,projectedTokens,contextWindow}`、
  `tokenUsage{uncachedInputTokens,outputTokens,cacheReadTokens,cacheWriteTokens}`、
  `sessionStats`、`contextBreakdown{systemTokens,toolsTokens,messageTokens}`。
- 事件流：`remote.session.follow({address:{kind:'session',sessionId}},signal)` → AsyncIterable，
  frame 形如 `{type:'turn/start'|'turn/end'|'user/message'|'tool/call', data}`（session-cards fold 函数实证）。
- 宿主路由：`apply(ctx)` → `ctx.inject(['webServer'], scope=>scope.effect(()=>scope.webServer.register({kind:'exact',path,handler}),label))`；
  MCP 条目经 `ctx.loader.entries()` 过滤 `options.name==='@deepseek-ai/dsh-mcp-client'`，
  重连 = `fiber.dispose()` → 清 `options.disabled` → `entry.init()`（host/index.js 全文实证）。
- 构建：esbuild bundle→CJS→包进 `window.__ModuleLoader__.load({id,factory(require){...}})`，
  external: react、react/jsx-runtime、react-dom、react-dom/client、@deepseek-ai/*（build.mjs 实证）。
- 持久化：localStorage（session-cards layout.ts 实证）。

## oc-ref 依赖处置表（3 面板共 69 条 @/ 导入）
| 类别 | 处置 | DSH 映射 |
| --- | --- | --- |
| stores/useUIStore·useGitStore·useConfigStore·favicon·guests | **砍** | DSH 无此工作台概念 |
| sync/sync-context·session-ui-store·global-session-status | **映射** | useProjection + remote.session.follow |
| lib/opencode/model（Message/Part）·toolContentShells·tokenUtils | **映射** | projection 数值 + tokenUsage 缓存命中率公式移植 |
| lib/workspace/zones·zoneDrag·zoneHosts·closeTabTarget | **砍** | DSH 无 zones |
| source-control·trackers·PullRequestView·TrackerItemView | **砍** | DSH 无此域 |
| WorkflowsPanel·SessionActivityIndicator·GuestRailIcon | **砍** | DSH 无此域 |
| components/ui/*（tooltip/button/context-menu/sortable-tabs 等） | **映射** | 本地 primitives（session-cards 同款裁剪） |
| lib/i18n·money·timeFormat·clipboard·utils(cn) | **映射** | ctx.locale + 本地 format/clipboard 兜底 |
| layoutAnimation·chunkLoadRecovery·shortcuts·usePageColors | **砍** | DSH 插件不需要（首个版本不做动画路径） |
| WorkStatus sections/dialog/presence 结构 | **映射** | 折叠 section 列表 + 技能/MCP 折叠器 |

## 新插件面（与 session-cards 的关系：姊妹插件，可共存）
- 一个右侧栏 tab（KIND `session-panels`），4 张卡：`context`（压力读数+四段条 system/tools/messages/free+缓存命中率+token 明细）、
  `turns`（sessionStats）、`skills`（事件流折叠）、`mcp`（host 路由 + 重连开关）。
- 卡片顺序/显隐存 localStorage `dsh.sessionPanels.layout.v1`。
- Host 半边：`GET /session-panels/mcp`、`POST /session-panels/mcp/reconnect?id=`（与 session-cards 路径不同，互不冲突）。
- **砍掉且不做**：原始消息预览/逐消息桶（DSH 无已验证的消息文本通道，desktop-runtime.json 与 session-cards 均无）；
  zones/PR/Tracker/Workflows/Guests/Git/source-control；动画路径。

## 步骤（每步一验）
1. **脚手架**：package.json（name/dsh.client/exports/files/peer+devDeps）、cordis.patch.yml、tsconfig.json；`npm install`。
   验收：`node -e "JSON.parse(fs…)"` 三个 JSON/YAML 文件可解析 + `npm ls esbuild react` 退出 0。
2. **宿主半边** `src/host/index.js`（移植改名，路由 /session-panels/*）。
   验收：`node --check` 通过 + `node --input-type=module -e "import('…').then(m=>console.log(m.name, m.inject))"` 打印
   `ui-session-panels [ 'loader', 'tools' ]`。
3. **构建脚本 + 纯逻辑**：scripts/build.mjs（新 id）；src/client/{format,layout,folds}.ts
   （fmt*、localStorage 布局、foldActiveSkills/foldActiveMcp 移植、缓存命中率、四段条段计算——先读 oc-ref tokenUtils 的
   computeCacheHitRate 实公式再移植）；scripts/unit.mjs 纯函数断言。
   验收：`npm run build` 产出 lib/client.js 且含 `dsh-client-ui-session-panels`；`node scripts/unit.mjs` 全绿。
4. **UI 层**：locales.ts（zh/en 全键）、icons.tsx、primitives.tsx、styles.ts（ensureStyles 模式）。
   验收：`npm run build` 仍通过。
5. **主体**：panel.tsx（4 卡 + useProjection/follow/MCP fetch 轮询）+ index.tsx（apply 注册，NS/KIND/ID 新命名）。
   验收：build 通过 + lib/client.js 含 `id: "dsh-client-ui-session-panels"` 与 `sidebar.right.pane.tab`。
6. **smoke**：recording ctx + fixtures（projections/frames/fetch）→ renderToStaticMarkup，断言 ≥25 条
   （读数、四段条、缓存命中率、技能折叠、MCP 行与重连、空态、布局持久化、zh/en 键全覆盖）。
   验收：`npm run smoke` 退出 0。
7. **typecheck**：`npx tsc --noEmit`（需装 typescript+@types/react）。
   验收：退出 0（失败两次则记录为已知限制，不强修）。
8. **打包**：`npm pack` → 产物核对 + SHA256SUMS + README（安装三步、数据来源、与 session-cards 关系、砍单说明）。
   验收：`tar -tzf` 列出 package/lib/{client,index}.js、package.json、README.md、cordis.patch.yml；sha256 文件生成。
9. **独立性终验**：全工程 grep `oc-ref|packages/ui|@/lib|@/stores|@/sync|@/components|opencode` 0 命中；
   输出依赖处置清单汇总（69 条 → 映射 X / 砍 Y）。
   验收：grep 退出码 1（无命中）。

## 状态（2026-11-05，逐步更新）
- ✅ 步骤 1：脚手架 + `npm install`（esbuild 0.25.12 / react 18.3.1 / ts 5.9.3），JSON 校验通过。
- ✅ 步骤 2：宿主半边 `node --check` 通过；`import` 实测导出 `name=ui-session-panels inject=[loader,tools]`。
- ✅ 步骤 3：`scripts/unit.mjs` **15 组断言全绿**（格式化/缓存命中率移植公式/四段条/技能与 MCP 折叠器/host fetcher/布局）。
  - 过程坑：① unit.mjs 漏解构 `reconnectMcpServer`；② Node 22 有全局 fetch，需临时摘掉才能测 `unavailable` 分支；
    ③ `moveCard` 是"插到目标位之前"语义（session-cards 原版），测试期望曾写反。均为测试侧问题，逻辑代码未改。
  - build 首跑顺延至步骤 4（入口文件就位后）。
- ✅ 步骤 4：UI 四件套（icons/styles/primitives/locales，`osp-` 前缀）esbuild transform 全净。
- ✅ 步骤 5：panel.tsx + index.tsx；`npm run build` 通过，lib/client.js 49KB，
  含 `id: "dsh-client-ui-session-panels"` 与 `sidebar.right.pane.tab`。
  - 过程坑：`<Meter>` 漏导入（smoke 逮出）；为 SSR 断言补 `initialActivity`/`initialServers` props（生产不传，同 session-cards 先例）。
- ✅ 步骤 6：`scripts/smoke.mjs` **12 组（30+ 子断言）全绿**——注册链路、context 读数（6.4%/87.8%/211K）、
  四段条标题、turns 统计（34s 整数化是 fmtDuration 原版行为）、技能/MCP 行与重连开关、空态、样式类。
- ✅ 步骤 7：`npx tsc --noEmit` 退出 0（strict 模式；唯一错误是 CollapsibleSection 的 manage 模式不需要 children，
  建模修正为可选 props，修正后 unit/smoke 复跑无回归）。
- ✅ 步骤 8：`npm pack` → `dsh-client-ui-session-panels-0.1.0.tgz`（18.9KB，5 文件）+ `SHA256SUMS.txt`；
  README 含安装三步、数据来源、与 session-cards 对照、砍单说明。
- ✅ 步骤 9：独立性终验——grep `from '@/|oc-ref|packages/ui|@openchamber/` 于 src/scripts/lib/package.json/patch.yml
  **0 命中**（metrics.ts 注释中的出处路径已改写为不带仓库路径的措辞）；
  四连验证 `build + unit + smoke + typecheck` 全绿。
- **终态**：目标达成——插件零 oc-ref 引用依赖，可构建、可冒烟、可安装。

## 自检（fresh pass，2026-11-05）
- 缺步骤？`npm install` 并入步骤 1；无 git、无 CI，不需要 .gitignore/LICENSE 文件。
- 未验证假设？缓存命中率公式 → 步骤 3 先读 oc-ref 实码再移植（已写明）；
  localStorage 在 DSH web 可用 → session-cards layout.ts 实证同机制。
- 更简路径？整体 fork session-cards 改名——拒绝：那不是重写面板，是复制现有插件；
  本计划按面板内核逐模块重写，oc-ref 逻辑只移植纯函数部分。

## 追加：v0.2.0 卡片标题栏 + 拖标题栏调序（2026-11-05）
- ✅ 步骤 10：primitives 新增 `HeaderDragProps`（指针拖拽接线 + 视觉旗标）与
  `toggleGuard`（拖拽后的那一下 click 不折叠）；播放态标题改为**标题栏**
  （`.osp-titlebar`：grip + 图标 + 标题 + 摘要 + 箭头），整个栏面即拖拽把手。
- ✅ 步骤 11：panel.tsx 指针状态机——按下 → 位移 ≥6px 才算拖拽（阈值内是单击）→
  `elementFromPoint` 实时找落点卡（槽位 `data-card-id`）→ 松手 `commitMove` 写
  localStorage；`setPointerCapture` 保指针出栏不断流；manage 模式 HTML5 拖拽保留，
  两套写同一份布局。
- ✅ 步骤 12：验证链升级——新增 `scripts/drag.mjs`（jsdom 真事件序列 5 组：
  拖拽提交/持久化、拖后 click 被吞、阈值内单击仍折叠、空白处松手无操作）；
  **过程坑：单次 setTimeout flush 与 React 18 调度器竞速 → 改轮询 `until` 后 5/5 稳定**；
  门禁链曾因管道吞掉 drag 退出码而漏放行，已改为 `&&` 直链。
- ✅ 步骤 13：终验与打包——`build + unit(15) + drag(5) + smoke(13) + tsc` 全绿；
  独立性 grep 0 命中；`npm pack` → 0.2.0 tgz + SHA256SUMS；README/locales 同步。

## 追加：安装包可删除性（2026-11-05）
- ✅ 步骤 14：路径依赖审计（tgz 产物全量 grep）——零硬编码文件系统路径、零安装位置回依赖
  （唯一 http 字面量 `127.0.0.1` 仅作 URL 解析基座）；确认"装完即删"在运行时层天然成立。
- ✅ 步骤 15：实证安装链——本机 profile（`~/.dsh/profiles/desktop`）里 session-cards 的落盘形态：
  `vendor/*.tgz`（profile 自有 tarball 副本）+ `node_modules/` 实体解包副本（pnpm store 硬链接）+
  清单 `file:vendor/...` 相对 spec → 源 tgz 三重解耦。vendor 收编是先例模式，非文档化安装器行为。
- ✅ 步骤 16：`install.ps1` 交付（拷贝进 vendor → pnpm add file:vendor → 校验副本落盘），
  沙箱假 profile 实测全流程通过；安装态 grep 源路径 **0 引用**、副本 sha256 与产物一致；
  README 安装章节改为三方式并列并写明可删除性保证与警告（勿删 vendor/node_modules、勿用 link: 安装）。

## 追加：v0.2.1 修复折叠键 + 拖拽手感（2026-11-05，ds-tdd）
- 用户报障：① 折叠箭头不响应；② 拖拽时卡片不跟手、边界不清、无手感。
- 根因（真浏览器 vs jsdom 环境盲区）：
  - ① `setPointerCapture` 在 pointerdown 就调用 → 按 Pointer Events 规范，捕获期间
    click 被重定向到捕获元素（标题栏），内部按钮的 onClick 永远收不到 → 折叠键死。
    jsdom 不实现捕获重定向，旧测试直接对按钮派发 click 故测不出。
  - ② 无 ghost、无插入线，且 styles 落点高亮选择器写错
    （`.osp-card-slot[data-drop='true']` 但属性挂在 `.osp-titlebar` 上 → 永不匹配）。
- ✅ 步骤 17：先写红测试（drag.mjs 重写为 7 组）——捕获时机（按下不得捕获/armed 恰一次）、
  ghost 存在与 transform 跟手、释放移除、目标槽 `data-drop-side`、下半区插入 after、抬升占位。
- ✅ 步骤 18：修 ①——捕获后置到 armed 时刻（try/catch），up/cancel 释放；swallowClick 守卫保留。
- ✅ 步骤 19：修 ②——armed 时克隆 `.osp-section` 建 ghost（fixed 定位 + width + transform 跟手，
  pointer-events:none 不挡命中测试，max-height 340 裁高）；原件 `data-lifting` 虚化留守；
  指针在目标卡上半/下半区 → `moveCardRelative` 插入 before/after（layout.ts 新增），
  槽位 `data-drop-side` + CSS `::after` 在 18px 间隙画品牌色插入线；修复死选择器为
  `.osp-titlebar[data-drop='true']`。
- ✅ 步骤 20：门禁 `build + unit(15) + drag(7) + smoke(13) + tsc` 全绿（`&&` 直链）；0.2.1 打包 + SHA256SUMS。
- 经验沉淀：**jsdom 测不出的三类真浏览器行为——指针捕获 click 重定向、CSS 选择器匹配、伪元素渲染；
  交互断言要盯"机制"（何时捕获、属性落在哪个节点），不能只盯"最终状态"。**

## 追加：开发迭代直更链（2026-11-05）
- 用户决策：修正迭代阶段不走 tgz+pnpm 往返，直接把代码推进 DSH profile 的插件副本；
  **tgz 只在最终定稿阶段生成一次**（install.ps1 重对齐 清单+vendor+node_modules）。
- ✅ 步骤 21：`scripts/deploy.mjs` 直更脚本 + `pnpm run deploy` 门禁链（build → deploy）。
  - 落盘形态实证：profile 里 `lib/*.js` 硬链接计数 **2**（指向 pnpm store）→ 直更必须
    **先 unlink 再拷贝**，原地覆写会写穿硬链接污染 store 内容寻址块（脚本核心纪律）。
  - 守卫：目标必须已是 pnpm 注册过的本包副本（首次注册仍归 install.ps1）；包名不符拒绝部署。
  - 校验：版本一致 + `client.js` 含 `__ModuleLoader__`/`osp-ghost` + `index.js` 含
    `/session-panels/mcp` 路由标记（第一版校验串用了完整包名，host 半部没有 → 改路由串）。
  - 实跑：0.2.0 → 0.2.1 换血成功；独立复核 client.js 60049 字节（旧 55886）、
    硬链接计数降为 **1**、`osp-ghost` ×3 在场、store 零接触。
  - 已知边界：直更不动 profile 清单（仍指 `vendor\*.tgz`）；profile 里跑 `pnpm install`
    会从 vendor 恢复旧版冲掉直更 → 定稿时跑 install.ps1 重对齐，此约束写进 README 方式 D。
  - 小坑：Windows CopyFileW 保留源文件 mtime（index.js 显示旧时间戳），内容校验不受影响。

## 追加：ds-review-loop 三轮审查（2026-11-05）
- 评审员：reasoning 模型新鲜上下文子代理（可 resume，3 轮同一人）。裁决轨迹 CHANGES → CHANGES → **APPROVE**。
- 第 1 轮 8 条（4 should + 4 nit），全修：
  - R1 fmtDuration 进位打印 "1m 60s" → 先取整再拆分 + unit 进位用例（119700→'2m 0s'）。
  - R2 拖拽中卸载 ghost 永久滞留 document.body → 卸载清理 effect + drag 组 8（unmount 断言 ghost 消失）。
  - R3 MCP 脚注误用 t('row.window') → 新键 mcp.totalTools（zh/en 39 键，smoke 桩同步）。
  - R4 deploy rm-再拷非原子（锁文件→半删 lib）→ 三段交换：staged 拷贝 → 预校验 → rename 换名，
    失败可恢复、清理尽力而为。
  - R5 会话切换/流结束不重置 in-flight 行 → effect 开头 setActivity 重置 + 流自然结束补 NO_ACTIVITY
    + drag 组 9（harness ctx 挂 remote.session.follow 桩——**入口 Body 无条件 client={ctx} 覆盖 props，
    流桩必须挂 ctx 而非 prop**，首轮测试踩坑即此）。
  - R6 host 快照错误回 200 空列表误导"无服务器" → 改 500，走客户端已测的 http 拒绝 → "状态未知"。
  - R7 死代码清除：primitives 的 Section、format 的 shortId、styles 的 .osp-pill。
  - R8 deploy --profile 缺值静默回退默认 → 报错退出。
- 第 2 轮 4 条（评审员挑我修复引入的洞，全修）：
  - R2-1 开头 rm(libOld) 未捕获 → 一次锁定残留永久阻塞部署 → 逐目录 try/catch + pid 唯一名兜底。
  - R2-2 流结束重置在"宿主返回式中止"下有竞态（旧监视器尾部可擦新会话快照）→ `if (!signal?.aborted)` 守卫。
  - R2-3 内容标记校验在换名之后 → 前移到 staged 副本（坏构建换不进已装 lib）。
  - R2-4 恢复失败掩盖原始错误 → 双报错 + 指明旧 lib 残留路径。
- 第 3 轮 1 条 nit：宿主中止后仍排空队列推迟到帧 → onActivity 包 aborted 守卫（panel 侧）。
  另一条残留目录 nit 判 decline（纯垃圾、永不阻塞，清扫代码不值当）。
- 终态门禁：unit 15 + drag 9 + smoke 13（39 键）+ tsc 干净；已直更上机（client.js 60057 字节）。
- 经验：审查循环的最大价值在第 2 轮——评审员转而攻击"修复本身"，R2-1/R2-2 都是修复引入的次生洞；
  另外测试桩要贴着真实注入链走（ctx 注入 vs props），否则测的是想象中的接线。

## 追加：MCP 卡瘦身（2026-11-05，用户截图圈划）
- 用户指令：不显示每行"工具数 · 传输 · 路径"元信息与底部"共注册 N 个工具"脚注，节省空间。
- 删除面：panel 的 metaOf + osp-mcp-meta 行 + Note 脚注；primitives 的 Note 组件；
  styles 的 .osp-note / .osp-mcp-meta；locales 的 mcp.toolCount / mcp.totalTools（39→37 键）；
  smoke 桩与两条断言（'3 个工具'、传输/URL meta）同步移除。
- 数据层不动：McpServer 接口与 readStatus 窄化仍透传 transport/target/tools（后续想恢复显示只改 UI）。
- 门禁：unit 15 + drag 9 + smoke 13（37 键）+ tsc 干净；直更上机，client.js 60057→58662 字节。

## 追加：直更被回滚事故与 vendor 真源修复（2026-11-05）
- 用户报"没有变化"：实证发现 profile 插件目录 15:20 被换回 0.2.0（client.js 55886、nlink 回 2、
  osp-ghost 消失），DSH 进程 15:25 启动——**应用侧按 manifest 重跑 pnpm，从 vendor 里的
  0.2.0.tgz 重新解包，把直更整体回滚**（pm-host.zh.md:100：tarball spec 重装覆盖已装包）。
- 修复：deploy.mjs 新增 refreshVendorTarball——按 manifest spec 的文件名**原地重写 vendor tarball**
  （staged 目录手工打 npm 布局 tgz：package.json + README.md + cordis.patch.yml + lib/，
  `tar -czf out.tgz package` 相对路径，**GNU tar 会把 `C:\...` 参数当远程主机，必须 cwd+相对名**），
  内容 = 刚部署的构建。此后应用侧任何 pnpm 重解包都复现本次部署；install.ps1 在定稿时重对齐版本命名。
- 实证：node_modules 58662 字节（nlink 1）+ vendor tgz 22512 字节；解包复核 osp-mcp-meta ×0、
  osp-ghost ×3、v0.2.1。两层一致，重启即生效。
- 经验：**直更脚本必须覆盖"应用自己会重跑的安装链"**——只换运行时副本、不动真源，等于没换。

## 步骤 22：改为 registry 分发形态（2026-11-05）
- 实测定性启动重解包的范围：node_modules/.pnpm/.modules.yaml mtime=启动时刻（15:20），
  registry 包 mtime 不动（lockfile+integrity 命中即跳过），`link:` 依赖重建符号链接，
  只有 `file:` tarball 每次启动重新解包。→ 要免重解，必须走 registry。
- 落地：package.json 加 `publishConfig`/`keywords`/`switch:registry`；补 LICENSE（npm pack 6 文件 23.8kB）；
  新增 `scripts/switch-to-registry.mjs`：查 registry（E404 即退出，绝不碰 profile）→
  `pnpm add --save-exact` → 校验清单/副本/版本三层 → 删除 vendor 旧 tgz。
- deploy.mjs：非 vendor spec 时打印提醒——registry 模式下直更会被启动对账还原，必须发新版本。
- 现状：npm whoami = ENEEDAUTH、包 404；安全失败路径已实测（exit 1，profile 原样保留 file: spec）。
- 待办：`npm login && npm publish` 后跑 `pnpm run switch:registry`。

## 步骤 23：显示名改为「右侧面板卡片插件」（2026-11-05）
- 名字的唯一展示源是 client 字典：`type.label`（标签页标题）+ `guide.title`（添加引导胶囊）。
  DSH 的 bundle 没有独立展示名字段（同伴插件 manifest/patch 均无 meta），插件页卡片显示的是包名。
- 改 zh 两键 + en 两键（Right panel cards）+ smoke 桩/断言；门禁全绿（15/9/13 + tsc），直更上机。
- 坑：esbuild 默认把非 ASCII 转成**大写**十六进制 `\uXXXX`，grep 中文查不到；用 JSON.parse 解码验证。

## 步骤 24：只保留 registry 安装，产出发布包（2026-11-05）
- 删除 `install.ps1`（离线 vendor 安装方式退役）；README 安装章节重写为「只支持 registry」：
  发布（pack+publish）→ `switch-to-registry.mjs` → 升级；开发直更单列，标注 registry 模式重启即失效。
- deploy.mjs 清掉 install.ps1 引用；vendor 刷新逻辑保留，仅作旧 `file:` profile 的过渡兼容（检测到 registry spec 自动跳过）。
- 产物：`npm pack` 6 文件 23.3 kB（LICENSE/README/cordis.patch.yml/lib×2/package.json），
  sha256 `3fc37be6…2d38`，SHA256SUMS.txt 已更新并通过 `sha256sum -c`。

## 步骤 25：改为 GitHub 分发（2026-11-05）
- 网络：github.com 一度不可达（api/codeload 可达）→ 先用 Git API 建仓 + blobs→tree→commit→refs 推送；
  网络恢复后 force-push 本地真实历史，main 与 tag 对齐。
- 仓库：https://github.com/alonewolfsy-web/dsh-client-ui-session-panels（public）
- 分发：git tag 安装。pnpm 把 git spec 解析成 **codeload tarball URL + commit**，lockfile 内容寻址 → 启动不重解包。
- 脚本：`switch-to-registry.mjs` → `switch-to-git.mjs`（ls-remote 查 tag → pnpm add github:…#vX → 三层校验 → 删 vendor tgz）。
- 实测：临时目录 pnpm add 成功；profile 切换成功（manifest=github:…#v0.2.1、installed 0.2.1、vendor 清空、
  lock 钉 08f2e01）；Release v0.2.1 + tgz 附件 23355B，下载复核 sha256 9953116f 一致。
- 坑 1：空仓库 API 建 blob 返回 409，需先用 Contents API 初始化一次。
- 坑 2：force 更新 tag 后按 tag 查 release 会 404，改用 release id。
- 坑 3：bash 双引号里的 release body 反引号会被命令替换，body 走文件传。
- 坑 4：已安装状态下在 UI 重复安装 → pnpm `Already up to date`/added 0 → 管理器 diff 识别不到包，
  报「无法从依赖变更中确定安装了哪一个包」。属误报，已写入 README。
- 步骤 26（v0.2.2）：拖拽反馈收窄——ghost 只克隆标题栏（`event.currentTarget`，剥掉 data-dragging/data-drop、
  margin 归零），并强制 chevron 转 -90° 呈折叠态；目标标题栏的 `data-drop` 高亮**整体移除**（接口字段
  `HeaderDragProps.dropTarget` 一并删），落点只剩 gap 里的插入线。标签页 label 缩为「卡片」（guide 保留全名，
  tab 窄会截断）。门禁 unit15/drag9/smoke13/tsc 全绿；发 v0.2.2 tag（commit 330aafd）并 switch-to-git，
  落盘 client.js 58820B、lock 钉 330aafd。
  经验：**给用户看的"拖拽手感"要区分三种语义——被搬运物（ghost）、落点（插入线）、禁止态；把落点信息
  画在目标自身上会和 ghost 重叠，读成"预览"，只留一条线最清楚。**

## 步骤 27：v0.2.3 —— 统计卡对齐应用内浮层（2026-11-06）
- 上下文卡整卡换版：`上文已用 N%` + `-X / Y` 窗口对、单色窗口条、三行构成图例（系统提示词 / 工具定义 / 对话消息，带 `~` 估算）、
  两组 2x2 读数；卡名改「统计」，标题栏摘要 = Token 总量（M）。
- 读数收敛：会话统计只留 首 token 平均（TTFT）/ 输出速度（TPS）；Token 用量只留 缓存命中 / Token 总量（M）。
  删除轮次统计卡（与统计卡的会话统计重复）、`contextSegments` / `StackedMeter` / `Row` / `fmtDuration` 等死代码，
  client.js 62.0KB -> 56.0KB。
- 卡片 id `context` -> `gauge`：旧存档排位沿用原槽位，旧 hidden 标记随旧 id 作废（否则新卡会继承"已隐藏"而不显示）；
  `turns` 退役，读档时直接丢弃。
- 门禁 unit11 / smoke13 / drag9 / tsc 全绿；README 安装命令钉到 v0.2.3 并补版本表。

## 步骤 28：v0.2.4 —— 隔离宿主下的样式注入（2026-11-07）
- 现象：装到另一台机器后整卡无样式，内容纯文字堆叠。根因是样式只写进 `document.head`；宿主把插件 UI 放进
  Shadow DOM 时样式被隔离，或 CSP 无 `style-src unsafe-inline` 时内联 style 被丢弃。
- 修法：`ensureStyles(ref)` 改为注入面板自身 root（`getRootNode()`，ShadowRoot 也写），并额外 adopt 一张
  `CSSStyleSheet`（`replaceSync`），CSP 拦 style 标签时规则仍生效。调用点从 render 里的副作用换成 ref 回调——
  insertion effect 早于 ref 挂载，读不到 root。
- 连带：拖拽 ghost 挂到面板所在 root（否则 shadow 里克隆的标题栏无样式）；`elementFromPoint` 递归下钻 shadow root，
  否则插入位置永远算不出来。
- 回归：drag 增第 10 组「shadow root 里能拿到 style 标签且卡片正常渲染」。门禁 unit11 / smoke13 / drag10 / tsc 全绿。
