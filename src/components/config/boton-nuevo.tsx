import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotonNuevo({ href, texto }: { href: string; texto: string }) {
  return (
    <Button asChild size="sm">
      <Link href={href}>
        <Plus /> {texto}
      </Link>
    </Button>
  );
}
