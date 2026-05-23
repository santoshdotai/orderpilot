import { useEffect, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { deleteProduct, fetchProducts, saveProduct } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type { Product } from "../lib/types";

const EMPTY_PRODUCT: Product = {
  sku: "",
  name: "",
  price: 0,
  stock: 0,
};

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Product>(EMPTY_PRODUCT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProducts() {
    try {
      setLoading(true);
      const nextProducts = await fetchProducts();
      setProducts(nextProducts);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await saveProduct(draft);
      setDraft(EMPTY_PRODUCT);
      await loadProducts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: string) {
    try {
      await deleteProduct(productId);
      await loadProducts();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete product.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Keep the catalog pricing ready for AI-generated quotes"
        description="The `products` table powers quotation pricing, fuzzy product matching in n8n, and the spreadsheet sync layer for non-technical sales teams."
      />

      {error ? <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Add product" eyebrow="Catalog editor">
          <form className="space-y-4" onSubmit={handleSave}>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/75">SKU</span>
              <input
                className="field"
                value={draft.sku ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/75">Product name</span>
              <input
                className="field"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/75">Price</span>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.price ?? 0}
                  onChange={(event) => setDraft((current) => ({ ...current, price: Number(event.target.value) }))}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-mist/75">Stock</span>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.stock ?? 0}
                  onChange={(event) => setDraft((current) => ({ ...current, stock: Number(event.target.value) }))}
                  required
                />
              </label>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? "Saving..." : "Save product"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Catalog inventory" eyebrow="Products table">
          {loading ? <LoadingState label="Loading products..." /> : null}
          {!loading && !products.length ? (
            <EmptyState
              title="The catalog is empty"
              description="Seed a few SKUs first so the n8n workflow can match AI extracted product names against your editable catalog."
            />
          ) : null}

          <div className="grid gap-3">
            {products.map((product) => (
              <div key={product.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-mint">{product.sku}</p>
                    <h3 className="mt-2 font-display text-xl text-white">{product.name}</h3>
                    <p className="mt-3 text-sm text-mist/80">
                      {formatCurrency(product.price)} · {product.stock ?? 0} units in stock
                    </p>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => handleDelete(product.id!)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
