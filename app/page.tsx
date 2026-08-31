import { BubbleUniverse } from "@/components/bubble-universe";
import { getWallProducts } from "@/lib/wall-products";

import styles from "./bubble-universe.module.css";

export default async function HomePage() {
  const products = await getWallProducts();
  return (
    <main className={`${styles.page} tg-main`}>
      <BubbleUniverse products={products} />
    </main>
  );
}
