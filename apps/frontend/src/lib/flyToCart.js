// Animación "la tarjeta entra al carrito": una copia del producto sale desde donde se tocó "Agregar" y vuela en
// arco hasta el ícono del carrito que se esté viendo (arriba en el encabezado, o el de la barra inferior en el
// celular), encogiéndose. Al llegar, el carrito da un pequeño salto. Es solo decorativa: el producto ya se agregó.

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** El ícono de carrito visible ahora mismo (el primero que esté dentro de la pantalla). */
function cartTarget() {
  const candidates = document.querySelectorAll('[data-cart-target]');
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    if (visible && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}

/**
 * @param {Element} source  lo que vuela (la foto o la tarjeta del producto)
 * @param {string} [imageUrl] foto del producto; sin foto vuela un cuadro con el color de `source`
 */
export function flyToCart(source, imageUrl) {
  if (!source || reduceMotion()) return;
  const target = cartTarget();
  if (!target) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width || !from.height) return;

  const size = Math.min(from.width, from.height, 160);
  const ghost = document.createElement('div');
  ghost.className = 'fly-to-cart';
  Object.assign(ghost.style, {
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    background: imageUrl ? `#fff center / cover no-repeat url("${imageUrl}")` : '#0f5238',
  });
  if (!imageUrl) {
    // Sin foto: se copia el dibujo de la tarjeta (el ícono de la categoría sobre su color).
    const art = source.cloneNode(true);
    art.querySelectorAll('button, .product-add, .product-badge').forEach((n) => n.remove());
    // Se suman estilos sin borrar los que trae (ahí viene `--tint`, el color de la tarjeta).
    Object.assign(art.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', margin: '0' });
    ghost.appendChild(art);
  }
  document.body.appendChild(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const end = Math.max(0.12, 26 / size); // termina del tamaño del ícono
  // Arco: primero sube un poco (o baja, si el carrito está abajo) y luego cae sobre el carrito.
  const lift = dy < 0 ? -60 : 40;
  const animation = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1, borderRadius: '16px', offset: 0 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.25 + lift}px) scale(0.8) rotate(-8deg)`, opacity: 1, borderRadius: '18px', offset: 0.35 },
      { transform: `translate(${dx}px, ${dy}px) scale(${end}) rotate(0deg)`, opacity: 0.35, borderRadius: '50%', offset: 1 },
    ],
    { duration: 750, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' },
  );
  const finish = () => {
    ghost.remove();
    target.classList.remove('cart-bump');
    void target.offsetWidth; // reinicia la animación si se agregan varios seguidos
    target.classList.add('cart-bump');
    setTimeout(() => target.classList.remove('cart-bump'), 500);
  };
  animation.onfinish = finish;
  animation.oncancel = () => ghost.remove();
}
