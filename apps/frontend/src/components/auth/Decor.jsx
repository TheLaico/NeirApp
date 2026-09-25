import footer from '../../assets/footer.png';
import slogan from '../../assets/slogan.png';
import { Leaf } from '../common/Leaf.jsx';

export function TopDecor({ variant }) {
  if (variant === 'login') {
    return (
      <>
        <Leaf fill="#2d7a3d" style={{ left: -14, top: 8, width: 56, transform: 'rotate(-35deg)' }} />
        <Leaf fill="#e8a92c" style={{ left: -6, top: 70, width: 44, transform: 'rotate(-20deg)' }} />
        <Leaf fill="#d9541e" style={{ right: -14, top: 34, width: 50, transform: 'rotate(35deg)' }} />
        <Leaf fill="#e8a92c" style={{ right: -10, top: 92, width: 40, transform: 'rotate(25deg)' }} />
      </>
    );
  }

  // Registro: las hojas van pegadas al borde superior, por encima del botón de volver.
  return (
    <>
      <Leaf fill="#2d7a3d" style={{ left: -12, top: -32, width: 52, transform: 'rotate(-35deg)' }} />
      <Leaf fill="#e8a92c" style={{ left: 34, top: -38, width: 38, transform: 'rotate(-15deg)' }} />
      <Leaf fill="#2d7a3d" style={{ right: -10, top: -30, width: 50, transform: 'rotate(35deg)' }} />
      <Leaf fill="#e8a92c" style={{ right: 36, top: -38, width: 36, transform: 'rotate(15deg)' }} />
    </>
  );
}

export function BottomDecor() {
  return <img className="bottom-decor" src={footer} alt="" aria-hidden="true" />;
}

// Solo se ve en computador: va en el cielo del fondo, sobre la iglesia.
export function DesktopSlogan() {
  return <img className="desktop-slogan" src={slogan} alt="Todo Neira, en un solo lugar" />;
}
