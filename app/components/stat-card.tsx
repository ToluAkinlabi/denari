interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: string;
}

export function StatCard({ label, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-xs text-muted mb-1">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
        {subtitle && <p className="text-xs text-subtle mt-1">{subtitle}</p>}
      </div>
      {icon && <div className="text-2xl ml-2">{icon}</div>}
    </div>
  );
}
