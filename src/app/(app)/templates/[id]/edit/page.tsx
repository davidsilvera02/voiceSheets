"use client";

import { useParams } from "next/navigation";
import { TemplateEditor } from "@/components/templates/template-editor";
import { useTemplate } from "@/hooks/use-templates";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError } = useTemplate(params.id);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Template not found.</div>;
  }
  return <TemplateEditor template={data} />;
}
