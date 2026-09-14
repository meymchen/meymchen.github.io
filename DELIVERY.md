# 本次交付

## 网站

明亮主题，八阶段工程成长时间轴。桌面端沿左侧纵轴阅读，手机端使用八个节点组成的紧凑横轴；滚动自动更新当前阶段，节点也是原生锚点链接。支持键盘、直接打开章节链接、关闭 JavaScript 及减少动态效果设置。没有接管滚轮或强制翻屏。

首页保留 yc、meymchen、Yuming Chen 标识，将任职实体、完整作者署名和项目对标描述放在简历及来源页。流场实验仍保留深色画布，以便识别粒子，周围界面统一为明亮主题。

流体实验已从首屏迁入大学计算流体力学足迹。`FluidExperience.astro` 提供原生 dialog 放大视图，将同一个实验节点移入弹窗，关闭后归位，保留模拟参数、步数及模式。支持关闭按钮、Esc、点击遮罩与焦点返回。桌面端将控制区置于画面右侧，手机端支持弹窗内滚动。此次构建和类型检查通过，11 项页面与弹窗测试断言通过，最终布局调整后两项弹窗测试再次通过；测试服务清理仍按下文说明中断。

八个足迹现分别配有 SVG 循环动画：关键帧弹跳、Pascal 逐行执行、绕流、风机监测、对战学习、代码补全、证据审查和技能分发。它们是主题示意，不是业务数据或真实训练过程回放。每个动画可暂停／继续，离开视口或切换到后台时暂停；系统减少动态效果设置下保留静态构图。实现位于 `src/components/JourneyVisual.astro` 与 `src/scripts/journey-motion.ts`。

本次动画更新后，类型检查、生产构建、四项时间轴回归测试及两项动画测试通过。动画测试遍历八个场景，检查播放时间推进、无限循环、手动暂停与恢复、视口外停止、窄屏溢出及减少动态效果设置切换；各场景截图保存为 `test-results/motion-0.png` 至 `motion-7.png`。测试进程清理仍采用下文说明的中断方式。

## 简历与材料

- `src/data/resume.json`：网页版与 PDF 共用的完整内容源。
- `src/pages/resume.astro`：网页简历、打印与下载入口。电话号码仅出现在 PDF。
- `../resume-comprehensive.typ`：两页单栏 PDF 排版，使用本机 Noto Sans SC 字体。
- `../resume-comprehensive.pdf`：新的完整简历。原来的 `resume.typ`、`resume.pdf` 和 HSBC 版本保持原样。
- `public/resume-comprehensive.pdf`：网站下载副本。
- `../FACTS-TO-FILL.md`：项目分工、算法、指标口径和科研材料的空表格，仅保存在本地。
- `../RESEARCH-NOTES.md`：一手来源核验笔记；可公开的选录整理在 `/sources/`。

从仓库根目录重新生成 PDF 后，将它同步复制到 `website/public/resume-comprehensive.pdf`，再构建网站。Typst 文件直接读取 JSON，无需分别改写网页与 PDF 文案。

## 域名与发布状态

`astro.config.mjs` 和现有部署工作流预设 `https://ymchen.me`、根路径 `/`。这只配置生成的 canonical、分享链接和静态资源路径，不代表域名已购买、DNS 已配置或网站已发布。本次没有提交、推送或部署。

## 验证

类型检查与生产构建通过，23 个文件零错误、零警告。原有 20 项流体数值及页面测试全部通过；新增时间轴、手机深链接、简历下载与无 JavaScript 阅读的四项测试也全部通过。测试中的首次滚动检查只保证元素可见，未保证它进入阅读位置，已改为明确滚动至章节开头后重测通过。PDF 已由 Typst 编译并逐页渲染检查，共两页。

截图保存在 `test-results/timeline-desktop.png`、`test-results/timeline-mobile.png`、`test-results/resume-page-1.png` 与 `test-results/resume-page-2.png`。再次运行测试会刷新该目录。测试断言均完成，但本环境的测试进程停在预览子进程清理阶段，已中断清理；不把这表述为整个命令正常退出。

Windows 沙箱中，测试服务清理有时延迟。`TEST_REUSE_SERVER=1` 仅供复用自己启动且已确认指向当前构建的预览服务；默认仍创建独立服务。
