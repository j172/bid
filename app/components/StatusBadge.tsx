export default function StatusBadge({ status, isLeading }: { status: string; isLeading?: boolean }) {
  if (status === "scheduled") {
    return (
      <span className="inline-block rounded-full bg-interactive-primary-subtle px-2.5 py-0.5 text-xs font-medium text-interactive-primary">
        尚未開標
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        已下架
      </span>
    );
  }

  if (status !== "open") {
    return (
      <span className="inline-block rounded-full bg-ended-bg px-2.5 py-0.5 text-xs font-medium text-ended">
        已結標
      </span>
    );
  }

  if (isLeading === true) {
    return (
      <span className="inline-block rounded-full bg-leading-bg px-2.5 py-0.5 text-xs font-medium text-leading">
        目前領先
      </span>
    );
  }
  if (isLeading === false) {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        已被超越
      </span>
    );
  }

  return (
    <span className="inline-block rounded-full bg-interactive-primary-subtle px-2.5 py-0.5 text-xs font-medium text-interactive-primary-active">
      競標中
    </span>
  );
}
