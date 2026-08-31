"use client";

import { ArrowUpRight, MousePointer2, Move, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import type { WallProduct } from "@/lib/types";
import { JoinWallModal } from "@/components/join-wall-modal";
import styles from "./bubble-universe.module.css";

type PhysicsNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  dragging: boolean;
};

const fallbackProducts: WallProduct[] = [
  { id: "demo-1", name: "Your product", url: "#", description: "The next great product belongs here.", logoUrl: null, builderLabel: "your bubble", score: 70, paidCents: 1200 },
  { id: "demo-2", name: "Build something", url: "#", description: "Join the wall for $1.", logoUrl: null, builderLabel: "independent builder", score: 32, paidCents: 500 },
  { id: "demo-3", name: "Ship it", url: "#", description: "Products float by public attention.", logoUrl: null, builderLabel: "independent builder", score: 20, paidCents: 100 },
];

function ProductLogo({ product, detail = false }: { product: WallProduct; detail?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!product.logoUrl || failed) return <>{product.name.slice(0, 1).toUpperCase()}</>;
  return <img src={product.logoUrl} alt="" draggable="false" onError={() => setFailed(true)} className={detail ? styles.detailImage : undefined} />;
}

function productDomain(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return "tokengod.lol"; }
}

export function BubbleUniverse({ products }: { products: WallProduct[] }) {
  const wallRef = useRef<HTMLDivElement>(null);
  const elementRefs = useRef(new Map<string, HTMLButtonElement>());
  const nodesRef = useRef<PhysicsNode[]>([]);
  const dragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = useMemo(() => [...(products.length ? products : fallbackProducts)].sort((a, b) => b.paidCents - a.paidCents).slice(0, 36), [products]);
  const selected = items.find((item) => item.id === selectedId) || null;
  const maxPaidCents = Math.max(100, ...items.map((item) => item.paidCents));

  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;

    let width = wall.clientWidth;
    let height = wall.clientHeight;
    const createNodes = () => {
      const compact = width < 700;
      const minimum = compact ? 48 : items.length < 6 ? 108 : 58;
      const maximum = compact ? 112 : items.length < 6 ? 210 : 176;
      nodesRef.current = items.map((product, index) => {
        const diameter = index === 0
          ? maximum
          : Math.round(minimum + Math.sqrt(product.paidCents / maxPaidCents) * (maximum - minimum) * .72);
        const angle = index * 2.39996;
        const spread = Math.min(width, height) * Math.min(.32, .08 + index * .018);
        return {
          id: product.id,
          x: width / 2 + Math.cos(angle) * spread,
          y: height / 2 + Math.sin(angle) * spread * .72,
          vx: Math.sin(index * 1.71) * .16,
          vy: Math.cos(index * 1.31) * .12,
          radius: diameter / 2,
          phase: index * .83,
          dragging: false,
        };
      });
    };
    createNodes();

    const observer = new ResizeObserver(() => {
      const previousWidth = width || 1;
      const previousHeight = height || 1;
      width = wall.clientWidth;
      height = wall.clientHeight;
      for (const node of nodesRef.current) {
        node.x *= width / previousWidth;
        node.y *= height / previousHeight;
      }
    });
    observer.observe(wall);

    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const delta = Math.min(2, (now - previous) / 16.67);
      previous = now;
      const nodes = nodesRef.current;
      const centerX = width / 2;
      const centerY = height / 2 + 8;

      for (const node of nodes) {
        if (node.dragging) continue;
        node.vx += (centerX - node.x) * .000035 * delta + Math.sin(now * .00035 + node.phase) * .0025;
        node.vy += (centerY - node.y) * .000035 * delta + Math.cos(now * .00029 + node.phase) * .002;
        node.vx *= .992;
        node.vy *= .992;
        node.x += node.vx * delta;
        node.y += node.vy * delta;
      }

      for (let pass = 0; pass < 2; pass += 1) {
        for (let a = 0; a < nodes.length; a += 1) {
          for (let b = a + 1; b < nodes.length; b += 1) {
            const first = nodes[a];
            const second = nodes[b];
            const dx = second.x - first.x;
            const dy = second.y - first.y;
            const distance = Math.max(.1, Math.hypot(dx, dy));
            const required = first.radius + second.radius + 7;
            if (distance >= required) continue;
            const overlap = (required - distance) * .52;
            const nx = dx / distance;
            const ny = dy / distance;
            if (!first.dragging) { first.x -= nx * overlap; first.y -= ny * overlap; first.vx -= nx * .025; first.vy -= ny * .025; }
            if (!second.dragging) { second.x += nx * overlap; second.y += ny * overlap; second.vx += nx * .025; second.vy += ny * .025; }
          }
        }
      }

      for (const node of nodes) {
        const padding = node.radius + 13;
        const minY = node.radius + 50;
        const maxY = height - node.radius - 40;
        if (node.x < padding) { node.x = padding; node.vx = Math.abs(node.vx) * .65; }
        if (node.x > width - padding) { node.x = width - padding; node.vx = -Math.abs(node.vx) * .65; }
        if (node.y < minY) { node.y = minY; node.vy = Math.abs(node.vy) * .65; }
        if (node.y > maxY) { node.y = maxY; node.vy = -Math.abs(node.vy) * .65; }
        const element = elementRefs.current.get(node.id);
        if (element) {
          element.style.width = `${node.radius * 2}px`;
          element.style.height = `${node.radius * 2}px`;
          element.style.transform = `translate3d(${node.x - node.radius}px, ${node.y - node.radius}px, 0) rotate(${Math.max(-3, Math.min(3, node.vx * 2))}deg)`;
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [items, maxPaidCents]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      const wall = wallRef.current;
      if (!drag || !wall) return;
      const node = nodesRef.current.find((candidate) => candidate.id === drag.id);
      if (!node) return;
      const rect = wall.getBoundingClientRect();
      const nextX = event.clientX - rect.left;
      const nextY = event.clientY - rect.top;
      node.vx = (nextX - node.x) * .12;
      node.vy = (nextY - node.y) * .12;
      node.x = nextX;
      node.y = nextY;
      drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
    };
    const up = () => {
      const drag = dragRef.current;
      if (drag) {
        const node = nodesRef.current.find((candidate) => candidate.id === drag.id);
        if (node) node.dragging = false;
        if (drag.moved) ignoreClick.current = true;
      }
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  function begin(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const node = nodesRef.current.find((candidate) => candidate.id === id);
    if (node) node.dragging = true;
    dragRef.current = { id, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function select(id: string) {
    if (ignoreClick.current) { ignoreClick.current = false; return; }
    setSelectedId(id);
  }

  function visit(product: WallProduct) {
    if (product.url !== "#") window.open(product.url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className={styles.section} id="live-map">
      <div className={styles.hero}>
        <span className={`${styles.ambient} ${styles.ambientMint}`} aria-hidden="true" />
        <span className={`${styles.ambient} ${styles.ambientCoral}`} aria-hidden="true" />
        <div className={styles.heroPill}><i /><i /><i /> the live field for independent products</div>
        <h1>Put your build <span>in orbit.</span></h1>
        <p>Your product becomes a living bubble.<br />More backing gives it more space.</p>
        <JoinWallModal currentLeaderCents={maxPaidCents} className={styles.heroCta} label="Get a bubble" />
        <small>Just $1 to join · bigger payment, bigger bubble</small>
      </div>
      <div ref={wallRef} className={styles.wall} style={{ "--product-count": Math.max(3, items.length) } as CSSProperties}>
        <div className={styles.topline}><span><i /> LIVE WALL / {items.length} PRODUCTS</span><span>good products float</span></div>
        <div className={styles.bubbles}>
          {items.map((product, index) => (
            <button
              ref={(element) => { if (element) elementRefs.current.set(product.id, element); else elementRefs.current.delete(product.id); }}
              key={product.id}
              type="button"
              className={`${styles.bubble} ${index === 0 ? styles.primary : ""}`}
              onPointerDown={(event) => begin(event, product.id)}
              onClick={() => select(product.id)}
              onDoubleClick={() => visit(product)}
              aria-label={`Explore ${product.name}`}
            >
              <span className={styles.gloss} />
              <span className={styles.logo}><ProductLogo product={product} /></span>
              <strong>{product.name}</strong>
              <small>{productDomain(product.url)}</small>
            </button>
          ))}
        </div>
        <div className={styles.help}><span><Move size={13} /> drag a bubble around</span><span><MousePointer2 size={13} /> click for details · double-click to visit</span></div>
        {selected ? (
          <aside className={styles.detail}>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Close"><X size={16} /></button>
            <div className={styles.detailLogo}><ProductLogo product={selected} detail /></div>
            <span>PRODUCT ON THE WALL</span>
            <h2>{selected.name}</h2>
            <a className={styles.detailDomain} href={selected.url} target="_blank" rel="noreferrer">{productDomain(selected.url)}</a>
            <p>{selected.description || "An independent product on the TokenGod wall."}</p>
            {selected.url !== "#" ? <button className={styles.visit} type="button" onClick={() => visit(selected)}>Visit product <ArrowUpRight size={15} /></button> : null}
            <small className={styles.detailBrand}>tokengod.lol</small>
          </aside>
        ) : null}
      </div>
      <section className={styles.dashboard} id="ranking" aria-label="Product leaderboard and wall activity">
        <div className={styles.dashboardHead}><span><i /> PRODUCT LEADERBOARD</span><span>earlier bubbles win ties</span></div>
        <div className={styles.leaderboard}>
          {items.map((product, index) => (
            <button className={styles.leader} type="button" key={product.id} onClick={() => { setSelectedId(product.id); document.querySelector("#live-map")?.scrollIntoView({ behavior: "smooth" }); }}>
              <span className={styles.leaderRank}>#{index + 1}</span>
              <span className={styles.leaderLogo}><ProductLogo product={product} /></span>
              <span className={styles.leaderName}><strong>{product.name}</strong><small>product bubble</small></span>
              <span className={styles.leaderScore}>${(product.paidCents / 100).toFixed(product.paidCents % 100 ? 2 : 0)}</span>
            </button>
          ))}
        </div>
        <div className={styles.lower}>
          <article className={styles.stat}><span>Products</span><strong>{items.length}</strong><small>bubbles on the wall</small></article>
          <article className={styles.stat}><span>Biggest bubble</span><strong>${(maxPaidCents / 100).toFixed(0)}</strong><small>current wall leader</small></article>
          <article className={styles.stat}><span>On the wall</span><strong>${(items.reduce((total, item) => total + item.paidCents, 0) / 100).toFixed(0)}</strong><small>paid by builders</small></article>
          <article className={styles.activity}>
            <div className={styles.activityHead}><span>JUST JOINED</span><span>LIVE</span></div>
            <ul>
              {[...items].reverse().slice(0, 3).map((product) => <li key={product.id}><i>{product.name.slice(0, 1)}</i><span><b>{product.name}</b> joined the wall</span></li>)}
            </ul>
          </article>
        </div>
      </section>
    </section>
  );
}
