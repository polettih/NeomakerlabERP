import { CatalogImport } from "@/components/catalog-import";

export default function ImportarCatalogoPage() {
  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Importar catálogo</h1>
          <p className="muted">
            Traga SKU e fotos direto do catálogo da Shopee para os produtos já cadastrados aqui.
          </p>
        </div>
      </div>
      <CatalogImport />
    </div>
  );
}
