import { Construction } from "lucide-react";

export function EnConstruccion({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm">
        <Construction className="size-8" />
        <p>{detalle}</p>
      </div>
    </section>
  );
}
