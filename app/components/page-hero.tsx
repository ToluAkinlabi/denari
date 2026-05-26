import { DenariMark } from './denari-mark';

interface PageHeroProps {
  title: string;
  description: string;
  eyebrow?: string;
}

export function PageHero({ title, description, eyebrow = 'Denari Workspace' }: PageHeroProps) {
  return (
    <div className="rounded-[28px] border border-blue-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(219,234,254,0.95),rgba(191,219,254,0.88))] p-5 shadow-[0_20px_40px_-28px_rgba(37,99,235,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-700">{description}</p>
        </div>
        <DenariMark markClassName="h-11 w-11 rounded-2xl" />
      </div>
    </div>
  );
}