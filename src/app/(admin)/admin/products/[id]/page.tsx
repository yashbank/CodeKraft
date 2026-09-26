import { ProductEditor } from "@/components/admin/catalog/ProductEditor";
import {
  PRODUCT_EDITOR,
} from "@/app/dev/screens/_fixtures/admin";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminProductEditorPage({ params }: PageProps) {
  const { id } = await params;
  const isNew = id === "new";

  const product = {
    ...PRODUCT_EDITOR,
    id: isNew ? "new-prod" : id,
  };

  return (
    <ProductEditor
      product={product}
      approvers={["Priya Nair", "Arjun Patel"]}
      listHref="/admin/products"
      approvalsHref="/admin/approvals"
      currencies={["INR", "USD"]}
      gstinConfigured={true}
      isNew={isNew}
    />
  );
}
