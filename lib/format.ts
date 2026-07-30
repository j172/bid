export function formatRemaining(endsAt: Date): string {
  const remainingMs = new Date(endsAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "已結束";
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小時`);
  if (days === 0 && minutes > 0) parts.push(`${minutes} 分鐘`);

  return `剩餘 ${parts.length > 0 ? parts.join(" ") : "不到 1 分鐘"}`;
}
