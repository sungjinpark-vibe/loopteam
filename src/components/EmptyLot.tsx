import { memo } from "react";

/** An unbuilt plot — dashed outline, no content. */
export const EmptyLot = memo(function EmptyLot() {
  return <div className="empty-lot" aria-hidden="true" />;
});
