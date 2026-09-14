import cv from './resume.json';

type RecordEntry = { title: string; meta: string; subtitle?: string; bullets: string[]; links?: { label: string; url: string }[] };
export type Project = {
  slug: string; title: string; group: string; summary: string; chapter: string;
  chapterLabel: string; tags: string[]; record: RecordEntry; note?: string; source?: string;
};

export const projectGroups = [
  { id: 'personal', title: '个人开源', description: '继续把经验写进自己的工具。' },
  { id: 'developer-tools', title: '开发者工具', description: '让模型接进每天的工作。' },
  { id: 'games', title: '游戏与系统', description: '训练智能体，也观察工具怎样被使用。' },
  { id: 'research', title: '研究与工程', description: '从仿真、实验走到设备与数据。' },
];

export const projects: Project[] = [
  { slug: 'lspf', title: 'lspf', group: 'personal', summary: '一个 Rust LSP 框架，处理协议生命周期、请求取消与资源释放。', chapter: 'sharing', chapterLabel: '2026 · 把经验变成公共能力', tags: ['Rust', 'LSP'], record: cv.sections[3].entries[0], source: 'opensource' },
  { slug: 'banshu', title: 'Banshu / banshu-ai', group: 'personal', summary: '从统一模型调用的 Rust SDK，继续探索智能体的构建。', chapter: 'sharing', chapterLabel: '2026 · 把经验变成公共能力', tags: ['Rust', 'LLM SDK'], record: cv.sections[3].entries[1], source: 'opensource' },
  { slug: 'ai-coding', title: 'AI 编程工具', group: 'developer-tools', summary: '从零打通上下文、推理服务与编辑器，再沿用户请求定位补全延迟。', chapter: 'coding', chapterLabel: '2023 · 从零构建编程工具', tags: ['模型推理', 'LSP', 'GPTQ', '可观测性'], record: cv.sections[0].entries[0], note: 'completion-latency', source: 'metrics' },
  { slug: 'code-review', title: '代码审查流水线', group: 'developer-tools', summary: '给审查建议找到依据，并把质量、时间和成本放在同一次评测里。', chapter: 'review', chapterLabel: '2025 · 让审查有据可查', tags: ['代码图谱', '语义检索', '评测'], record: cv.sections[0].entries[1], note: 'review-metrics', source: 'metrics' },
  { slug: 'skill-platform', title: '智能体技能分享平台', group: 'developer-tools', summary: '把个人方法交到团队手里，串起注册、检索、检查和分发。', chapter: 'sharing', chapterLabel: '2026 · 把经验变成公共能力', tags: ['TypeScript', 'PostgreSQL / pgvector', '权限'], record: cv.sections[0].entries[2], source: 'metrics' },
  { slug: 'game-agents', title: '游戏智能体与分布式训练', group: 'games', summary: '搭建分布式训练系统，让智能体进入游戏，再用网页连接训练与分析。', chapter: 'systems', chapterLabel: '2021 · 从算法到系统', tags: ['强化学习', '分布式训练', 'Elo / TrueSkill'], record: cv.sections[1].entries[0] },
  { slug: 'game-tools', title: '数值平衡与游戏生产工具', group: 'games', summary: '一次数值平衡工具的尝试，让我重新看待算法目标与用户工作的距离。', chapter: 'systems', chapterLabel: '2021 · 从算法到系统', tags: ['强化学习', '遗传算法', '产品取舍'], record: cv.sections[1].entries[1], note: 'algorithm-and-workflow' },
  { slug: 'infrastructure', title: 'GPU 资源与可观测系统', group: 'games', summary: '参与 GPU 资源平台研发，用指标、日志与链路追踪观察生产系统。', chapter: 'coding', chapterLabel: '2023 · 从零构建编程工具', tags: ['Kubernetes', 'OpenTelemetry', 'Grafana'], record: cv.sections[1].entries[2] },
  { slug: 'research', title: '流体仿真与工业监测', group: 'research', summary: '检查数值计算的边界，与实验和设备数据对照，再把判断接进软件。', chapter: 'real-world', chapterLabel: '2016 · 面对真实工程问题', tags: ['计算流体力学', 'Python', '机器学习', '设备监测'], record: cv.sections[2].entries[0], source: 'research' },
];

export const notes = [
  { slug: 'completion-latency', title: '补全变慢时，先沿请求走一遍', project: 'ai-coding' },
  { slug: 'algorithm-and-workflow', title: '算法目标，离用户的工作还有多远', project: 'game-tools' },
  { slug: 'review-metrics', title: '评价代码审查，先看每个指标的分母', project: 'code-review' },
];
