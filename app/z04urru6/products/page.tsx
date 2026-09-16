import { listProducts } from "@/lib/products";
import { productPhotoUrl } from "@/lib/uploads";
import AdminPageIntro from "../AdminPageIntro";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import { SuccessBannerProvider } from "../components/SuccessBanner";
import ProductFormModal from "./ProductFormModal";
import DeleteButton from "./DeleteButton";

export const dynamic = "force-dynamic";

// 商品管理 (issue #277) — standalone products/product_photos CRUD, list +
// create/edit form modal + multi-photo upload, same interface shape as
// ../homepage/featured-lofts/page.tsx (the pattern this ticket was asked to
// follow). Deliberately NOT built on homepage_sections — see db/init.sql's
// header comment on the products table for why this ticket needed its own
// table instead of reusing that generic CMS block.
export default async function ProductsAdminPage() {
  // Includes inactive (已下架) rows so admins can still see — and
  // re-enable — them, same as every other admin list in this app.
  const products = await listProducts();

  return (
    <main>
      <SuccessBannerProvider>
      <AdminPageIntro
        title="商品管理"
        description="管理首頁輪播與商品詳情頁使用的獨立商品資料：標題、多張圖片圖庫（含封面圖指定）、價格（或電洽）、庫存、簡介、排序與上下架。停用後不會出現在首頁輪播，商品詳情頁也會顯示 404。有價格且有庫存的商品可於前台線上下單，訂單請至「商品訂單」頁面管理。"
      >
        <ProductFormModal mode="create" />
      </AdminPageIntro>

      {products.length === 0 ? (
        <p className="mt-6 text-ink-light">目前沒有任何商品，請點選上方「新增商品」建立第一筆資料。</p>
      ) : (
        <AdminTable headers={["封面圖", "標題", "價格", "庫存", "簡介", "排序", "狀態", ""]}>
          {products.map((product) => {
            const cover = product.photos.find((photo) => photo.isCover) ?? product.photos[0];
            const coverUrl = cover ? productPhotoUrl(product.id, cover.fileName) : null;
            return (
              <AdminTableRow key={product.id}>
                <AdminTableCell>
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt={product.title} className="h-14 w-14 rounded-lg border border-border object-cover" />
                  ) : (
                    <span className="text-xs text-ink-light">無照片</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="font-medium">{product.title}</AdminTableCell>
                <AdminTableCell className="text-ink-light">
                  {product.price === null ? "電洽" : product.price.toLocaleString("zh-TW")}
                </AdminTableCell>
                <AdminTableCell className="text-ink-light">
                  {product.stockRemaining === null ? "—" : `${product.stockRemaining} / ${product.stockQuantity}`}
                </AdminTableCell>
                <AdminTableCell className="max-w-xs truncate text-ink-light" title={product.description}>
                  {product.description}
                </AdminTableCell>
                <AdminTableCell>{product.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  {product.isActive ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">啟用中</span>
                  ) : (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-light">已停用</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <ProductFormModal
                      mode="edit"
                      product={{
                        id: product.id,
                        title: product.title,
                        price: product.price,
                        stockRemaining: product.stockRemaining,
                        description: product.description,
                        sortOrder: product.sortOrder,
                        isActive: product.isActive,
                        youtubeUrl: product.youtubeUrl,
                        photos: product.photos.map((photo) => ({
                          fileName: photo.fileName,
                          url: productPhotoUrl(product.id, photo.fileName),
                          isCover: photo.isCover,
                        })),
                      }}
                    />
                    <DeleteButton id={product.id} title={product.title} />
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            );
          })}
        </AdminTable>
      )}
      </SuccessBannerProvider>
    </main>
  );
}
