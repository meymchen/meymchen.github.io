# Yuming Chen 的个人主页

以工程成长为主线的明亮个人作品集。首页有八阶段时间轴、开源作品、研究方法与联系入口；按能力组织的工程实践集中在 `/resume/`；`/blog/` 收录根据完整简历整理的工程复盘。公开页面仅使用 Yuming Chen、yc、meymchen 等个人标识，不列真实姓名、雇主及内部产品名称，不提供文件下载或打印入口。首页保留二维方腔流与三维圆柱绕流实验。

本次内容更新与验证记录见 `CONTENT-UPDATE.md`；`DELIVERY.md` 保留此前的视觉与交互交付记录。计划域名为 `ymchen.me`，构建默认值与工作流已经配置该地址；尚未购买域名或部署。下文 GitHub Pages 通用说明中的临时地址仅用于托管参考，使用临时地址预览前需同步调整 `SITE_URL` 与 `BASE_PATH`。

## 本地运行

推荐 Node.js 24。打开 PowerShell，在本文件所在目录运行：

```powershell
npm ci
npm run dev
```

访问 http://127.0.0.1:4321/ 。编辑 `src` 内文件会自动更新。按 `Ctrl+C` 停止。

生产版本验证：

```powershell
npm run check
npm run build
npm run preview
```

`preview` 地址同样为 http://127.0.0.1:4321/ 。若开发服务已经占用该端口，终端会提示新端口。不要直接双击 `dist/index.html`，模块脚本需要 HTTP 服务。

## 渲染方案

Astro 7 静态预渲染正文。流场模块独立动态导入，两个算例均在 Web Worker 中用 Float64 分布数组求解，主线程接收可转移的速度场快照并显示。二维采用场着色与粒子轨迹，三维采用透视投影和深度排序显示真实体网格中的示踪粒子、有限长圆柱及区域边框；两者使用 Canvas 2D 绘图接口，不要求 WebGPU／WebGL。像素比上限为 1.5。

流场位于视口外或标签页在后台时，不再发起新的计算请求；离开页面会终止 Worker。每次最多有一个普通计算请求在途，切换及重置请求使用代次编号丢弃旧结果，避免快速切换时混入另一模式的场。减少动态效果设置会默认暂停。关闭 JavaScript 时保留方腔边界与原理说明；后台线程无法加载时提示刷新并禁用控件。

二维默认使用 64×64 的 D2Q9 顶盖驱动方腔：初始流体静止，上盖以 U 向右运动，其余三壁静止，没有入口和出口。固壁位于流体格点与固体格点之间，移动壁反弹增加速度修正；顶角的对角链路以上盖条件优先。有效腔宽 62 格，`Re = U × 62 / ν`。

三维使用 64×32×20 的 D3Q19 体网格，圆柱轴沿 z，中心位于 x＝18、y＝16，半径 4 格，轴向固体格点覆盖 z＝4～15。两端保留流体间隙，求解三个速度分量，包含端部效应。圆柱与 y、z 方向四侧壁反弹，左侧为密度 1、速度 U 的平衡分布储库，右侧复制相邻格点分布作为近似零梯度出口。`Re = U × 8 / ν`。它不是二维结果的拉伸展示。

两种模式的 U 范围均为 0.035～0.085，运动黏度 ν 为 0.03～0.09，默认 U＝0.07、ν＝0.05，`τ = 0.5 + 3ν`。亮点是对速度场采样的示踪粒子，求解对象是 9 或 19 个方向的分布函数。三维“涡量”模式展示 ωz 的符号，不是涡量大小。圆柱图形是格点边界的平滑示意，模拟使用离散固体掩码。

二维点击流体格点可探查九方向分布；三维探针初始位置为（26，16，5），展示十九方向分布；拖动白色探针沿屏幕平面选择流体格点，聚焦探针后用方向键移动 x／y、PageUp／PageDown 调整 z；拖动空白处或在画面聚焦时使用方向键旋转相机，“视角复位”仅重置相机。重置和调参重建当前模式的初始场。暂停后可单步；已提交的计算会先返回，再启用单步按钮。

时间显示为模拟步数。调度上限为每秒 20 个请求，二维每次 16 步、三维每次 4 步；实际速度受设备影响。首次初始化预演二维 1500 步、三维 100 步，减少动态效果或暂停切换时从第 0 步开始。两个算例都是低马赫数教学模型，未进行网格收敛或工程尺度标定。

## GitHub Pages 托管

推荐新建公开仓库 `meymchen.github.io`，将 **website 目录内的内容** 放到新仓库根目录，包括隐藏的 `.github` 目录和 `package-lock.json`。不要上传 `node_modules`、`.npm-cache` 或 `dist`。仓库内容应为：

```text
.github/workflows/deploy.yml
src/
public/
astro.config.mjs
package.json
package-lock.json
...
```

1. 在 GitHub 创建仓库，按仓库给出的指引上传这些文件。当前交付未创建远程仓库，也未提交或推送代码。
2. 打开仓库 **Settings → Pages → Build and deployment**，Source 选择 **GitHub Actions**。
3. 工作流默认监听 `main`。如果使用其他默认分支，修改 `.github/workflows/deploy.yml` 中的 `branches`。
4. 推送文件后，在 **Actions → Deploy personal website** 查看构建和部署结果；也可用 **Run workflow** 手动触发。
5. 成功后访问 https://meymchen.github.io/ 。地址也显示在部署任务中。

