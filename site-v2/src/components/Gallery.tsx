import { IMG } from '../data/images';

// Eenvoudige, responsieve fotogalerij met inzoom op hover.
export function Gallery() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {IMG.gallery.map((src, i) => (
        <div key={i} className={`overflow-hidden rounded-xl2 bg-green-soft ${i === 0 ? 'col-span-2 row-span-2 sm:col-span-1 sm:row-span-1' : ''}`}>
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover aspect-square transition-transform duration-700 hover:scale-105" />
        </div>
      ))}
    </div>
  );
}
