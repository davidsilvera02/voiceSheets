"use client";

import { useParams } from "next/navigation";
import { SpreadsheetView } from "@/components/spreadsheet/spreadsheet-view";

export default function SpreadsheetPage() {
  const params = useParams<{ id: string }>();
  return <SpreadsheetView id={params.id} />;
}
