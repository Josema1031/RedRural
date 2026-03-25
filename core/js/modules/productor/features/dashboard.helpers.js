
export function setHoyMessage(element, text, ok = true) {
  if (!element) return;
  element.textContent = text;
  element.style.color = ok ? '#14532d' : '#b91c1c';
}

export function renderMiniDashboardItem(titulo, subtitulo) {
  return `
    <div style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#fff">
      <div style="font-weight:800;color:#111827">${titulo}</div>
      <div class="muted" style="margin-top:4px">${subtitulo}</div>
    </div>
  `;
}
