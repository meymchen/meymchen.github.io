import { FluidView } from "./fluid-view";
import { C3 } from "./lbm3d";
import type { FluidKind, FluidFrame, FluidRequest } from "./fluid-types";

export async function mountScene(host: HTMLElement) {
  const view = new FluidView(),
    worker = new Worker(new URL("./fluid.worker.ts", import.meta.url), {
      type: "module",
    });
  const root = host.closest<HTMLElement>(".lbm-lab")!,
    get = <T extends HTMLElement>(id: string) =>
      root.querySelector<T>(`#${id}`)!;
  const speed = get<HTMLInputElement>("flow-speed"),
    viscosity = get<HTMLInputElement>("viscosity"),
    pause = get<HTMLButtonElement>("pause"),
    step = get<HTMLButtonElement>("step");
  const abort = new AbortController(),
    options = { signal: abort.signal },
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let kind: FluidKind = "cavity",
    generation = 0,
    id = 0,
    pending = false,
    paused = reduced.matches,
    failed = false,
    disposed = false,
    raf = 0,
    last = 0,
    dragging = false,
    lastX = 0,
    lastY = 0,
    queuedProbe = false;
  let probe: [number, number, number] = [32, 32, 0],
    frame: FluidFrame | undefined;
  host.appendChild(view.canvas);
  host.appendChild(view.probeHandle);
  let probeDrag = false;
  let dragAnchor: [number, number, number] = [26, 16, 5];
  function sync() {
    pause.textContent = paused ? "继续模拟" : "暂停模拟";
    pause.setAttribute("aria-pressed", String(paused));
    step.disabled = !paused || pending || failed;
    get("speed-value").textContent = Number(speed.value).toFixed(3);
    get("viscosity-value").textContent = Number(viscosity.value).toFixed(3);
  }
  function send(action: FluidRequest["action"], count = 0) {
    if (disposed || (failed && action !== "reset")) return;
    if (pending && action !== "reset") {
      if (action === "probe") queuedProbe = true;
      return;
    }
    pending = true;
    sync();
    worker.postMessage({
      id: ++id,
      generation,
      action,
      kind,
      speed: Number(speed.value),
      viscosity: Number(viscosity.value),
      count,
      probe,
    } satisfies FluidRequest);
  }
  function populations() {
    const container = get("populations");
    container.replaceChildren();
    container.dataset.dim = kind;
    const indices =
      kind === "cavity"
        ? [7, 4, 8, 3, 0, 1, 6, 2, 5]
        : Array.from({ length: 19 }, (_, i) => i);
    for (const q of indices) {
      const cell = document.createElement("div"),
        label = document.createElement("span"),
        value = document.createElement("b");
      cell.id = `f-${q}`;
      value.id = `fv-${q}`;
      value.textContent = "—";
      label.textContent =
        kind === "cavity"
          ? `${["·", "→", "↓", "←", "↑", "↘", "↙", "↖", "↗"][q]} f${q}`
          : `${C3[q][0]},${-C3[q][1]},${C3[q][2]}`;
      cell.append(label, value);
      container.appendChild(cell);
    }
  }
  function configure() {
    host.dataset.kind = kind;
    host.dataset.steps = "0";
    host.removeAttribute("data-rendered");
    root
      .querySelectorAll<HTMLButtonElement>("[data-example]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.example === kind)),
      );
    get("model-label").textContent =
      kind === "cavity" ? "D2Q9 / LIVE" : "D3Q19 / LIVE";
    get("fluid-title").textContent =
      kind === "cavity" ? "顶盖驱动方腔流" : "有限长圆柱绕流";
    get("grid-size").textContent =
      kind === "cavity" ? "64 × 64" : "64 × 32 × 20";
    get("speed-label").textContent =
      kind === "cavity" ? "顶盖速度 U" : "来流速度 U";
    get("fluid-help").textContent =
      kind === "cavity"
        ? "上盖向右运动，其余三壁静止 · 点击格点探查分布"
        : "拖动白色探针采样，拖动空白处旋转 · 探针聚焦后方向键移动，PageUp／PageDown 调整深度";
    host.setAttribute(
      "aria-label",
      kind === "cavity"
        ? "二维顶盖驱动方腔流，点击流体查看格点分布"
        : "三维有限长圆柱绕流，拖动白色探针采样，拖动空白处或使用方向键旋转视角",
    );
    get("boundary-note").textContent =
      kind === "cavity"
        ? "封闭方腔 · 上盖 U → · 三壁无滑移"
        : "入口 U → · 四侧壁无滑移 · 出口近似零梯度";
    get("model-note").textContent =
      kind === "cavity"
        ? "二维 D2Q9：上盖向右运动，带动封闭方腔内的主涡；Re 以腔体边长计算。初始流体静止。"
        : "三维 D3Q19：19 个方向的分布在整个体网格中迁移。圆柱轴沿 z，端部留有流体间隙；Re 以直径计算。流线来自三维速度场。";
    get("population-note").textContent =
      kind === "cavity"
        ? "每格保存九个方向的分布 fᵢ，中心 f₀ 为静止分布。"
        : "所选探针的 19 个分布。拖动沿屏幕平面移动，PageUp／PageDown 调整 z；避开圆柱与固壁。标签为方向（cx，cy，cz）。";
    get("collision-note").textContent =
      kind === "cavity"
        ? "迁移：分布移动到相邻格点。静止壁反弹，上盖通过移动壁修正注入水平动量。"
        : "迁移：分布沿 19 个离散方向移动。圆柱及四侧壁反弹，入口补给、出口流出。";
    get("view-reset").hidden = kind === "cavity";
    get("step-count").textContent = "0";
    populations();
    legend();
    resize();
  }
  function reset(warmup = 0) {
    failed = false;
    generation++;
    queuedProbe = false;
    frame = undefined;
    host.dataset.steps = "0";
    host.removeAttribute("data-rendered");
    view.canvas.hidden = true;
    view.probeHandle.hidden = true;
    get("scene-status").textContent = "正在初始化流场…";
    get("fallback-diagram").setAttribute("hidden", "");
    get("lbm-fallback").hidden = false;
    get("fallback-caption").textContent =
      kind === "cavity" ? "正在初始化二维方腔流…" : "正在初始化三维圆柱绕流…";
    send("reset", warmup);
  }
  function legend() {
    get("field-legend").textContent =
      view.mode === "speed"
        ? kind === "cavity"
          ? "流速 |u|　暗 0 → 亮 0.10"
          : "示踪粒子流速　青 0 → 黄绿 0.13"
        : kind === "cavity"
          ? "涡量 ωz　橙 −0.01 ↔ 青 ＋0.01"
          : "粒子按 ωz 符号着色　橙 − ／ 青 ＋";
  }
  function failure(message: string) {
    failed = true;
    pending = false;
    paused = true;
    sync();
    get("scene-status").textContent = message;
    if (!frame) get("fallback-caption").textContent = message;
  }
  worker.onmessage = (event: MessageEvent<FluidFrame>) => {
    const next = event.data;
    if (disposed || next.generation !== generation) return;
    pending = false;
    if (next.error) {
      failure("模拟异常，请重置重试");
      return;
    }
    frame = next;
    view.canvas.hidden = false;
    view.update(next);
    host.dataset.steps = String(next.steps);
    host.dataset.rendered = "true";
    get("lbm-fallback").hidden = true;
    get("step-count").textContent = String(next.steps);
    get("re-value").textContent = next.reynolds.toFixed(0);
    get("tau-value").textContent = next.tau.toFixed(3);
    get("scene-status").textContent = "格子单位 · 调参后重新初始化";
    get("probe-location").textContent =
      `${kind === "cavity" ? "格点" : "尾迹探针"}（${next.probe.slice(0, kind === "cavity" ? 2 : 3).join("，")}）`;
    const i =
        (next.probe[0] +
          next.width * (next.probe[1] + next.height * next.probe[2])) *
        4,
      u = next.field;
    get("probe-macro").textContent =
      `ρ ${u[i].toFixed(3)} · u（${[u[i + 1], -u[i + 2], ...(kind === "cylinder" ? [u[i + 3]] : [])].map((v) => v.toFixed(3)).join("，")}）`;
    next.populations.forEach((value, q) => {
      get(`f-${q}`).style.setProperty(
        "--amount",
        `${Math.max(0, value) * 220}%`,
      );
      get(`f-${q}`).title = `f${q} = ${value.toFixed(6)}`;
      get(`fv-${q}`).textContent = value.toFixed(3);
    });
    root
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>(
        ".lbm-inputs input,.scene-controls button",
      )
      .forEach((el) => (el.disabled = false));
    sync();
    if (queuedProbe) {
      queuedProbe = false;
      send("probe");
    }
  };
  worker.onerror = () => {
    worker.terminate();
    failure("后台模拟无法加载，请刷新重试");
    root
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")
      .forEach((el) => (el.disabled = true));
    get("lbm-fallback").hidden = false;
    get("fallback-diagram").toggleAttribute("hidden", kind !== "cavity");
    get("fallback-caption").textContent =
      kind === "cavity" ? "模拟未加载，显示边界示意" : "三维模拟未加载，请刷新重试";
  };
  function resize() {
    const bounds = host.getBoundingClientRect();
    view.resize(bounds.width, bounds.height);
    if (frame) view.draw(frame);
  }
  root.querySelectorAll<HTMLButtonElement>("[data-example]").forEach((button) =>
    button.addEventListener(
      "click",
      () => {
        if (kind === button.dataset.example) return;
        kind = button.dataset.example as FluidKind;
        probe = kind === "cavity" ? [32, 32, 0] : [26, 16, 5];
        dragging = false;
        configure();
        reset(reduced.matches || paused ? 0 : kind === "cavity" ? 1500 : 100);
      },
      options,
    ),
  );
  for (const input of [speed, viscosity])
    input.addEventListener(
      "input",
      () => {
        sync();
        reset();
      },
      options,
    );
  pause.addEventListener(
    "click",
    () => {
      paused = !paused;
      sync();
    },
    options,
  );
  step.addEventListener("click", () => send("step", 1), options);
  get("reset").addEventListener(
    "click",
    () => {
      speed.value = ".07";
      viscosity.value = ".05";
      reset();
    },
    options,
  );
  get("view-reset").addEventListener(
    "click",
    () => {
      view.yaw = -0.55;
      view.pitch = 0.45;
      if (frame) view.draw(frame);
    },
    options,
  );
  root.querySelectorAll<HTMLButtonElement>("[data-field]").forEach((button) =>
    button.addEventListener(
      "click",
      () => {
        view.mode = button.dataset.field as "speed" | "curl";
        root
          .querySelectorAll("[data-field]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        legend();
        if (frame) view.draw(frame);
      },
      options,
    ),
  );
  host.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return;
      if (kind === "cylinder") {
        dragging = true;
        probeDrag = e.target === view.probeHandle;
        dragAnchor = [...probe];
        if (probeDrag) view.probeHandle.focus({ preventScroll: true });
        lastX = e.clientX;
        lastY = e.clientY;
        host.setPointerCapture(e.pointerId);
      } else {
        const r = host.getBoundingClientRect();
        probe = [
          Math.max(
            1,
            Math.min(62, Math.round(((e.clientX - r.x) / r.width) * 64)),
          ),
          Math.max(
            1,
            Math.min(62, Math.round(((e.clientY - r.y) / r.height) * 64)),
          ),
          0,
        ];
        send("probe");
      }
    },
    options,
  );
  host.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging || kind !== "cylinder") return;
      if (probeDrag && frame) {
        const r = host.getBoundingClientRect();
        const next = view.probeAt(frame, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, dragAnchor);
        if (next && next.some((n, i) => n !== probe[i])) { probe = next; send("probe"); }
        return;
      }
      view.yaw += (e.clientX - lastX) * 0.008;
      view.pitch = Math.max(
        -1.1,
        Math.min(1.1, view.pitch + (e.clientY - lastY) * 0.006),
      );
      lastX = e.clientX;
      lastY = e.clientY;
      if (frame) view.draw(frame);
    },
    options,
  );
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    host.addEventListener(
      event,
      () => {
        dragging = false;
        probeDrag = false;
      },
      options,
    );
  host.addEventListener(
    "keydown",
    (e) => {
      if (kind === "cylinder" && e.target === view.probeHandle && frame) {
        const offsets: Record<string, [number, number, number]> = {
          ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0], ArrowUp: [0, -1, 0], ArrowDown: [0, 1, 0], PageUp: [0, 0, 1], PageDown: [0, 0, -1],
        };
        const delta = offsets[e.key];
        if (delta) {
          e.preventDefault();
          const next = view.validProbe(frame, probe.map((n, i) => n + delta[i]) as [number, number, number]);
          if (next) { probe = next; send("probe"); }
          return;
        }
      }
      if (
        kind !== "cylinder" ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      )
        return;
      e.preventDefault();
      view.yaw +=
        e.key === "ArrowLeft" ? -0.15 : e.key === "ArrowRight" ? 0.15 : 0;
      view.pitch = Math.max(
        -1.1,
        Math.min(
          1.1,
          view.pitch +
            (e.key === "ArrowUp" ? -0.1 : e.key === "ArrowDown" ? 0.1 : 0),
        ),
      );
      if (frame) view.draw(frame);
    },
    options,
  );
  reduced.addEventListener(
    "change",
    () => {
      paused = reduced.matches;
      sync();
    },
    options,
  );
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  root
    .querySelectorAll<HTMLButtonElement>("[data-example]")
    .forEach((el) => (el.disabled = false));
  configure();
  reset(reduced.matches ? 0 : 1500);
  function loop(time: number) {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    if (time - last < 50) return;
    last = time;
    if (paused || pending || document.hidden || failed) return;
    const r = host.getBoundingClientRect();
    if (
      r.bottom <= 0 ||
      r.top >= innerHeight ||
      r.right <= 0 ||
      r.left >= innerWidth
    )
      return;
    send("step", kind === "cavity" ? 16 : 4);
  }
  raf = requestAnimationFrame(loop);
  window.addEventListener(
    "pagehide",
    (e) => {
      if (!e.persisted) {
        disposed = true;
        cancelAnimationFrame(raf);
        worker.terminate();
        ro.disconnect();
        abort.abort();
      }
    },
    options,
  );
}
