import { Coffee, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';
import Image from 'next/image';

const DRINKS = [
  { name: "Coffee", price: "€1.50", stock: 45 },
  { name: "Espresso", price: "€1.50", stock: 30 },
  { name: "Tea", price: "€1.00", stock: 20 },
  { name: "Club Mate", price: "€2.50", stock: 12 },
  { name: "Fritz Kola", price: "€2.00", stock: 8 },
  { name: "Fritz Limo", price: "€2.00", stock: 15 },
  { name: "Apple Juice", price: "€1.50", stock: 10 },
  { name: "Sparkling Water", price: "€1.00", stock: 24 },
  { name: "Still Water", price: "€1.00", stock: 20 },
  { name: "Local Beer", price: "€3.00", stock: 18 },
  { name: "IPA", price: "€3.50", stock: 5 },
  { name: "Radler", price: "€2.50", stock: 10 },
  { name: "Kombucha", price: "€3.00", stock: 7 },
  { name: "Mate Cola", price: "€2.50", stock: 11 },
  { name: "Snickers", price: "€1.00", stock: 14 },
  { name: "Chips", price: "€1.50", stock: 9 },
  { name: "Croissant", price: "€2.00", stock: 4 },
  { name: "Brownie", price: "€2.50", stock: 6 },
  { name: "Vegan Cookie", price: "€2.00", stock: 8 },
  { name: "Pretzel", price: "€1.50", stock: 12 },
];

const HeaderRow = () => (
  <div className="grid grid-cols-[32px_1fr_auto_auto] gap-3 items-end border-b-2 border-[#2C1E16] pb-2 shrink-0">
    <span className="col-start-2 text-xs text-[#2C1E16] font-black uppercase">Item</span>
    <span className="text-xs text-[#2C1E16] font-black uppercase text-center w-10">Stock</span>
    <span className="text-xs text-[#2C1E16] font-black uppercase text-right w-12">Price</span>
  </div>
);

export function DrinksList() {
  return (
    <div className="flex-1 bg-[#F5F2EB] flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b-2 border-[#2C1E16] bg-[#C8A98B] shrink-0">
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-xs font-black flex items-center gap-2">
          <Coffee className="w-4 h-4" /> Drinks & Snacks
        </h2>
      </div>
      
      <div className="flex-1 flex flex-col p-6 min-h-0 overflow-hidden">
        <div className="grid grid-cols-2 gap-x-10 gap-y-2 h-full content-between">
          <HeaderRow />
          <HeaderRow />
          {DRINKS.map((drink, idx) => (
            <div key={idx} className="grid grid-cols-[32px_1fr_auto_auto] gap-3 items-center border-b border-[#2C1E16]/30 pb-2 shrink-0">
              <div className="w-8 h-8 relative border border-[#2C1E16] shrink-0 bg-[#E6D5B8]">
                <Image 
                  src={`https://picsum.photos/seed/${drink.name}/40/40`} 
                  alt={drink.name} 
                  fill 
                  className="object-cover grayscale opacity-80 mix-blend-multiply" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <span className="text-sm text-[#2C1E16] font-bold uppercase truncate leading-none">{drink.name}</span>
              <span className="text-sm font-black text-[#2C1E16] text-center w-10 leading-none">{drink.stock}</span>
              <span className="text-sm font-black text-[#2C1E16] text-right w-12 leading-none">{drink.price}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-4 border-t-2 border-[#2C1E16] bg-[#F5F2EB] flex flex-row items-center justify-center gap-6 shrink-0">
        <div className="flex flex-col items-end gap-1 text-[#2C1E16]">
          <QrCode className="w-5 h-5" />
          <p className="text-[10px] uppercase tracking-widest font-black text-right leading-tight max-w-[160px]">Scan the barcode of your item with this website</p>
        </div>
        <div className="border-2 border-[#2C1E16] p-1.5 bg-[#F5F2EB]">
          <QRCode value="https://makerspace.example.com/pay" size={60} bgColor="#F5F2EB" fgColor="#2C1E16" />
        </div>
      </div>
    </div>
  );
}
