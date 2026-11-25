const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  const r = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); if (!gl) return 'no webgl2';
    return { tex: gl.getParameter(gl.MAX_TEXTURE_SIZE), samples: gl.getParameter(gl.MAX_SAMPLES), rb: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), vu: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS), ext: gl.getSupportedExtensions().join(' '), hw: navigator.hardwareConcurrency, mem: performance.memory && performance.memory.jsHeapSizeLimit }; });
  console.log(r); await browser.close();
})();