普通项目仓库也可使用。比如仓库名 `portfolio`，工作流自动设置 `BASE_PATH=/portfolio`，访问地址为 https://meymchen.github.io/portfolio/ 。它不要求站点只能部署在根路径。

如果保留目前的仓库结构，即 `website` 仍在仓库内：将此工作流复制到**仓库根目录**的 `.github/workflows/deploy.yml`，并在 `withastro/action` 的 `with` 下加入 `path: ./website`。GitHub 不会执行 `website/.github/workflows` 下嵌套的工作流。

自定义域名：在仓库 Pages 设置中配置域名，按 GitHub 提示修改 DNS；将工作流的 `SITE_URL` 改为该域名的 HTTPS 地址，并将 `BASE_PATH` 改为 `/`。重新构建后 canonical 和资源路径会使用新配置。

手动测试项目子路径：

```powershell
$env:BASE_PATH = '/portfolio'
npm run build
npm run preview
# 访问 http://127.0.0.1:4321/portfolio/
```

恢复根路径时，在停止服务后执行：

```powershell
Remove-Item Env:BASE_PATH
npm run build
```

配置依据：[Astro 官方 GitHub Pages 指南](https://docs.astro.build/en/guides/deploy/github/)。固壁反弹背景：[Zou 与 He，1996](https://arxiv.org/abs/comp-gas/9611001)。本实现的入口出口是前述教学近似，不声称实现该论文的 Zou／He 入口条件。依赖精确版本保存在锁文件内。

## 内容维护

导航调整后的维护入口：

- `src/layouts/Layout.astro`：六个主导航入口、当前栏目、手机菜单及页脚。
- `src/data/projects.ts`：项目分类、摘要、技术标签，以及项目与足迹、笔记的关联。详细经历继续复用 `src/data/resume.json`。
- `src/pages/projects/`：项目目录与详情页；`src/components/ResearchNotes.astro` 保存研究正文。
- `src/data/now.ts`：近况条目、首页近况摘要与内容更新日期。更新近况时手动调整日期。
- `src/pages/lab.astro`：流体实验及其相关经历入口，与首页共用实验组件。
- `src/pages/toolbox.astro`：待补充的个人工具清单，不从历史技术栈自动生成推荐。
- 笔记的 `project` 字段对应项目标识，用于生成项目背景与返回足迹的链接。
- 构建后运行 `python tests/navigation-static.py` 检查站内导航；子路径构建时传入相同的 `--base /portfolio/`。这项检查不启动浏览器。

- `src/pages/index.astro`：首页项目、数据、研究及经历。
- `src/styles/global.css` 与 `src/styles/journal.css`：视觉、时间轴及响应式样式。
- `src/components/FluidLab.astro`：流场面板、图例和原理说明。
- `src/scripts/lbm.ts`：D2Q9 方腔求解器。
- `src/scripts/lbm3d.ts`：D3Q19 有限长圆柱绕流求解器。
- `src/scripts/fluid.worker.ts`：后台计算和快照传输。
- `src/scripts/fluid-view.ts`：场着色、粒子示踪与三维投影。
- `src/scripts/scene.ts`：模式切换、交互和资源释放。
- `src/pages/sources.astro`：指标定义、适用范围与研究题录。
- `src/pages/blog/index.astro`：工程笔记索引；现有三篇排障、需求判断和审查评测复盘。

添加文章时新建 `src/pages/blog/your-post.md`：

```markdown
---
layout: ../../layouts/Post.astro
title: 一次真实的工程复盘
description: 简短介绍问题和结论。
date: '2026-09-06'
---

在这里写正文。
```

博客自动按日期倒序显示。未准备公开的草稿请放到 `drafts/` 等 `src/pages` 以外的位置；索引虽会过滤 `draft: true`，但 Astro 的文件路由仍会构建该 Markdown 页面，因此不要把它当作访问控制。

公开内容依据 `../output/resume/resume-complete.md` 和既有个人补充说明整理。完整简历与原始论文留在网站目录之外；不要将它们复制到 `public/`。研究外链指向题录或专利网页，页面不列作者姓名及机构。Banshu 的 SDK 已发布与 Agent core 设计状态分别说明。`tests/journey.spec.ts` 检查全部构建页面及文本资产中的私人标识、文件资产与下载链接。

## 浏览器验证

```powershell
npm run build
npm test
```

默认使用本机 Microsoft Edge，无头测试服务占用 `4337`，与调试服务的 `4321` 分开。浏览器检查两种模式、3D 拖动与方向键、调参、单步、快速切换、手机布局、后台线程加载失败和离开页面后的线程释放。物理检查两种离散模型的矩和周期守恒、二维及沿三维深度方向的剪切波衰减，以及五组参数的方腔／圆柱流稳定性。结果和截图写入 `test-results/`。

其他系统需安装 Edge，或先安装 Playwright Chromium，设置 `$env:TEST_BROWSER='chromium'` 后运行。若在 Codex Windows 沙箱中测试结束时无法清理子进程，可在正常 PowerShell 中执行。网站本身不需要提升权限。

本环境中的 Astro 会识别代理终端并自动后台运行开发或预览服务。可执行 `npx astro dev status`、`npx astro dev stop`，或相应的 `preview status`、`preview stop` 管理它。普通交互终端通常使用 `Ctrl+C`。
