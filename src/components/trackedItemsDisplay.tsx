
// src/components/TrackedItemsDisplay.tsx
import React from 'react';
import ItemCard from './itemCard';

interface ItemData {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  lowalch: number;
  highalch: number;
  limit?: number;
}
interface ItemPriceData {
  high: number;
  low: number;
  highTime?: string | null;
  lowTime?: string | null;
}

interface TrackedItemsDisplayProps {
  items: ItemData[];
  prices: Record<string, ItemPriceData>;
  onShowDetails: (item: ItemData) => void;
  onRemoveItem: (id: number) => void;
}

function TrackedItemsDisplay({
  items,
  prices,
  onShowDetails,
  onRemoveItem
}: TrackedItemsDisplayProps) {

  return (
    <div className="tracked-items-container">
      <h2>Tracked Items</h2>
      {items.length === 0 ? (
        <p>No items are currently being tracked.</p>
      ) : (
        <div className="tracked-items-list">
          {items.map((item) => {
            const currentPrice = prices[item.id.toString()];
            return (
              <ItemCard
                key={item.id} item={item}
                itemId={item.id}
                itemName={item.name}
                price={currentPrice}
                onShowDetails={onShowDetails}
                onRemove={onRemoveItem}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TrackedItemsDisplay;
