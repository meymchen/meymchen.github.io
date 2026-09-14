  const target = document.getElementById('scene');
  if (target) {
    const observer = new IntersectionObserver(async entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      observer.disconnect();
      try { const { mountScene } = await import('./scene'); await mountScene(target); }
      catch { const status = document.getElementById('scene-status'); if (status) status.textContent = '模拟未加载，显示静态示意'; document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.scene-controls button, .lbm-inputs input').forEach(b => b.disabled = true); }
    }, { rootMargin: '100px' });
    observer.observe(target);
  }
