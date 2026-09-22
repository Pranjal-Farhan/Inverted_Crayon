export function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-line bg-panel p-4.5 ${className}`}>
      {title && <h3 className="font-impact mb-3.5 text-[17px] uppercase tracking-[0.5px]">{title}</h3>}
      {children}
    </div>
  );
}
