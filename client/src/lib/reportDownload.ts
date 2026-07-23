export async function resolveReportHref(url: string): Promise<string> {
  if (url.startsWith("data:application/pdf")) {
    const blob = await fetch(url).then(response => response.blob());
    return URL.createObjectURL(blob);
  }

  return new URL(url, window.location.origin).href;
}

export async function openReportUrl(url: string, targetWindow?: Window | null) {
  const href = await resolveReportHref(url);

  if (targetWindow && !targetWindow.closed) {
    targetWindow.location.href = href;
    return;
  }

  window.open(href, "_blank", "noopener,noreferrer");
}
