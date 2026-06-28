import { Panel } from "./Panel";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel className="p-10 text-center">
      {icon && <div className="mx-auto mb-3 grid place-items-center w-10 h-10 rounded-full bg-raised text-dim">{icon}</div>}
      <p className="text-ink font-medium">{title}</p>
      {description && <p className="text-sm text-muted mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Panel>
  );
}
