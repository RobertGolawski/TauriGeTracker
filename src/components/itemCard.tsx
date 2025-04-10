
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


interface TrackedItemCardProps {
  item: ItemData;
  itemId: number; itemName: string;
  price?: ItemPriceData | null;
  onShowDetails: (item: ItemData) => void;
  onRemove: (id: number) => void;
}


function ItemCard({
  item,
  itemId,
  itemName,
  price,
  onShowDetails,
  onRemove
}: TrackedItemCardProps) {
  const handleCardClick = () => {
    onShowDetails(item);
  };

  const handleRemoveClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); onRemove(itemId);
  };
  return (
    <div className="item-card" onClick={handleCardClick}>
      <div className="item-card-main">
        <div className="item-card-info">
          <span className="item-card-name">{itemName}</span>
        </div>
        <div className="item-card-price">
          {price ? (
            <>
              <span className="price-high">H: {price.high}</span>
              <span className="price-low">L: {price.low}</span>
            </>
          ) : (
            <span className="price-loading">-</span>
          )}
        </div>
      </div>
      <div className="item-card-actions">
        <button
          className="item-card-button remove"
          onClick={handleRemoveClick}
          title="Remove from tracked items"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export default ItemCard;
